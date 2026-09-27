import asyncio
import csv
import io
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import site_ops


def _ledger_csv(site_id="site-1", trip_id="trip-1", business_id="business-1"):
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(["#FLEET_MANAGER_TRIP_LEDGER", site_ops.LEDGER_TEMPLATE_VERSION])
    writer.writerow([
        f"business_id={business_id}", f"site_id={site_id}", f"trip_id={trip_id}",
    ])
    writer.writerow(site_ops.LEDGER_COLUMNS)
    writer.writerow([
        "lr-1", "NGPLR27092026-01", trip_id, site_id, "Receiver",
        "Food grains", "100.00", "10.00", "0.00", "", "", "ref,\ncontinued",
    ])
    return output.getvalue().encode("utf-8")


def test_ledger_parser_accepts_versioned_scope_and_quoted_newlines():
    site = {"_id": "site-1", "business_id": "business-1"}
    trip = {"_id": "trip-1"}

    rows = site_ops._parse_ledger_csv(_ledger_csv(), site, trip)

    assert len(rows) == 1
    assert rows[0]["source"]["lr_id"] == "lr-1"
    assert rows[0]["source"]["transaction_reference"] == "ref,\ncontinued"


@pytest.mark.parametrize(
    ("site_id", "trip_id", "business_id"),
    [("other-site", "trip-1", "business-1"),
     ("site-1", "other-trip", "business-1"),
     ("site-1", "trip-1", "other-business")],
)
def test_ledger_parser_rejects_foreign_scope(site_id, trip_id, business_id):
    with pytest.raises(HTTPException) as error:
        site_ops._parse_ledger_csv(
            _ledger_csv(site_id, trip_id, business_id),
            {"_id": "site-1", "business_id": "business-1"},
            {"_id": "trip-1"},
        )

    assert error.value.status_code == 422


def test_amounts_are_decimal_and_reject_more_than_two_places():
    assert site_ops._decimal("12.30", "Bhada") == Decimal("12.30")
    with pytest.raises(HTTPException):
        site_ops._decimal("12.345", "Bhada")


def test_document_serializer_preserves_top_level_identifier():
    document = {"_id": "stable-record-id", "site_id": "site-1", "nested": {"_id": "internal"}}

    result = site_ops._doc(document)

    assert result["id"] == "stable-record-id"
    assert "_id" not in result
    assert "_id" not in result["nested"]


def test_payment_status_uses_amount_due_and_actual_paid_amount():
    assert site_ops._payment_status(None, Decimal("0.00")) == "unpriced"
    assert site_ops._payment_status(Decimal("100.00"), Decimal("0.00")) == "unpaid"
    assert site_ops._payment_status(Decimal("100.00"), Decimal("35.00")) == "partial"
    assert site_ops._payment_status(Decimal("100.00"), Decimal("100.00")) == "paid"


def test_reversal_index_spec_matches_existing_sparse_index(monkeypatch):
    class Collection:
        def __init__(self):
            self.indexes = []

        async def create_index(self, keys, **options):
            self.indexes.append((keys, options))

    class Database:
        def __init__(self):
            self.collections = {}

        def __getattr__(self, name):
            return self.collections.setdefault(name, Collection())

    database = Database()
    monkeypatch.setattr(site_ops, "db", database)
    monkeypatch.setattr(site_ops, "current_db_name", lambda: "test-tenant")
    monkeypatch.setattr(site_ops, "_indexed_databases", set())
    monkeypatch.setattr(site_ops, "_index_lock", asyncio.Lock())

    asyncio.run(site_ops.initialize_site_storage())

    indexes = database.site_payments.indexes
    reversal_index = next(
        options for _, options in indexes
        if options.get("name") == "site_payment_reversal_unique"
    )
    assert reversal_index["unique"] is True
    assert reversal_index["sparse"] is True
    assert "partialFilterExpression" not in reversal_index
    expense_index = next(
        options for _, options in database.expenses.indexes
        if options.get("name") == "site_trip_expense_idempotency_unique"
    )
    assert expense_index["unique"] is True
    assert expense_index["partialFilterExpression"] == {
        "idempotency_key": {"$exists": True},
    }
    posting_index = next(
        options for _, options in database.cashbook.indexes
        if options.get("name") == "site_trip_expense_posting_unique"
    )
    assert posting_index["unique"] is True
    assert posting_index["partialFilterExpression"]["$and"][1] == {
        "ref_type": "site_trip_expense",
    }


