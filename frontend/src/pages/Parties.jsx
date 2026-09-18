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

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Parties" value={rows.length} />
        <Stat label="Outstanding" value={money(totalOut)} tone="text-brand-600" />
        <Stat label="With Balance" value={rows.filter((r) => (r.balance || 0) > 0.5).length} />
        <Stat label="Settled" value={rows.filter((r) => Math.abs(r.balance || 0) <= 0.5).length} />
      </div>

      <Card className="mb-4 p-3.5"><SearchBox value={q} onChange={setQ} placeholder="Party name, mobile, city…" /></Card>

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
            empty={<EmptyState title="No parties yet"
              text="Parties are saved automatically when you create an LR — or add one now."
              action={<Btn onClick={() => setForm({})}>Add Party</Btn>} />}
            mobile={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-[12.5px] text-muted">{r.mobile || "no mobile"} · {r.city || "—"}</p>
                  <p className="text-[12px] text-muted">Last: {dmy(r.last_txn_date)}</p>
                </div>
                <p className="num font-semibold text-brand-600">{money(r.balance)}</p>
              </div>
            )} />
        )}
      </Card>

      {form && <MasterForm res="parties" open onClose={() => setForm(null)} onDone={parties.reload} />}
    </div>
  );
}
