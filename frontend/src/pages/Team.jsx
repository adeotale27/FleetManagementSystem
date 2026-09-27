import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HandCoins, Plus } from "lucide-react";
import { useMaster } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import MasterForm from "../components/MasterForm";
import EntryModal from "../components/QuickForms";
import {
  Badge, Btn, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, SearchBox, Stat, Tabs,
} from "../components/ui";

export default function Team() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "drivers";
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [entry, setEntry] = useState(false);

  const drivers = useMaster("drivers", { q: tab === "drivers" ? q : "" });
  const team = useMaster("team", { q: tab === "team" ? q : "" });
  const cur = tab === "drivers" ? drivers : team;
  const rows = cur.data || [];

  return (
    <div>
      <PageHead title="Team" subtitle="Drivers, office staff and their advances"
        actions={
          <>
            <Btn icon={HandCoins} data-testid="add-advance" onClick={() => setEntry(true)}>Advance / Repayment</Btn>
            <Btn icon={Plus} data-testid="add-person" onClick={() => setForm({ res: tab === "drivers" ? "drivers" : "team" })}>
              Add {tab === "drivers" ? "Driver" : "Team Member"}
            </Btn>
          </>
        } />

      <Tabs value={tab} onChange={(v) => setSp({ tab: v })}
        tabs={[{ value: "drivers", label: "Drivers", count: (drivers.data || []).length },
               { value: "team", label: "Office Team", count: (team.data || []).length }]} />

      <div className="mb-3">
        <h2 className="font-head text-[17px] font-bold text-ink">{tab === "drivers" ? "Driver roster" : "Office team"}</h2>
        <p className="text-[13px] text-muted">
          {tab === "drivers" ? "Review assignments, licence dates and advances." : "Manage staff details, salaries and advances."}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={tab === "drivers" ? "Total Drivers" : "Team Members"} value={rows.length} sub="In this view" />
        <Stat label="On Trip" value={rows.filter((r) => r.current_trip).length} sub="Currently assigned" />
        <Stat label="Outstanding Advance" value={money(rows.reduce((s, r) => s + Math.max(r.balance || 0, 0), 0))} tone="text-amber-600" sub="Balance to recover" />
        <Stat label="Active" value={rows.filter((r) => r.status !== "Inactive").length} sub="Available for work" />
      </div>

      <Card className="mb-4 p-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox value={q} onChange={setQ} placeholder={tab === "drivers" ? "Name, mobile, licence…" : "Name, mobile, role…"} />
          <span className="px-1 text-[12px] font-medium text-muted sm:whitespace-nowrap">
            {rows.length} {rows.length === 1 ? "record" : "records"} shown
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {cur.loading && !cur.data ? <Loader /> : cur.error ? <ErrorState text={cur.error} onRetry={cur.reload} /> : (
          <DataTable testid={`${tab}-table`}
            columns={tab === "drivers" ? [
              { key: "name", label: "Driver", strong: true },
              { key: "mobile", label: "Mobile" },
              { key: "licence_no", label: "Licence" },
              { key: "licence_expiry", label: "Licence Expiry", type: "date" },
              { key: "trip", label: "Current Trip", render: (r) => r.current_trip?.trip_no || "—" },
              { key: "balance", label: "Outstanding Advance", type: "money", right: true },
              { key: "status", label: "Status", type: "badge" },
            ] : [
              { key: "name", label: "Name", strong: true },
              { key: "role", label: "Role" },
              { key: "mobile", label: "Mobile" },
              { key: "salary", label: "Salary", type: "money", right: true },
              { key: "balance", label: "Outstanding Advance", type: "money", right: true },
              { key: "status", label: "Status", type: "badge" },
            ]}
            rows={rows}
            onRowClick={(r) => nav(tab === "drivers" ? `/drivers/${r.id}` : `/team/${r.id}`)}
            empty={<EmptyState
              title={q.trim() ? "No matching people" : `No ${tab === "drivers" ? "drivers" : "team members"} yet`}
              text={q.trim()
                ? "Try another name or contact detail, or clear your search."
                : "Add people so you can assign trips and track advances."}
              action={q.trim()
                ? <Btn variant="s" onClick={() => setQ("")}>Clear Search</Btn>
                : <Btn onClick={() => setForm({ res: tab === "drivers" ? "drivers" : "team" })}>Add</Btn>} />}
            mobile={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{r.mobile || "No mobile"} · {r.role || r.licence_no || "Details not set"}</p>
                  {r.current_trip
                    ? <p className="mt-1 text-[12px] font-semibold text-brand-600">On trip · {r.current_trip.trip_no}</p>
                    : tab === "drivers" && <p className="mt-1 text-[12px] text-muted">No current trip</p>}
                  {tab === "drivers" && r.licence_expiry && <p className="mt-1 text-[12px] text-muted">Licence till {dmy(r.licence_expiry)}</p>}
                </div>
                <div className="shrink-0 space-y-1.5 text-right">
                  <p className="num font-semibold text-amber-600">{money(r.balance)}</p>
                  <Badge>{r.status || "Unknown"}</Badge>
                </div>
              </div>
            )} />
        )}
      </Card>

      {form && <MasterForm res={form.res} open onClose={() => setForm(null)} onDone={() => { drivers.reload(); team.reload(); }} />}
      <EntryModal kind="advance" open={entry} onClose={() => setEntry(false)}
        onDone={() => { drivers.reload(); team.reload(); }}
        preset={{ entity_type: tab === "drivers" ? "driver" : "employee" }} />
    </div>
  );
}