def test_invalid_payment_balance_is_marked_rejected(monkeypatch):
    class SiteLRs:
        async def update_one(self, *_args, **_kwargs):
            return SimpleNamespace(modified_count=0)

        async def find_one(self, *_args, **_kwargs):
            return {"paid_total": Decimal("100.00"), "payment_effect_ids": []}

    class SitePayments:
        def __init__(self):
            self.update = None

        async def update_one(self, query, update):
            self.update = (query, update)

    payments = SitePayments()
    monkeypatch.setattr(
        site_ops, "db",
        SimpleNamespace(site_lrs=SiteLRs(), site_payments=payments),
    )
    site = {"_id": "site-1", "business_id": "business-1"}
    payment = {
        "_id": "payment-1", "lr_id": "lr-1", "trip_id": "trip-1",
        "amount": site_ops.Decimal128(Decimal("1.00")), "kind": "payment",
    }

    with pytest.raises(HTTPException) as error:
        asyncio.run(site_ops._apply_payment_balance(payment, site))

    assert error.value.status_code == 409
    assert payments.update[0] == {"_id": "payment-1", "posting_status": "pending"}
    assert payments.update[1]["$set"]["posting_status"] == "rejected"


@pytest.mark.parametrize("value", ["=SUM(A1:A2)", "+cmd", "-1+2", "@import", "\tformula"])
def test_csv_export_neutralizes_formula_prefixes(value):
    assert site_ops._safe_csv_text(value).startswith("'")


def test_csv_export_neutralizes_formula_after_whitespace():
    assert site_ops._safe_csv_text("  \t=SUM(A1:A2)") == "'  \t=SUM(A1:A2)"


def test_lr_models_accept_contact_phones():
    created = site_ops.LRCreate(
        sender_name="Sender", sender_phone="+1 555-0100",
        receiver_name="Receiver", receiver_phone="555-0200",
        goods_type="Goods", containers=[site_ops.ContainerLine(type="Box", quantity=1)],
    )
    updated = site_ops.LRUpdate(sender_phone="555-0300", receiver_phone="555-0400")

    assert created.sender_phone == "+1 555-0100"
    assert created.receiver_phone == "555-0200"
    assert updated.sender_phone == "555-0300"
    assert updated.receiver_phone == "555-0400"


def test_receiver_party_phone_is_not_overwritten_when_request_omits_it(monkeypatch):
    class Parties:
        def __init__(self):
            self.update_calls = []

        async def find_one(self, _query):
            return {"_id": "party-1", "mobile": "existing-mobile"}

        async def update_one(self, query, update):
            self.update_calls.append((query, update))

    parties = Parties()
    monkeypatch.setattr(site_ops, "db", SimpleNamespace(parties=parties))
    site = {"_id": "site-1", "business_id": "business-1"}
    identity = {"_id": "receiver-1"}

    result = asyncio.run(site_ops._party_for_receiver(site, identity))

    assert result == "party-1"
    assert parties.update_calls == []


def test_receiver_party_phone_updates_when_a_phone_is_supplied(monkeypatch):
    class Parties:
        def __init__(self):
            self.update_calls = []

        async def find_one(self, _query):
            return {"_id": "party-1", "mobile": "old-mobile"}

        async def update_one(self, query, update):
            self.update_calls.append((query, update))

    parties = Parties()
    monkeypatch.setattr(site_ops, "db", SimpleNamespace(parties=parties))

    result = asyncio.run(site_ops._party_for_receiver(
        {"_id": "site-1", "business_id": "business-1"},
        {"_id": "receiver-1"}, "555-0100",
    ))

    assert result == "party-1"
    assert parties.update_calls[0][1] == {"$set": {"mobile": "555-0100"}}


def test_lr_rows_return_persisted_contact_phones(monkeypatch):
    monkeypatch.setattr(
        site_ops, "_payments_by_lr", _async_value({"lr-1": Decimal("0.00")}),
    )
    lr = {
        "_id": "lr-1", "sender_phone": "555-0100",
        "receiver_phone": "555-0200", "rent": None,
    }

    result = asyncio.run(site_ops._lr_rows(
        {"_id": "site-1", "business_id": "business-1"}, "trip-1", [lr],
    ))[0]

    assert result["sender_phone"] == "555-0100"
    assert result["receiver_phone"] == "555-0200"


@pytest.mark.parametrize("requested_phone", [None, "555-0300"])
def test_lr_update_persists_phone_and_preserves_party_mobile_when_omitted(
    monkeypatch, requested_phone,
):
    site = {"_id": "site-1", "business_id": "business-1"}
    lr = {
        "_id": "lr-1", "party_id": "party-1", "trip_id": "trip-1",
        "sender_name": "Sender", "sender_phone": "555-0100",
        "receiver_phone": "555-0200", "rent": None, "hamali": None,
    }

    class SiteLRs:
        def __init__(self):
            self.update = None

        async def update_one(self, query, update):
            self.update = (query, update)
            lr.update(update["$set"])

    class Parties:
        def __init__(self):
            self.mobile = "555-0200"
            self.updates = []

        async def update_one(self, query, update):
            self.updates.append((query, update))
            self.mobile = update["$set"]["mobile"]

    lrs = SiteLRs()
    parties = Parties()
    monkeypatch.setattr(site_ops, "db", SimpleNamespace(site_lrs=lrs, parties=parties))
    monkeypatch.setattr(site_ops, "_site_for_user", _async_value(site))
    monkeypatch.setattr(site_ops, "_trip", _async_value({"status": "open"}))
    monkeypatch.setattr(site_ops, "_lr", _async_value(lr))
    monkeypatch.setattr(site_ops, "_audit", _async_value(None))
    monkeypatch.setattr(site_ops, "_lr_rows", _async_value([lr]))
    body = site_ops.LRUpdate(
        sender_name="Edited Sender", receiver_phone=requested_phone,
    ) if requested_phone else site_ops.LRUpdate(sender_name="Edited Sender")

    result = asyncio.run(site_ops.update_site_lr(
        "site-1", "trip-1", "lr-1", body, {"role": "owner"},
    ))

    assert result["receiver_phone"] == (requested_phone or "555-0200")
    assert parties.mobile == (requested_phone or "555-0200")
    assert bool(parties.updates) is bool(requested_phone)
    if requested_phone:
        assert lrs.update is not None
        assert lrs.update[1]["$set"]["receiver_phone"] == requested_phone


