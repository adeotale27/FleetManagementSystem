"""Opt-in API workflow acceptance test; it creates persistent test records.

Run only against a disposable test tenant/API:
FMS_SITE_OPS_E2E_ALLOW_WRITES=1
FMS_SITE_OPS_E2E_BASE_URL=http://127.0.0.1:8000
FMS_SITE_OPS_E2E_OWNER_USERNAME=...
FMS_SITE_OPS_E2E_OWNER_PASSWORD=...
"""
import csv
import io
import os
import time
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
import requests


BASE_URL = os.environ.get("FMS_SITE_OPS_E2E_BASE_URL", "").rstrip("/")
OWNER_USERNAME = os.environ.get("FMS_SITE_OPS_E2E_OWNER_USERNAME", "")
OWNER_PASSWORD = os.environ.get("FMS_SITE_OPS_E2E_OWNER_PASSWORD", "")
ENABLED = (
    os.environ.get("FMS_SITE_OPS_E2E_ALLOW_WRITES") == "1"
    and bool(BASE_URL and OWNER_USERNAME and OWNER_PASSWORD)
)
pytestmark = pytest.mark.skipif(
    not ENABLED,
    reason="Requires explicit opt-in and credentials for a disposable API/tenant",
)


def _login(username, password):
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": password},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    return response.json()["token"]


def _request(method, path, token, **kwargs):
    response = requests.request(
        method, f"{BASE_URL}/api{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60, **kwargs,
    )
    assert response.status_code < 400, f"{method} {path}: {response.status_code} {response.text}"
    return response


