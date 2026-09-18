import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Fuel, Pencil, Receipt } from "lucide-react";
import { useFetch } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import MasterForm from "../components/MasterForm";
import EntryModal from "../components/QuickForms";
import {
  Badge, Btn, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, Stat, Tabs,
} from "../components/ui";

const DOCS = [["rc", "RC"], ["insurance", "Insurance"], ["permit", "Permit"], ["fitness", "Fitness"], ["puc", "PUC"]];
const docState = (e) => {
  if (!e) return "Missing";
  const d = Math.round((new Date(e) - new Date()) / 86400000);
  return d < 0 ? "Expired" : d <= 45 ? "Expiring Soon" : "Valid";
};

export default function VehicleDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useFetch(`/profile/vehicle/${id}`);
  const [tab, setTab] = useState("trips");
  const [edit, setEdit] = useState(false);
  const [entry, setEntry] = useState(null);

  if (loading && !data) return <Loader />;
  if (error) return <ErrorState text={error} onRetry={reload} />;
  const v = data.vehicle;

  return (
    <div>
      <PageHead title={v.vehicle_no} back="/vehicles"
        subtitle={[v.vehicle_type, v.make, v.model, v.base_location].filter(Boolean).join(" · ")}
        actions={
          <>
            <Btn variant="s" icon={Receipt} onClick={() => setEntry("expense")} data-testid="veh-add-expense">Add Expense</Btn>
            <Btn variant="s" icon={Fuel} onClick={() => setEntry("fuel")} data-testid="veh-add-fuel">Add Diesel</Btn>
            <Btn icon={Pencil} onClick={() => setEdit(true)} data-testid="veh-edit">Edit</Btn>
          </>
        } />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Status" value={<Badge>{v.status}</Badge>} />
        <Stat label="Total Trips" value={data.totals.trips} />
        <Stat label="Diesel Spend" value={money(data.totals.fuel)} />
        <Stat label="Litres" value={data.totals.litres || "—"} />
        <Stat label="Other Expenses" value={money(data.totals.expense)} />
      </div>

      {data.current_trip && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-brand-400 bg-brand-50/50 p-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-brand-600">Currently on trip</p>
            <p className="mt-1 font-head text-[16px] font-bold">{data.current_trip.trip_no} · {data.current_trip.from_name} → {data.current_trip.to_name}</p>
            <p className="text-[13px] text-muted">{data.current_trip.driver_name} · {dmy(data.current_trip.start_date)}</p>
          </div>
          <Btn variant="s" onClick={() => nav(`/trips/${data.current_trip.id}`)}>Open Trip</Btn>
        </Card>
      )}

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "trips", label: "Trip History", count: data.trips.length },
        { value: "fuel", label: "Diesel", count: data.fuel.length },
        { value: "expenses", label: "Expenses", count: data.expenses.length },
        { value: "docs", label: "Documents" },
      ]} />

      <Card className="overflow-hidden">
        {tab === "trips" && (
          <DataTable testid="veh-trips"
            columns={[
              { key: "trip_no", label: "Trip", strong: true },
              { key: "start_date", label: "Date", type: "date" },
              { key: "route", label: "Route", render: (r) => `${r.from_name} → ${r.to_name}` },
              { key: "driver_name", label: "Driver" },
              { key: "trip_amount", label: "Amount", type: "money", right: true },
              { key: "status", label: "Status", type: "badge" },
            ]} rows={data.trips} onRowClick={(r) => nav(`/trips/${r.id}`)}
            empty={<EmptyState title="No trips yet" />} />
        )}
        {tab === "fuel" && (
          <DataTable testid="veh-fuel"
            columns={[
              { key: "date", label: "Date", type: "date" },
              { key: "pump_name", label: "Fuel Pump" },
              { key: "quantity", label: "Litres", right: true },
              { key: "rate", label: "Rate", type: "money", right: true },
              { key: "amount", label: "Amount", type: "money", right: true },
              { key: "odometer", label: "Odometer", right: true },
              { key: "mode", label: "Payment" },
            ]} rows={data.fuel} empty={<EmptyState title="No diesel entries" />} />
        )}
        {tab === "expenses" && (
          <DataTable testid="veh-expenses"
            columns={[
              { key: "date", label: "Date", type: "date" },
              { key: "category", label: "Category", strong: true },
              { key: "vendor", label: "Vendor" },
              { key: "mode", label: "Mode" },
              { key: "remarks", label: "Remarks" },
              { key: "amount", label: "Amount", type: "money", right: true },
            ]} rows={data.expenses} empty={<EmptyState title="No expenses" />} />
        )}
        {tab === "docs" && (
          <DataTable testid="veh-docs"
            columns={[
              { key: "doc", label: "Document", strong: true },
              { key: "number", label: "Number" },
              { key: "expiry", label: "Expiry", type: "date" },
              { key: "state", label: "Status", type: "badge" },
            ]}
            rows={DOCS.map(([k, l]) => ({
              id: k, doc: l, number: v.documents?.[k]?.number || "—",
              expiry: v.documents?.[k]?.expiry, state: docState(v.documents?.[k]?.expiry),
            }))}
            empty={<EmptyState title="No documents" />} />
        )}
      </Card>

      <MasterForm res="vehicles" item={v} open={edit} onClose={() => setEdit(false)} onDone={reload} />
      <EntryModal kind={entry || "expense"} open={!!entry} onClose={() => setEntry(null)} onDone={reload}
        preset={{ vehicle_id: id, vehicle_no: v.vehicle_no }} />
    </div>
  );
}