def _report_fixtures():
    site = {"_id": "site-1", "business_id": "business-1", "code": "ST"}
    trip = {
        "_id": "trip-1", "trip_ref": "STT-001", "operating_date": "2026-09-27",
    }
    lrs = [
        {
            "_id": "lr-1", "lr_ref": "STLR-001", "receiver_identity_id": "receiver-1",
            "receiver_label": "Receiver One", "receiver_name": "Receiver One",
            "receiver_identifier": "", "sender_name": "Sender One",
            "goods_type": "Same Goods", "containers": [
                {"type": "Box", "quantity": 2}, {"type": "Bag", "quantity": 3},
            ],
            "total_quantity": 5, "rent": Decimal("100.00"),
            "hamali": Decimal("10.00"),
        },
        {
            "_id": "lr-2", "lr_ref": "STLR-002", "receiver_identity_id": "receiver-2",
            "receiver_label": "Receiver Two", "receiver_name": "Receiver Two",
            "receiver_identifier": "", "sender_name": "Sender Two",
            "goods_type": "Same Goods", "containers": [
                {"type": "Box", "quantity": 4},
            ],
            "total_quantity": 4, "rent": Decimal("200.00"),
            "hamali": Decimal("20.00"),
        },
    ]
    return site, trip, lrs


def _export_csv(monkeypatch, section, lrs=None):
    site, trip, fixture_lrs = _report_fixtures()
    lrs = fixture_lrs if lrs is None else lrs
    monkeypatch.setattr(site_ops, "_site_for_user", _async_value(site))
    monkeypatch.setattr(site_ops, "_trip", _async_value(trip))
    monkeypatch.setattr(site_ops, "_trip_ledger_rows", _async_value((lrs, {})))
    monkeypatch.setattr(
        site_ops, "_payments_by_lr",
        _async_value({"lr-1": Decimal("25.00"), "lr-2": Decimal("50.00")}),
    )
    response = asyncio.run(
        site_ops.export_site_ledger("site-1", "trip-1", section, {"role": "owner"})
    )
    rows = list(csv.reader(io.StringIO(bytes(response.body).decode("utf-8-sig"), newline="")))
    return rows


def _async_value(value):
    async def return_value(*_args, **_kwargs):
        return value
    return return_value


@pytest.mark.parametrize(
    ("section", "expected_header"),
    [
        ("goods", [
            "business_id", "site_id", "trip_id", "goods_type", "container_quantities",
            "parcel_quantity_units", "lr_references", "receiver_count",
            "bhada_recorded_inr", "hamali_recorded_inr", "bhada_collected_inr",
            "bhada_outstanding_inr",
        ]),
        ("goods-details", [
            "business_id", "site_id", "trip_id", "trip_ref", "operating_date",
            "lr_id", "lr_ref", "receiver_label", "receiver_name", "receiver_identifier",
            "sender_name", "goods_type", "container_type", "container_quantity_units",
            "lr_parcel_quantity_units", "lr_financial_totals_row",
            "lr_bhada_recorded_inr", "lr_hamali_recorded_inr",
            "lr_bhada_collected_inr", "lr_bhada_outstanding_inr",
        ]),
        ("receivers", [
            "business_id", "site_id", "trip_id", "receiver_label", "receiver_name",
            "lr_references", "goods_types", "container_quantities", "parcel_quantity_units",
            "bhada_recorded_inr", "hamali_recorded_inr", "bhada_collected_inr",
            "bhada_outstanding_inr", "payment_details",
        ]),
        ("summary", [
            "business_id", "site_id", "trip_id", "trip_ref", "site_code",
            "operating_date", "lr_count", "parcel_quantity_units", "bhada_recorded_inr",
            "bhada_collected_inr", "bhada_outstanding_inr", "hamali_recorded_inr",
        ]),
    ],
)
def test_trip_report_variants_are_headers_first_and_scoped(
    monkeypatch, section, expected_header,
):
    rows = _export_csv(monkeypatch, section)

    assert rows[0] == expected_header
    assert rows[1][0:3] == ["business-1", "site-1", "trip-1"]


