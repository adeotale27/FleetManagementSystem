import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import ledger
import server


class AsyncRows:
    def __init__(self, rows=()):
        self.rows = list(rows)

    def __aiter__(self):
        async def iterate():
            for row in self.rows:
                yield row

        return iterate()


class QueryCursor:
    def __init__(self, rows=()):
        self.rows = list(rows)

    def sort(self, *_args):
        return self

    async def to_list(self, _limit):
        return self.rows


class CapturingCollection:
    def __init__(self):
        self.aggregations = []
        self.queries = []

    def aggregate(self, pipeline):
        self.aggregations.append(pipeline)
        return AsyncRows()

    def find(self, query):
        self.queries.append(query)
        return QueryCursor()


def _site_scope():
    return {"$exists": False}


def test_ledger_read_models_exclude_site_postings(monkeypatch):
    ledger_rows = CapturingCollection()
    cashbook_rows = CapturingCollection()
    monkeypatch.setattr(
        ledger, "db", SimpleNamespace(ledger=ledger_rows, cashbook=cashbook_rows),
    )

    asyncio.run(ledger.balances("party"))
    asyncio.run(ledger.statement("party", "party-1"))
    asyncio.run(ledger.cash_position())
    asyncio.run(ledger.deewanji_cash())

    assert ledger_rows.aggregations[0][0]["$match"]["site_id"] == _site_scope()
    assert ledger_rows.queries[0]["site_id"] == _site_scope()
    assert cashbook_rows.aggregations[0][0]["$match"]["site_id"] == _site_scope()
    assert cashbook_rows.aggregations[1][0]["$match"]["site_id"] == _site_scope()


def test_industrial_expense_list_and_totals_exclude_site_expenses(monkeypatch):
    expenses = CapturingCollection()

    class Database:
        def __init__(self, expense_collection):
            self.expenses = expense_collection

        def __getitem__(self, name):
            return getattr(self, name)

    monkeypatch.setattr(server, "db", Database(expenses))

    asyncio.run(server.list_expenses(u={"role": "owner"}))
    asyncio.run(server.sum_coll("expenses", {}))

    assert expenses.queries[0]["cancelled"] is False
    assert expenses.queries[0]["site_id"] == _site_scope()
    assert expenses.aggregations[0][0]["$match"]["site_id"] == _site_scope()


def test_industrial_trip_cost_aggregation_scopes_shared_expenses(monkeypatch):
    collections = {
        name: CapturingCollection() for name in ("lrs", "expenses", "fuel")
    }

    class Database:
        def __getitem__(self, name):
            return collections[name]

        def __getattr__(self, name):
            return collections[name]

    monkeypatch.setattr(server, "db", Database())

    asyncio.run(server._trip_financial_totals(["trip-1"]))

    expense_match = collections["expenses"].aggregations[0][0]["$match"]
    fuel_match = collections["fuel"].aggregations[0][0]["$match"]
    assert expense_match["site_id"] == _site_scope()
    assert "site_id" not in fuel_match


def test_industrial_cashbook_and_chart_queries_exclude_site_postings(monkeypatch):
    cashbook = CapturingCollection()
    expenses = CapturingCollection()
    receipts = CapturingCollection()

    class Database:
        def __init__(self):
            self.cashbook = cashbook
            self.expenses = expenses
            self.receipts = receipts

    async def empty_cash_position():
        return {"cash": 0, "bank": 0, "deewanji": 0}

    async def no_total(*_args):
        return 0

    async def no_receivables(_user):
        return {"buckets": {}}

    async def no_payables(_user):
        return {"rows": []}

    monkeypatch.setattr(server, "db", Database())
    monkeypatch.setattr(server, "cash_position", empty_cash_position)
    monkeypatch.setattr(server, "sum_coll", no_total)
    monkeypatch.setattr(server, "finance_receivables", no_receivables)
    monkeypatch.setattr(server, "finance_payables", no_payables)

    asyncio.run(server.finance_cashbook(u={"role": "owner"}))
    asyncio.run(server.finance_charts(days=1, u={"role": "owner"}))

    assert cashbook.queries[0]["site_id"] == _site_scope()
    assert cashbook.aggregations[0][0]["$match"]["site_id"] == _site_scope()
    assert expenses.aggregations[0][0]["$match"]["site_id"] == _site_scope()


def test_site_expense_cannot_be_cancelled_through_industrial_endpoint(monkeypatch):
    class Expenses:
        async def find_one(self, query):
            self.query = query
            return None

    expenses = Expenses()
    reversed_postings = []

    async def reverse(ref_type, ref_id):
        reversed_postings.append((ref_type, ref_id))

    monkeypatch.setattr(server, "db", SimpleNamespace(expenses=expenses))
    monkeypatch.setattr(server.L, "reverse", reverse)

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.cancel_expense("site-expense-1", u={"role": "owner"}))

    assert error.value.status_code == 404
    assert expenses.query["site_id"] == _site_scope()
    assert reversed_postings == []
