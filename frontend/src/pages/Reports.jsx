import React, { useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { useFetch, useMaster, opts } from "../lib/hooks";
import { money, dmy, monthStart, todayISO } from "../lib/format";
import { exportCSV, exportExcel, exportPDF } from "../lib/export";
import {
  Btn, Card, DataTable, EmptyState, ErrorState, Input, Loader, PageHead, SearchBox, Select,
} from "../components/ui";

const REPORTS = [
  { v: "trips", l: "Trip Report" },
  { v: "lrs", l: "LR Report" },
  { v: "vehicles", l: "Vehicle Report" },
  { v: "drivers", l: "Driver Report" },
  { v: "party_ledger", l: "Party Ledger" },
  { v: "receivables", l: "Receivable Report" },
  { v: "payables", l: "Payable Report" },
  { v: "collections", l: "Collection Report" },
  { v: "deewanji", l: "Deewanji Collection Report" },
  { v: "expenses", l: "Expense Report" },
  { v: "fuel", l: "Fuel Report" },
  { v: "employee_ledger", l: "Employee Ledger" },
  { v: "driver_advances", l: "Driver Advance Report" },
  { v: "tpl", l: "3PL Report" },
  { v: "cashflow", l: "Cash Flow Report" },
];

export default function Reports() {
  const [name, setName] = useState("trips");
  const [f, setF] = useState({ frm: monthStart(), to: todayISO(), q: "", entity_id: "" });
  const parties = useMaster(name === "party_ledger" ? "parties" : null);
  const { data, loading, error, reload } = useFetch(`/reports/${name}`, f);

  const label = REPORTS.find((r) => r.v === name)?.l || "Report";
  const rows = data?.rows || [];
  const cols = data?.columns || [];
  const flat = rows.map((r) => {
    const o = {};
    cols.forEach((c) => { o[c.key] = c.type === "date" ? dmy(r[c.key]) : r[c.key] ?? ""; });
    return o;
  });
  const meta = `${dmy(f.frm)} to ${dmy(f.to)} · ${rows.length} records`;

  return (
    <div>
      <PageHead title="Reports" subtitle="Filter, view and export any part of your business"
        actions={
          <>
            <Btn variant="s" icon={Download} data-testid="rep-csv" onClick={() => exportCSV(name, cols, flat)}>CSV</Btn>
            <Btn variant="s" onClick={() => exportExcel(name, cols, flat)}>Excel</Btn>
            <Btn variant="s" icon={FileText} data-testid="rep-pdf" onClick={() => exportPDF(label, cols, flat, meta)}>PDF</Btn>
            <Btn variant="s" icon={Printer} onClick={() => exportPDF(label, cols, flat, meta)}>Print</Btn>
          </>
        } />

      <div className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0">
        {REPORTS.map((r) => (
          <button key={r.v} data-testid={`report-${r.v}`} onClick={() => setName(r.v)}
            className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
              name === r.v ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white text-muted hover:text-ink"}`}>
            {r.l}
          </button>
        ))}
      </div>

      <Card className="mb-4 p-3.5">
        <div className="grid gap-3 md:grid-cols-4">
          <Input label="From" type="date" value={f.frm} onChange={(e) => setF({ ...f, frm: e.target.value })} data-testid="rep-from" />
          <Input label="To" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} data-testid="rep-to" />
          {name === "party_ledger" && (
            <Select label="Party (optional)" value={f.entity_id} onChange={(e) => setF({ ...f, entity_id: e.target.value })}
              options={opts(parties.data)} placeholder="All parties — summary" data-testid="rep-party" />
          )}
          <div className="flex items-end"><SearchBox value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Search in report…" testid="rep-search" /></div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div><h3 className="font-head text-[16px] font-bold">{label}</h3><p className="text-[12.5px] text-muted">{meta}</p></div>
          {data?.totals && (
            <div className="flex flex-wrap gap-4">
              {Object.entries(data.totals).map(([k, v]) => (
                <div key={k} className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{k.replace(/_/g, " ")}</p>
                  <p className="num font-head text-[16px] font-bold">{typeof v === "number" ? money(v) : v}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {loading && !data ? <Loader /> : error ? <ErrorState text={error} onRetry={reload} /> : (
          <DataTable testid="report-table"
            columns={cols.map((c) => ({ ...c, right: c.type === "money", strong: c.key === cols[0]?.key }))}
            rows={rows} empty={<EmptyState title="No data for these filters" text="Try a wider date range." />} />
        )}
      </Card>
    </div>
  );
}