def test_goods_reports_keep_receivers_distinct_without_repeating_financials(monkeypatch):
    aggregate = _export_csv(monkeypatch, "goods")
    assert aggregate[0][7] == "receiver_count"
    assert aggregate[1][7] == "2"
    assert aggregate[1][4:7] == ["Bag x 3; Box x 6", "9", "STLR-001; STLR-002"]

    detailed = _export_csv(monkeypatch, "goods-details")
    header = detailed[0]
    receiver_column = header.index("receiver_name")
    lr_id_column = header.index("lr_id")
    totals_row_column = header.index("lr_financial_totals_row")
    rent_column = header.index("lr_bhada_recorded_inr")
    assert {row[receiver_column] for row in detailed[1:]} == {"Receiver One", "Receiver Two"}
    assert len(detailed[1:]) == 3
    assert [row[totals_row_column] for row in detailed[1:]] == ["true", "false", "true"]
    assert [row[rent_column] for row in detailed[1:]] == ["100.00", "", "200.00"]
    assert [row[lr_id_column] for row in detailed[1:]] == ["lr-1", "lr-1", "lr-2"]

    compatible_detail_alias = _export_csv(monkeypatch, "goods-detail")
    assert compatible_detail_alias[0] == detailed[0]
    assert compatible_detail_alias[1:] == detailed[1:]


def test_report_exports_neutralize_formula_injection(monkeypatch):
    site, trip, lrs = _report_fixtures()
    lrs[0]["receiver_name"] = " \t=HYPERLINK(\"https://evil.invalid\")"
    monkeypatch.setattr(site_ops, "_site_for_user", _async_value(site))
    monkeypatch.setattr(site_ops, "_trip", _async_value(trip))
    monkeypatch.setattr(site_ops, "_trip_ledger_rows", _async_value((lrs, {})))
    monkeypatch.setattr(
        site_ops, "_payments_by_lr",
        _async_value({"lr-1": Decimal("25.00"), "lr-2": Decimal("50.00")}),
    )

    rows = asyncio.run(site_ops.export_site_ledger(
        "site-1", "trip-1", "goods-details", {"role": "owner"},
    ))
    parsed = list(csv.reader(io.StringIO(bytes(rows.body).decode("utf-8-sig"), newline="")))
    receiver_column = parsed[0].index("receiver_name")

    assert parsed[1][receiver_column] == "' \t=HYPERLINK(\"https://evil.invalid\")"


def test_every_import_template_keeps_versioned_header_and_parser_contract(monkeypatch):
    rows = _export_csv(monkeypatch, "import-template")

    assert rows[0] == ["#FLEET_MANAGER_TRIP_LEDGER", site_ops.LEDGER_TEMPLATE_VERSION]
    assert rows[1] == [
        "business_id=business-1", "site_id=site-1", "trip_id=trip-1",
    ]
    assert rows[2] == list(site_ops.LEDGER_COLUMNS)
    parsed = site_ops._parse_ledger_csv(
        ("\ufeff" + "\r\n".join(",".join(row) for row in rows)).encode("utf-8"),
        {"_id": "site-1", "business_id": "business-1"},
        {"_id": "trip-1"},
    )
    assert [row["source"]["lr_id"] for row in parsed] == ["lr-1", "lr-2"]


def test_site_trip_expense_post_is_idempotent_and_audited(monkeypatch):
    site = {"_id": "site-1", "business_id": "business-1"}
    trip = {
        "_id": "trip-1", "trip_ref": "ST27092026-01", "truck_no": "TRUCK-1",
        "driver_name": "Driver One", "vehicle_id": None, "driver_id": None,
    }

    class Expenses:
        def __init__(self):
            self.documents = {}
            self.created_count = 0

        async def find_one_and_update(self, query, update, **_kwargs):
            key = query["idempotency_key"]
            if key not in self.documents:
                self.documents[key] = update["$setOnInsert"]
                self.created_count += 1
            return self.documents[key].copy()

    expenses = Expenses()
    audit_events = []
    posting_calls = []
    response = {"expenses": [{"id": "expense-1"}], "total_amount": "25.00", "total": 1}
    monkeypatch.setattr(site_ops, "db", SimpleNamespace(
        settings=SimpleNamespace(find_one=_async_value({
            "expense_categories": ["Toll"], "payment_modes": ["Cash"],
        })),
        expenses=expenses,
    ))
    monkeypatch.setattr(site_ops, "_site_for_user", _async_value(site))
    monkeypatch.setattr(site_ops, "_trip", _async_value(trip))
    monkeypatch.setattr(site_ops, "_ensure_site_trip_expense_posted", _async_record(posting_calls))
    monkeypatch.setattr(site_ops, "_site_trip_expense_response", _async_value(response))
    monkeypatch.setattr(site_ops, "_audit", _async_capture(audit_events))

    body = site_ops.SiteTripExpenseCreate(
        description="Toll plaza", category="Toll", amount=Decimal("25.00"),
        date="2026-09-27", payment_method="Cash", payee="Highway Toll",
        idempotency_key="toll-expense-1",
    )
    first = asyncio.run(site_ops.create_site_trip_expense(
        "site-1", "trip-1", body, {"role": "owner", "username": "owner"},
    ))
    second = asyncio.run(site_ops.create_site_trip_expense(
        "site-1", "trip-1", body, {"role": "owner", "username": "owner"},
    ))

    assert first == second == response
    assert expenses.created_count == 1
    assert len(posting_calls) == 2
    saved = expenses.documents["toll-expense-1"]
    assert saved["amount"] == 25.0
    assert saved["business_id"] == "business-1"
    assert saved["site_id"] == "site-1"
    assert saved["trip_id"] == "trip-1"
    assert saved["remarks"] == "Toll plaza"
    assert saved["mode"] == "Cash"
    assert audit_events[0]["event_id"] == audit_events[1]["event_id"]

    conflicting_body = body.model_copy(update={"amount": Decimal("30.00")})
    with pytest.raises(HTTPException) as error:
        asyncio.run(site_ops.create_site_trip_expense(
            "site-1", "trip-1", conflicting_body,
            {"role": "owner", "username": "owner"},
        ))
    assert error.value.status_code == 409
    assert expenses.created_count == 1


