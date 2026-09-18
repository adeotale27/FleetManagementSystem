import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, HandCoins, Pencil } from "lucide-react";
import { useFetch } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import { exportCSV } from "../lib/export";
import MasterForm from "../components/MasterForm";
import EntryModal from "../components/QuickForms";
import {
  Badge, Btn, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, Stat, Tabs,
} from "../components/ui";

const LEDGER_COLS = [
  { key: "date", label: "Date", type: "date" },
  { key: "description", label: "Description", strong: true },
  { key: "debit", label: "Given", type: "money", right: true },
  { key: "credit", label: "Returned", type: "money", right: true },
  { key: "balance", label: "Outstanding", type: "money", right: true },
];

export default function PersonDetail({ kind }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useFetch(`/profile/${kind}/${id}`);
  const [tab, setTab] = useState(kind === "driver" ? "trips" : "ledger");
  const [edit, setEdit] = useState(false);
  const [entry, setEntry] = useState(false);

  if (loading && !data) return <Loader />;
  if (error) return <ErrorState text={error} onRetry={reload} />;
  const p = kind === "driver" ? data.driver : data.employee;

  return (
    <div>
      <PageHead title={p.name} back={kind === "driver" ? "/team" : "/team?tab=team"}
        subtitle={[p.mobile, p.role, p.licence_no && `Licence ${p.licence_no}`].filter(Boolean).join(" · ") || "No details yet"}
        actions={
          <>
            <Btn icon={HandCoins} data-testid="person-advance" onClick={() => setEntry(true)}>Advance / Repayment</Btn>
            <Btn variant="s" icon={Pencil} onClick={() => setEdit(true)}>Edit</Btn>
          </>
        } />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Status" value={<Badge>{p.status || "Active"}</Badge>} />
        <Stat testid="person-outstanding" label="Outstanding Advance" value={money(data.outstanding)} tone="text-amber-600" />
        {kind === "driver" ? (
          <>
            <Stat label="Total Trips" value={data.trips.length} />
            <Stat label="Licence Expiry" value={dmy(p.licence_expiry)} />
          </>
        ) : (
          <>
            <Stat label="Monthly Salary" value={money(p.salary)} />
            <Stat label="Salary Paid" value={money(data.salary_paid)} sub={data.cash_with ? `Cash in hand ${money(data.cash_with)}` : ""} />
          </>
        )}
      </div>

      {data.current_trip && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-brand-400 bg-brand-50/50 p-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-brand-600">On trip now</p>
            <p className="mt-1 font-head text-[16px] font-bold">{data.current_trip.trip_no} · {data.current_trip.from_name} → {data.current_trip.to_name}</p>
            <p className="text-[13px] text-muted">{data.current_trip.vehicle_no}</p>
          </div>
          <Btn variant="s" onClick={() => nav(`/trips/${data.current_trip.id}`)}>Open Trip</Btn>
        </Card>
      )}

      <Tabs value={tab} onChange={setTab} tabs={[
        ...(kind === "driver" ? [{ value: "trips", label: "Trips", count: data.trips.length }] : []),
        { value: "ledger", label: "Advance Ledger", count: data.ledger.length },
        { value: "entries", label: "Advance Entries", count: data.advances.length },
      ]} />

      <Card className="overflow-hidden">
        {tab === "trips" && (
          <DataTable testid="person-trips"
            columns={[
              { key: "trip_no", label: "Trip", strong: true },
              { key: "start_date", label: "Date", type: "date" },
              { key: "route", label: "Route", render: (r) => `${r.from_name} → ${r.to_name}` },
              { key: "vehicle_no", label: "Vehicle" },
              { key: "trip_amount", label: "Amount", type: "money", right: true },
              { key: "status", label: "Status", type: "badge" },
            ]} rows={data.trips} onRowClick={(r) => nav(`/trips/${r.id}`)}
            empty={<EmptyState title="No trips yet" />} />
        )}
        {tab === "ledger" && (
          <DataTable testid="person-ledger" columns={LEDGER_COLS} rows={data.ledger}
            empty={<EmptyState title="No advance given" text="Record an advance, loan or pre-salary to start the ledger." />}
            mobile={(r) => (
              <div>
                <div className="flex justify-between gap-3">
                  <span className="text-[13.5px] font-semibold">{r.description}</span>
                  <span className="num text-[13.5px] font-semibold">{r.debit ? `+${money(r.debit)}` : `-${money(r.credit)}`}</span>
                </div>
                <p className="mt-1 flex justify-between text-[12.5px] text-muted">
                  <span>{dmy(r.date)}</span><span className="num">Left {money(r.balance)}</span>
                </p>
              </div>
            )} />
        )}
        {tab === "entries" && (
          <DataTable testid="person-advances"
            columns={[
              { key: "date", label: "Date", type: "date" },
              { key: "kind", label: "Type", strong: true },
              { key: "amount", label: "Amount", type: "money", right: true },
              { key: "mode", label: "Mode" },
              { key: "remarks", label: "Remarks" },
            ]} rows={data.advances} empty={<EmptyState title="No entries" />} />
        )}
      </Card>

      <div className="mt-3 flex justify-end">
        <Btn variant="s" icon={Download} onClick={() => exportCSV(`${p.name}-ledger`, LEDGER_COLS,
          data.ledger.map((r) => ({ ...r, date: dmy(r.date) })))}>Export Ledger</Btn>
      </div>

      <MasterForm res={kind === "driver" ? "drivers" : "team"} item={p} open={edit} onClose={() => setEdit(false)} onDone={reload} />
      <EntryModal kind="advance" open={entry} onClose={() => setEntry(false)} onDone={reload}
        preset={{ entity_type: kind, entity_id: id }} />
    </div>
  );
}
