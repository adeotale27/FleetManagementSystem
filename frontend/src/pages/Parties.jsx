import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import { useMaster } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import { exportCSV } from "../lib/export";
import MasterForm from "../components/MasterForm";
import {
  Btn, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, SearchBox, Stat,
} from "../components/ui";

export default function Parties() {
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const nav = useNavigate();
  const parties = useMaster("parties", { q });
  const rows = parties.data || [];
  const totalOut = rows.reduce((s, r) => s + Math.max(r.balance || 0, 0), 0);

  return (
    <div>
      <PageHead title="Parties" subtitle="Customers, their LRs, payments and ledger"
        actions={
          <>
            <Btn variant="s" icon={Download} onClick={() => exportCSV("parties",
              [{ key: "name", label: "Party" }, { key: "mobile", label: "Mobile" },
               { key: "city", label: "City" }, { key: "balance", label: "Outstanding" }], rows)}>Export</Btn>
            <Btn icon={Plus} data-testid="add-party" onClick={() => setForm({})}>Add Party</Btn>
          </>
        } />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Parties" value={rows.length} sub="In this view" />
        <Stat label="Outstanding" value={money(totalOut)} tone="text-brand-600" sub="Receivables due" />
        <Stat label="With Balance" value={rows.filter((r) => (r.balance || 0) > 0.5).length} sub="Open balances" />
        <Stat label="Settled" value={rows.filter((r) => Math.abs(r.balance || 0) <= 0.5).length} sub="No balance due" />
      </div>

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox value={q} onChange={setQ} placeholder="Party name, mobile, city…" />
          <span className="px-1 text-[12px] font-medium text-muted sm:whitespace-nowrap">
            {rows.length} {rows.length === 1 ? "party" : "parties"} shown
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {parties.loading && !parties.data ? <Loader /> : parties.error ? <ErrorState text={parties.error} onRetry={parties.reload} /> : (
          <DataTable testid="parties-table"
            columns={[
              { key: "name", label: "Party Name", strong: true },
              { key: "mobile", label: "Mobile" },
              { key: "city", label: "Location" },
              { key: "balance", label: "Outstanding", type: "money", right: true },
              { key: "last_txn_date", label: "Last Activity", type: "date" },
              { key: "status", label: "Status", type: "badge" },
            ]}
            rows={rows} onRowClick={(r) => nav(`/parties/${r.id}`)}
            empty={<EmptyState
              title={q.trim() ? "No matching parties" : "No parties yet"}
              text={q.trim()
                ? "Try another name, mobile number or city, or clear your search."
                : "Parties are saved automatically when you create an LR — or add one now."}
              action={q.trim()
                ? <Btn variant="s" onClick={() => setQ("")}>Clear Search</Btn>
                : <Btn onClick={() => setForm({})}>Add Party</Btn>} />}
            mobile={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{r.mobile || "No mobile"} · {r.city || "Location not set"}</p>
                  <p className="mt-1 text-[12px] text-muted">Last activity: {dmy(r.last_txn_date)}</p>
                  <p className="mt-1 text-[12px] font-medium text-muted">{r.status || "Status unavailable"}</p>
                </div>
                <p className={`num shrink-0 font-semibold ${(r.balance || 0) > 0.5 ? "text-brand-600" : "text-muted"}`}>
                  {money(r.balance)}
                </p>
              </div>
            )} />
        )}
      </Card>

      {form && <MasterForm res="parties" open onClose={() => setForm(null)} onDone={parties.reload} />}
    </div>
  );
}
