import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, Fuel, Plus } from "lucide-react";
import { useMaster } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import { exportCSV } from "../lib/export";
import MasterForm from "../components/MasterForm";
import {
  Badge, Btn, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, SearchBox, Tabs,
} from "../components/ui";

const DOCS = [["rc", "RC"], ["insurance", "Insurance"], ["permit", "Permit"], ["fitness", "Fitness"], ["puc", "PUC"]];

const docState = (expiry) => {
  if (!expiry) return "Missing";
  const days = Math.round((new Date(expiry) - new Date()) / 86400000);
  return days < 0 ? "Expired" : days <= 45 ? "Expiring Soon" : "Valid";
};

export default function Vehicles() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "vehicles";
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null); // {res, item}

  const vehicles = useMaster("vehicles", { q });
  const pumps = useMaster("fuel_pumps", { q: tab === "pumps" ? q : "" });

  const docRows = (vehicles.data || []).flatMap((v) =>
    DOCS.map(([k, l]) => ({
      id: `${v.id}-${k}`, vehicle_id: v.id, vehicle_no: v.vehicle_no, doc: l,
      number: v.documents?.[k]?.number || "—", expiry: v.documents?.[k]?.expiry || "",
      state: docState(v.documents?.[k]?.expiry),
    }))).filter((r) => r.state !== "Missing" || r.number !== "—");

  return (
    <div>
      <PageHead title="Vehicles" subtitle="Fleet, documents and fuel pumps"
        actions={
          <>
            <Btn variant="s" icon={Download} onClick={() => exportCSV("vehicles",
              [{ key: "vehicle_no", label: "Vehicle" }, { key: "vehicle_type", label: "Type" },
               { key: "status", label: "Status" }, { key: "base_location", label: "Base" }],
              vehicles.data || [])}>Export</Btn>
            {tab === "pumps"
              ? <Btn icon={Fuel} data-testid="add-pump" onClick={() => setForm({ res: "fuel_pumps" })}>Add Fuel Pump</Btn>
              : <Btn icon={Plus} data-testid="add-vehicle" onClick={() => setForm({ res: "vehicles" })}>Add Vehicle</Btn>}
          </>
        } />

      <Tabs value={tab} onChange={(v) => setSp({ tab: v })}
        tabs={[{ value: "vehicles", label: "Fleet", count: (vehicles.data || []).length },
               { value: "documents", label: "Documents" },
               { value: "pumps", label: "Fuel Pumps", count: (pumps.data || []).length }]} />

      <Card className="mb-4 p-3.5"><SearchBox value={q} onChange={setQ} placeholder="Vehicle number, make, pump name…" /></Card>

      <Card className="overflow-hidden">
        {tab === "vehicles" && (
          vehicles.loading && !vehicles.data ? <Loader /> : vehicles.error ? <ErrorState text={vehicles.error} onRetry={vehicles.reload} /> : (
            <DataTable testid="vehicles-table"
              columns={[
                { key: "vehicle_no", label: "Vehicle No", strong: true },
                { key: "vehicle_type", label: "Type" },
                { key: "make", label: "Make" },
                { key: "model", label: "Model" },
                { key: "current_driver_name", label: "Current Driver" },
                { key: "trip", label: "Current Trip", render: (r) => r.current_trip?.trip_no || "—" },
                { key: "base_location", label: "Base" },
                { key: "status", label: "Status", type: "badge" },
              ]}
              rows={vehicles.data || []} onRowClick={(r) => nav(`/vehicles/${r.id}`)}
              empty={<EmptyState title="No vehicles yet" text="Add your first truck to start creating trips."
                action={<Btn onClick={() => setForm({ res: "vehicles" })}>Add Vehicle</Btn>} />}
              mobile={(r) => (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-head font-bold">{r.vehicle_no}</span><Badge>{r.status}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{[r.vehicle_type, r.make, r.model].filter(Boolean).join(" · ") || "—"}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {r.current_trip ? `On ${r.current_trip.trip_no} · ${r.current_driver_name || ""}` : r.base_location || "Idle"}
                  </p>
                </div>
              )} />
          ))}

        {tab === "documents" && (
          <DataTable testid="docs-table"
            columns={[
              { key: "vehicle_no", label: "Vehicle", strong: true },
              { key: "doc", label: "Document" },
              { key: "number", label: "Number" },
              { key: "expiry", label: "Expiry", type: "date" },
              { key: "state", label: "Status", type: "badge" },
            ]}
            rows={docRows.sort((a, b) => (a.expiry || "9") > (b.expiry || "9") ? 1 : -1)}
            onRowClick={(r) => nav(`/vehicles/${r.vehicle_id}`)}
            empty={<EmptyState title="No documents added" text="Open a vehicle and add RC, insurance, permit, fitness and PUC dates." />}
            mobile={(r) => (
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-semibold">{r.vehicle_no} · {r.doc}</p>
                  <p className="text-[12.5px] text-muted">{r.number} · {dmy(r.expiry)}</p></div>
                <Badge>{r.state}</Badge>
              </div>
            )} />
        )}

        {tab === "pumps" && (
          pumps.loading && !pumps.data ? <Loader /> : (
            <DataTable testid="pumps-table"
              columns={[
                { key: "name", label: "Fuel Pump", strong: true },
                { key: "location", label: "Location" },
                { key: "contact", label: "Contact" },
                { key: "balance", label: "Outstanding", right: true, render: (r) => <span className="num">{money(-(r.balance || 0))}</span> },
                { key: "status", label: "Status", type: "badge" },
              ]}
              rows={pumps.data || []} onRowClick={(r) => setForm({ res: "fuel_pumps", item: r })}
              empty={<EmptyState title="No fuel pumps" text="Add the pumps where you fill diesel on credit."
                action={<Btn onClick={() => setForm({ res: "fuel_pumps" })}>Add Fuel Pump</Btn>} />}
              mobile={(r) => (
                <div className="flex items-center justify-between gap-3">
                  <div><p className="font-semibold">{r.name}</p><p className="text-[12.5px] text-muted">{r.location || "—"}</p></div>
                  <p className="num font-semibold text-amber-600">{money(-(r.balance || 0))}</p>
                </div>
              )} />
          ))}
      </Card>

      {form && (
        <MasterForm res={form.res} item={form.item} open onClose={() => setForm(null)}
          onDone={() => { vehicles.reload(); pumps.reload(); }} />
      )}
    </div>
  );
}