def test_site_trip_expense_uses_scoped_cashbook_and_driver_ledger_postings(monkeypatch):
    class ExistingRows:
        async def find_one(self, _query):
            return None

    cash_calls = []
    ledger_calls = []
    monkeypatch.setattr(
        site_ops, "db",
        SimpleNamespace(cashbook=ExistingRows(), ledger=ExistingRows()),
    )
    monkeypatch.setattr(site_ops.L, "cash", _async_capture_call(cash_calls))
    monkeypatch.setattr(site_ops.L, "post", _async_capture_call(ledger_calls))
    site = {"_id": "site-1", "business_id": "business-1"}
    expense = {
        "_id": "expense-1", "category": "Driver Advance", "driver_id": "driver-1",
        "amount": 12.5, "date": "2026-09-27", "mode": "Bank",
        "vehicle_no": "TRUCK-1", "driver_name": "Driver One",
        "trip_no": "ST-001", "remarks": "Advance",
    }

    asyncio.run(site_ops._post_site_trip_expense(site, expense))

    assert cash_calls == [(
        ("bank", "out", 12.5, "2026-09-27",
         "Driver Advance expense - TRUCK-1 (trip ST-001: Advance)",
         "site_trip_expense", "expense-1"),
        {"mode": "Bank", "site_id": "site-1", "business_id": "business-1"},
    )]
    assert ledger_calls == [(
        ("driver", "driver-1", "2026-09-27", "Advance given (expense entry)"),
        {
            "debit": 12.5, "ref_type": "site_trip_expense", "ref_id": "expense-1",
            "site_id": "site-1", "business_id": "business-1",
        },
    )]