def test_site_manager_trip_lr_ledger_and_payment_workflow():
    owner = _login(OWNER_USERNAME, OWNER_PASSWORD)
    stamp = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    operating_date = datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat()
    code = f"T{uuid.uuid4().hex[:7].upper()}"
    manager_username = f"e2e-manager-{stamp}"
    manager_password = f"e2e-pass-{stamp}-Aa!"
    site_id = None
    manager_token = None

    try:
        site = _request("POST", "/sites", owner, json={
            "name": f"E2E Site {stamp}", "code": code,
            "location": "Automated acceptance test", "timezone": "Asia/Kolkata",
        }).json()
        site_id = site["id"]

        permissions = [
            "dashboard:read", "trips:read", "trips:create", "trips:update",
            "trips:close", "lrs:read", "lrs:create", "lrs:update",
            "finance:read", "finance:update", "payments:read", "payments:create",
        ]
        _request("POST", f"/sites/{site_id}/manager", owner, json={
            "name": "E2E Site Manager", "username": manager_username,
            "password": manager_password, "permissions": permissions,
        })
        manager_token = _login(manager_username, manager_password)
        listed_sites = _request("GET", "/sites", manager_token).json()
        assert any(row["id"] == site_id for row in listed_sites)

        resources = _request("GET", f"/sites/{site_id}/trip-resources", manager_token).json()
        vehicle = resources["vehicles"][0] if resources["vehicles"] else None
        driver = resources["drivers"][0] if resources["drivers"] else None
        trip = _request("POST", f"/sites/{site_id}/trips", manager_token, json={
            "operating_date": operating_date,
            "truck_no": vehicle["vehicle_no"] if vehicle else "E2E-TRUCK-1",
            "driver_name": driver["name"] if driver else "E2E Driver One",
            "vehicle_id": vehicle["id"] if vehicle else None,
            "driver_id": driver["id"] if driver else None,
        }).json()
        trip_id = trip["id"]
        assert trip["truck_no"] and trip["driver_name"]
        assert trip["status"] == "open"

        edited_trip = _request("PATCH", f"/sites/{site_id}/trips/{trip_id}", manager_token, json={
            "truck_no": "E2E-TRUCK-EDITED", "driver_name": "E2E Driver Edited",
            "vehicle_id": None, "driver_id": None,
        }).json()
        assert edited_trip["truck_no"] == "E2E-TRUCK-EDITED"
        assert edited_trip["driver_name"] == "E2E Driver Edited"
        owner_edited_trip = _request(
            "PATCH", f"/sites/{site_id}/trips/{trip_id}", owner,
            json={"truck_no": "E2E-TRUCK-OWNER-EDIT", "driver_name": "E2E Owner Driver Edit"},
        ).json()
        assert owner_edited_trip["truck_no"] == "E2E-TRUCK-OWNER-EDIT"
        assert owner_edited_trip["driver_name"] == "E2E Owner Driver Edit"

        created_lrs = []
        for index in (1, 2):
            created_lrs.append(_request(
                "POST", f"/sites/{site_id}/trips/{trip_id}/lrs", manager_token,
                json={
                    "sender_name": f"E2E Sender {index}",
                    "receiver_name": f"E2E Receiver {index}",
                    "goods_type": "E2E General Goods",
                    "containers": [
                        {"type": "E2E Box", "quantity": index},
                        {"type": "E2E Bag", "quantity": index + 1},
                    ],
                    "rent": str(index * 100), "hamali": str(index * 10),
                },
            ).json())
        assert [row["total_quantity"] for row in created_lrs] == [3, 5]

        first_lr = created_lrs[0]
        updated_lr = _request(
            "PATCH", f"/sites/{site_id}/trips/{trip_id}/lrs/{first_lr['id']}",
            manager_token, json={
                "sender_name": "E2E Sender Corrected",
                "containers": [{"type": "E2E Box", "quantity": 4}],
                "rent": "120.00", "hamali": "15.00",
                "idempotency_key": f"lr-update-{stamp}",
            },
        ).json()
        assert updated_lr["sender_name"] == "E2E Sender Corrected"
        assert updated_lr["total_quantity"] == 4
        assert updated_lr["rent"] == "120.00"
        assert updated_lr["hamali"] == "15.00"

        payment = _request(
            "POST", f"/sites/{site_id}/trips/{trip_id}/lrs/{first_lr['id']}/payments",
            manager_token, json={
                "amount": "30.00", "date": operating_date, "method": "Cash",
                "reference": f"e2e-{stamp}", "idempotency_key": f"payment-{stamp}",
            },
        ).json()
        assert payment["posting_status"] == "posted"

        ledger_csv = _request(
            "GET", f"/sites/{site_id}/trips/{trip_id}/ledger/import-template", owner,
        ).content
        rows = list(csv.reader(io.StringIO(ledger_csv.decode("utf-8-sig"), newline="")))
        columns = rows[2]
        first_row = next(row for row in rows[3:] if row[columns.index("lr_id")] == first_lr["id"])
        first_row[columns.index("rent")] = "125.00"
        first_row[columns.index("hamali")] = "17.00"
        first_row[columns.index("paid_total")] = "40.00"
        first_row[columns.index("payment_date")] = operating_date
        first_row[columns.index("payment_method")] = "Cash"
        rows[3:] = [first_row if row[columns.index("lr_id")] == first_lr["id"] else row
                    for row in rows[3:]]
        output = io.StringIO(newline="")
        csv.writer(output, lineterminator="\r\n").writerows(rows)
        preview = _request(
            "POST", f"/sites/{site_id}/trips/{trip_id}/ledger-imports", owner,
            files={"file": ("e2e-ledger.csv", output.getvalue().encode("utf-8"), "text/csv")},
        ).json()
        assert preview["status"] == "preview", preview
        committed = _request(
            "POST",
            f"/sites/{site_id}/trips/{trip_id}/ledger-imports/{preview['id']}/commit",
            owner, json={
                "confirm": True,
                "acknowledged_missing_lr_ids": preview["summary"]["missing_lr_ids"],
            },
        ).json()
        assert committed["status"] == "applied"

        saved_lr = _request(
            "GET", f"/sites/{site_id}/trips/{trip_id}/lrs/{first_lr['id']}", owner,
        ).json()
        assert saved_lr["rent"] == "125.00"
        assert saved_lr["hamali"] == "17.00"
        assert saved_lr["paid_total"] == "40.00"
        assert saved_lr["payment_status"] == "partial"
        assert len(saved_lr["payments"]) == 2

        goods_ledger = _request(
            "GET", f"/sites/{site_id}/trips/{trip_id}/ledger/goods", owner,
        ).content.decode("utf-8-sig")
        assert "E2E General Goods" in goods_ledger
        receiver_ledger = _request(
            "GET", f"/sites/{site_id}/trips/{trip_id}/ledger/receivers", owner,
        ).content.decode("utf-8-sig")
        assert "E2E Receiver 1" in receiver_ledger
        dashboard = _request(
            "GET", "/sites/system-dashboard",
            owner, params={"site_id": site_id, "trip_id": trip_id,
                           "from_date": operating_date, "to_date": operating_date},
        ).json()
        assert dashboard["sites"][0]["total_lrs"] == 2
        assert dashboard["sites"][0]["collected_bhada"] == "40.00"
    finally:
        if manager_token and site_id:
            _request("DELETE", f"/sites/managers/{manager_username}", owner)
        if site_id:
            _request("PUT", f"/sites/{site_id}", owner, json={"status": "Inactive"})