def test_site_trip_expense_get_requires_finance_read(monkeypatch):
    site = {"_id": "site-1", "business_id": "business-1"}
    monkeypatch.setattr(site_ops, "_site_for_user", _async_value(site))
    monkeypatch.setattr(site_ops, "_trip", _async_value({"_id": "trip-1"}))
    monkeypatch.setattr(
        site_ops, "_site_trip_expense_response",
        _async_value({"expenses": [], "total_amount": "0.00", "total": 0}),
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(site_ops.list_site_trip_expenses(
            "site-1", "trip-1",
            {"role": "site_manager", "site_permissions": {"site-1": ["trips:read"]}},
        ))
    assert error.value.status_code == 403

    result = asyncio.run(site_ops.list_site_trip_expenses(
        "site-1", "trip-1", {"role": "owner"},
    ))
    assert result == {"expenses": [], "total_amount": "0.00", "total": 0}


def test_trip_expense_response_includes_tenant_configured_options(monkeypatch):
    class Settings:
        async def find_one(self, query):
            assert query == {"_id": "settings"}
            return {
                "expense_categories": ["Fuel", "Toll"],
                "payment_modes": ["Cash", "UPI"],
            }

    async def no_expenses(_site, _trip_id):
        return [], Decimal("0.00"), 0

    monkeypatch.setattr(site_ops, "db", SimpleNamespace(settings=Settings()))
    monkeypatch.setattr(site_ops, "_trip_expense_rows", no_expenses)

    result = asyncio.run(site_ops._site_trip_expense_response(
        {"_id": "site-1", "business_id": "business-1"}, "trip-1",
    ))

    assert result["expense_categories"] == ["Fuel", "Toll"]
    assert result["payment_modes"] == ["Cash", "UPI"]
    assert result["total_amount"] == "0.00"


def test_authorized_site_trip_expense_get_returns_finance_options(monkeypatch):
    response = {
        "expenses": [], "total_amount": "0.00", "total": 0,
        "expense_categories": ["Fuel", "Toll"],
        "payment_modes": ["Cash", "UPI"],
    }
    monkeypatch.setattr(
        site_ops, "_site_for_user",
        _async_value({"_id": "site-1", "business_id": "business-1"}),
    )
    monkeypatch.setattr(site_ops, "_trip", _async_value({"_id": "trip-1"}))
    monkeypatch.setattr(site_ops, "_site_trip_expense_response", _async_value(response))
    manager = {
        "role": "site_manager",
        "site_permissions": {"site-1": ["finance:read"]},
    }

    result = asyncio.run(site_ops.list_site_trip_expenses("site-1", "trip-1", manager))

    assert result["expense_categories"] == ["Fuel", "Toll"]
    assert result["payment_modes"] == ["Cash", "UPI"]


def _async_record(calls):
    async def record(*args):
        value = args[-1]
        calls.append(value.copy())
        value["posting_status"] = "posted"
        return value
    return record


def _async_capture(calls):
    async def capture(*args, **kwargs):
        calls.append({"args": args, **kwargs})
    return capture


def _async_capture_call(calls):
    async def capture(*args, **kwargs):
        calls.append((args, kwargs))
    return capture


def test_site_trip_expense_model_requires_idempotency_and_contract_fields():
    expense = site_ops.SiteTripExpenseCreate(
        description="Toll road",
        category="Toll",
        amount=Decimal("45.00"),
        date="2026-09-27",
        payment_method="UPI",
        payee="Toll booth",
        idempotency_key="expense-request-1",
    )

    assert expense.amount == Decimal("45.00")
    assert expense.payment_method == "UPI"
    with pytest.raises(Exception):
        site_ops.SiteTripExpenseCreate.model_validate({
            "description": "Toll road", "category": "Toll", "amount": "45.00",
            "date": "2026-09-27", "payment_method": "UPI",
        })

    legacy_names = site_ops.SiteTripExpenseCreate.model_validate({
        "remarks": "Toll road", "category": "Toll", "amount": Decimal("45.00"),
        "date": "2026-09-27", "mode": "UPI", "vendor": "Toll booth",
        "idempotency_key": "expense-request-2",
    })
    assert legacy_names.description == "Toll road"
    assert legacy_names.payment_method == "UPI"
    assert legacy_names.payee == "Toll booth"


def test_site_trip_expense_is_accounted_once_and_audited(monkeypatch):
    site = {"_id": "site-1", "business_id": "business-1"}
    trip = {
        "_id": "trip-1", "trip_ref": "ST-001", "truck_no": "TRK-1",
        "driver_name": "Assigned Driver", "driver_id": "driver-1",
    }
    user = {
        "role": "site_manager", "username": "manager", "name": "Site Manager",
        "site_permissions": {"site-1": ["finance:read", "finance:update"]},
    }

    class Cursor:
        def __init__(self, rows):
            self.rows = rows

        def sort(self, *_args):
            return self

        def to_list(self, limit):
            return asyncio.sleep(0, result=self.rows[:limit])

    class Expenses:
        def __init__(self):
            self.rows = {}

        async def find_one_and_update(self, query, update, **_kwargs):
            key = (query["business_id"], query["site_id"], query["trip_id"], query["idempotency_key"])
            if key not in self.rows:
                self.rows[key] = update["$setOnInsert"].copy()
            return self.rows[key].copy()

        async def find_one(self, query):
            return next((row.copy() for row in self.rows.values()
                         if all(row.get(key) == value for key, value in query.items())), None)

        async def update_one(self, query, update):
            row = next((row for row in self.rows.values()
                        if all(row.get(key) == value for key, value in query.items()
                               if key not in ("posting_status", "$or"))), None)
            if row is None:
                return SimpleNamespace(modified_count=0)
            if "posting_status" in query:
                expected = query["posting_status"]
                allowed = expected.get("$in", []) if isinstance(expected, dict) else [expected]
                if row.get("posting_status") not in allowed:
                    conditions = query.get("$or", [])
                    if not any(
                        row.get("posting_status") == condition.get("posting_status")
                        or (
                            isinstance(condition.get("posting_status"), dict)
                            and row.get("posting_status") in condition["posting_status"].get("$in", [])
                        )
                        for condition in conditions
                    ):
                        return SimpleNamespace(modified_count=0)
            elif "$or" in query and not any(
                row.get("posting_status") in condition.get("posting_status", {}).get("$in", [])
                for condition in query["$or"]
            ):
                return SimpleNamespace(modified_count=0)
            row.update(update.get("$set", {}))
            for key in update.get("$unset", {}):
                row.pop(key, None)
            return SimpleNamespace(modified_count=1)

        def find(self, query):
            rows = [row.copy() for row in self.rows.values()
                    if all(row.get(key) == value for key, value in query.items())]
            return Cursor(rows)

        def aggregate(self, pipeline):
            query = pipeline[0]["$match"]
            rows = [row for row in self.rows.values()
                    if all(row.get(key) == value for key, value in query.items())]
            return Cursor([{
                "_id": None, "total": sum((Decimal(str(row["amount"])) for row in rows), Decimal("0")),
                "count": len(rows),
            }] if rows else [])

    class Records:
        def __init__(self):
            self.rows = []

        async def find_one(self, query):
            return next((row for row in self.rows
                         if all(row.get(key) == value for key, value in query.items())), None)

    class Settings:
        async def find_one(self, _query):
            return {
                "expense_categories": ["Fuel", "Toll", "Driver Advance"],
                "payment_modes": ["Cash", "UPI", "Bank", "Cheque", "Other"],
            }

    expenses = Expenses()
    cashbook = Records()
    ledger = Records()
    audit_events = []
    database = SimpleNamespace(
        expenses=expenses, cashbook=cashbook, ledger=ledger, settings=Settings(),
    )
    monkeypatch.setattr(site_ops, "db", database)

    async def site_for_user(*_args, **_kwargs):
        return site

    async def trip_for_site(*_args, **_kwargs):
        return trip

    async def audit(*_args, event_id=None, **_kwargs):
        audit_events.append(event_id)

    cash_calls = []
    ledger_calls = []

    async def post_cash(account, direction, amount, dt, description, ref_type, ref_id, **kwargs):
        cash_calls.append((account, direction, amount, ref_type, ref_id, kwargs))
        cashbook.rows.append({
            "business_id": kwargs["business_id"], "site_id": kwargs["site_id"],
            "ref_type": ref_type, "ref_id": ref_id,
        })

    async def post_ledger(entity_type, entity_id, dt, description, **kwargs):
        ledger_calls.append((entity_type, entity_id, kwargs))
        ledger.rows.append({
            "business_id": kwargs["business_id"], "site_id": kwargs["site_id"],
            "ref_type": kwargs["ref_type"], "ref_id": kwargs["ref_id"],
            "entity_type": entity_type, "entity_id": entity_id,
        })

    monkeypatch.setattr(site_ops, "_site_for_user", site_for_user)
    monkeypatch.setattr(site_ops, "_trip", trip_for_site)
    monkeypatch.setattr(site_ops, "_audit", audit)
    monkeypatch.setattr(site_ops.L, "cash", post_cash)
    monkeypatch.setattr(site_ops.L, "post", post_ledger)
    ids = iter(["expense-1", "expense-2"])
    monkeypatch.setattr(site_ops, "new_id", lambda: next(ids))
    request = site_ops.SiteTripExpenseCreate(
        description="Advance for trip", category="Driver Advance", amount=Decimal("125.50"),
        date="2026-09-27", payment_method="Cash", payee="Assigned Driver",
        idempotency_key="trip-expense-request-1",
    )

    first = asyncio.run(site_ops.create_site_trip_expense("site-1", "trip-1", request, user))
    repeated = asyncio.run(site_ops.create_site_trip_expense("site-1", "trip-1", request, user))

    assert len(first["expenses"]) == 1
    assert first["total_amount"] == "125.50"
    assert repeated["total_amount"] == "125.50"
    assert first["expenses"][0]["created_by"] == "manager"
    assert first["expenses"][0]["driver_id"] == "driver-1"
    assert first["expenses"][0]["driver_name"] == "Assigned Driver"
    assert first["expenses"][0]["posting_status"] == "posted"
    assert cash_calls[0][:4] == ("cash", "out", 125.5, "site_trip_expense")
    assert len(cash_calls) == 1
    assert len(ledger_calls) == 1
    assert ledger_calls[0][:2] == ("driver", "driver-1")
    assert audit_events == ["site-trip-expense-created:expense-1"] * 2


def test_site_trip_expense_rejects_idempotency_key_reuse_for_different_details(monkeypatch):
    site = {"_id": "site-1", "business_id": "business-1"}
    stored = {
        "_id": "expense-1", "business_id": "business-1", "site_id": "site-1",
        "trip_id": "trip-1", "idempotency_key": "same-request-key",
        "request_fingerprint": "original", "posting_status": "posted",
    }

    class Expenses:
        async def find_one_and_update(self, *_args, **_kwargs):
            return stored

    class Settings:
        async def find_one(self, _query):
            return {
                "expense_categories": ["Toll"],
                "payment_modes": ["Cash"],
            }

    monkeypatch.setattr(
        site_ops, "db", SimpleNamespace(expenses=Expenses(), settings=Settings()),
    )
    monkeypatch.setattr(site_ops, "_site_for_user", _async_value(site))
    monkeypatch.setattr(site_ops, "_trip", _async_value({"_id": "trip-1"}))
    request = site_ops.SiteTripExpenseCreate(
        description="Different toll amount", category="Toll", amount=Decimal("10"),
        date="2026-09-27", payment_method="Cash", idempotency_key="same-request-key",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(site_ops.create_site_trip_expense(
            "site-1", "trip-1", request, {"role": "owner", "username": "owner"},
        ))

    assert error.value.status_code == 409


def test_site_trip_expense_retry_recovers_cash_post_without_duplicate(monkeypatch):
    site = {"_id": "site-1", "business_id": "business-1"}
    expense = {
        "_id": "expense-1", "business_id": "business-1", "site_id": "site-1",
        "trip_id": "trip-1", "idempotency_key": "request-key",
        "posting_status": "failed", "category": "Toll", "driver_id": None,
    }
    cash_row = {
        "business_id": "business-1", "site_id": "site-1",
        "ref_type": "site_trip_expense", "ref_id": "expense-1",
    }

    class Expenses:
        async def update_one(self, query, update):
            expected = query.get("posting_status")
            allowed = expected.get("$in", []) if isinstance(expected, dict) else [expected]
            conditions = query.get("$or", [])
            matches_stale_claim = any(
                expense.get("posting_status") == condition.get("posting_status")
                or (
                    isinstance(condition.get("posting_status"), dict)
                    and expense.get("posting_status") in condition["posting_status"].get("$in", [])
                )
                for condition in conditions
            )
            if (expected is not None and expense.get("posting_status") not in allowed
                    and not matches_stale_claim):
                return SimpleNamespace(modified_count=0)
            expense.update(update["$set"])
            for key in update.get("$unset", {}):
                expense.pop(key, None)
            return SimpleNamespace(modified_count=1)

        async def find_one(self, _query):
            return expense

    class Cashbook:
        async def find_one(self, query):
            return cash_row if all(cash_row.get(key) == value for key, value in query.items()) else None

    class Ledger:
        async def find_one(self, _query):
            return None

    monkeypatch.setattr(
        site_ops, "db",
        SimpleNamespace(expenses=Expenses(), cashbook=Cashbook(), ledger=Ledger()),
    )

    async def duplicate_post_is_a_bug(*_args, **_kwargs):
        raise AssertionError("Existing cashbook posting must be reused")

    monkeypatch.setattr(site_ops.L, "cash", duplicate_post_is_a_bug)
    result = asyncio.run(site_ops._ensure_site_trip_expense_posted(site, expense))

    assert result["posting_status"] == "posted"
    assert expense["posting_status"] == "posted"


def test_receivables_breakdown_uses_scoped_lrs_and_posted_net_payments(monkeypatch):
    receiver_row = {
        "_id": "receiver one", "lr_count": 3, "parcels": 7,
        "reconciled_rent": site_ops.Decimal128(Decimal("100.00")),
        "posted_payments": site_ops.Decimal128(Decimal("40.00")),
        "collectible_outstanding": site_ops.Decimal128(Decimal("60.00")),
        "unpaid_lrs": 1,
        "unreconciled_bhada": site_ops.Decimal128(Decimal("25.00")),
        "unreconciled_lrs": 1, "unpriced_lrs": 1,
    }
    goods_row = {**receiver_row, "_id": "Food grains"}
    site_row = {**receiver_row, "_id": "site-1"}
    captured = {}

    class SiteLRs:
        def aggregate(self, pipeline):
            captured["pipeline"] = pipeline
            return SimpleNamespace(to_list=lambda _limit: asyncio.sleep(0, result=[{
                "by_receiver": [receiver_row], "receiver_count": [{"count": 1}],
                "by_goods": [goods_row], "goods_count": [{"count": 1}],
                "by_site": [site_row],
            }]))

    monkeypatch.setattr(site_ops, "db", SimpleNamespace(site_lrs=SiteLRs()))
    query = {
        "business_id": "business-1", "site_id": {"$in": ["site-1"]},
        "operating_date": {"$gte": "2026-09-01", "$lte": "2026-09-30"},
        "trip_id": "trip-1",
    }

    result = asyncio.run(site_ops._receivables_breakdown(query))

    assert result["collectible_outstanding"] == "60.00"
    assert result["posted_payments"] == "40.00"
    assert result["unreconciled_bhada"] == "25.00"
    assert result["unreconciled_lrs"] == 1
    assert result["unpriced_lrs"] == 1
    assert result["by_receiver"]["rows"][0]["label"] == "receiver one"
    assert result["by_goods"]["rows"][0]["label"] == "Food grains"
    assert result["by_site"]["site-1"]["collectible_outstanding"] == "60.00"
    pipeline = captured["pipeline"]
    assert pipeline[0] == {"$match": query}
    lookup = pipeline[1]["$lookup"]
    assert lookup["from"] == "site_payments"
    payment_match = lookup["pipeline"][0]["$match"]["$expr"]["$and"]
    assert {"$eq": ["$posting_status", "posted"]} in payment_match
    assert {"$eq": ["$trip_id", "$$trip_id"]} in payment_match
    assert pipeline[-1]["$facet"]["by_receiver"][-1] == {"$limit": 200}
    metric_stage = pipeline[2]["$set"]
    assert metric_stage["_collectible_outstanding"]["$cond"][0] == {
        "$and": [{"$eq": ["$reconciled", True]}, {"$ne": ["$rent", None]}],
    }
    assert result["by_receiver"]["truncated"] is False
