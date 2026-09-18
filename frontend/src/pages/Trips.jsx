import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download, FileText, Filter, Plus, Truck } from "lucide-react";
import { useFetch, useMaster, opts } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import { exportCSV, exportExcel, exportPDF } from "../lib/export";
import {
  Badge, Btn, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, SearchBox, Select, Tabs,
} from "../components/ui";

const STATUS = ["New", "Assigned", "Started", "In Transit", "Delivered", "Completed", "Cancelled"];

export default function Trips() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "trips";
  const nav = useNavigate();
  const [showF, setShowF] = useState(false);
  const [f, setF] = useState({ q: "", status: sp.get("status") || "", vehicle_id: "", driver_id: "", route_id: "", mode: "", trip_type: "", frm: "", to: "" });
  const [lf, setLf] = useState({ q: "", payment_status: "", frm: "", to: "" });

  const vehicles = useMaster("vehicles");
  const drivers = useMaster("drivers");
  const settings = useFetch("/settings");
  const trips = useFetch(tab === "trips" ? "/trips" : null, f);
  const lrs = useFetch(tab === "lrs" ? "/lrs" : null, lf);

  const setTab = (v) => setSp({ tab: v });

  const tripCols = [
    { key: "trip_no", label: "Trip No", strong: true },
    { key: "start_date", label: "Date", type: "date" },
    { key: "mode", label: "Type", render: (r) => <span className="capitalize">{r.mode}</span> },
    { key: "from_name", label: "From" },
    { key: "to_name", label: "To" },
    { key: "vehicle_no", label: "Vehicle" },
    { key: "driver_name", label: "Driver" },
    { key: "trip_amount", label: "Amount", type: "money", right: true },
    { key: "lr_count", label: "LR", right: true },
    { key: "status", label: "Status", type: "badge" },
  ];

  const lrCols = [
    { key: "lr_no", label: "LR No", strong: true },
    { key: "date", label: "Date", type: "date" },
    { key: "sender", label: "Sender", render: (r) => r.sender?.name || "—" },
    { key: "receiver", label: "Receiver", render: (r) => r.receiver?.name || "—" },
    { key: "from_name", label: "From" },
    { key: "to_name", label: "To" },
    { key: "vehicle_no", label: "Vehicle" },
    { key: "freight", label: "Freight", type: "money", right: true },
    { key: "outstanding", label: "Pending", type: "money", right: true },
    { key: "payment_status", label: "Status", type: "badge" },
  ];

  const rows = tab === "trips" ? trips.data : lrs.data;
  const cur = tab === "trips" ? trips : lrs;

  const flat = (rs) => (rs || []).map((r) => ({
    ...r, sender: r.sender?.name, receiver: r.receiver?.name,
    start_date: dmy(r.start_date), date: dmy(r.date),
  }));

  return (
    <div>
      <PageHead title="Trips & LR" subtitle="Every trip and lorry receipt in one place"
        actions={
          <>
            <Btn variant="s" icon={Download} data-testid="export-btn"
              onClick={() => exportCSV(tab === "trips" ? "trips" : "lrs", tab === "trips" ? tripCols : lrCols, flat(rows))}>
              CSV
            </Btn>
            <Btn variant="s" icon={FileText} onClick={() => exportPDF(tab === "trips" ? "Trip Report" : "LR Report",
              tab === "trips" ? tripCols : lrCols, flat(rows), `${(rows || []).length} records`)}>PDF</Btn>
            <Btn icon={Plus} data-testid="new-lr-btn" variant="s" onClick={() => nav("/lrs/new")}>New LR</Btn>
            <Btn icon={Truck} data-testid="new-trip-btn" onClick={() => nav("/trips/new")}>New Trip</Btn>
          </>
        } />

      <Tabs value={tab} onChange={setTab}
        tabs={[{ value: "trips", label: "Trips" }, { value: "lrs", label: "Lorry Receipts" }]} />

      <Card className="mb-4 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {tab === "trips" ? (
            <SearchBox value={f.q} onChange={(v) => setF({ ...f, q: v })} placeholder="Trip no, vehicle, driver, party…" />
          ) : (
            <SearchBox value={lf.q} onChange={(v) => setLf({ ...lf, q: v })} placeholder="LR no, sender, vehicle, goods…" />
          )}
          <Btn variant="s" icon={Filter} onClick={() => setShowF((s) => !s)} data-testid="filter-btn">Filters</Btn>
        </div>
        {showF && (
          <div className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-4">
            {tab === "trips" ? (
              <>
                <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={STATUS} placeholder="All status" data-testid="filter-status" />
                <Select label="Trip Kind" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}
                  options={[{ value: "indoor", label: "Indoor" }, { value: "outdoor", label: "Outdoor" }]} placeholder="All" />
                <Select label="One Way / Round" value={f.trip_type} onChange={(e) => setF({ ...f, trip_type: e.target.value })}
                  options={["One Way", "Round Trip"]} placeholder="All" />
                <Select label="Route" value={f.route_id} onChange={(e) => setF({ ...f, route_id: e.target.value })}
                  options={(settings.data?.routes || []).map((r) => ({ value: r.id, label: r.name }))} placeholder="All routes" />
                <Select label="Vehicle" value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}
                  options={opts(vehicles.data, "vehicle_no")} placeholder="All vehicles" />
                <Select label="Driver" value={f.driver_id} onChange={(e) => setF({ ...f, driver_id: e.target.value })}
                  options={opts(drivers.data)} placeholder="All drivers" />
                <label className="block"><span className="lbl">From Date</span>
                  <input type="date" className="fld" value={f.frm} onChange={(e) => setF({ ...f, frm: e.target.value })} /></label>
                <label className="block"><span className="lbl">To Date</span>
                  <input type="date" className="fld" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
              </>
            ) : (
              <>
                <Select label="Payment" value={lf.payment_status} onChange={(e) => setLf({ ...lf, payment_status: e.target.value })}
                  options={["Pending", "Partial", "Paid"]} placeholder="All" />
                <label className="block"><span className="lbl">From Date</span>
                  <input type="date" className="fld" value={lf.frm} onChange={(e) => setLf({ ...lf, frm: e.target.value })} /></label>
                <label className="block"><span className="lbl">To Date</span>
                  <input type="date" className="fld" value={lf.to} onChange={(e) => setLf({ ...lf, to: e.target.value })} /></label>
              </>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {cur.loading && !rows ? <Loader /> : cur.error ? <ErrorState text={cur.error} onRetry={cur.reload} /> : (
          <DataTable
            testid={tab === "trips" ? "trips-table" : "lrs-table"}
            columns={tab === "trips" ? tripCols : lrCols} rows={rows || []}
            onRowClick={(r) => nav(tab === "trips" ? `/trips/${r.id}` : `/lrs/${r.id}`)}
            empty={<EmptyState title={tab === "trips" ? "No trips found" : "No LR found"}
              text={tab === "trips" ? "Create your first trip — it takes a few seconds." : "LRs are usually created from a trip."}
              action={<Btn onClick={() => nav(tab === "trips" ? "/trips/new" : "/lrs/new")}>
                {tab === "trips" ? "Create Trip" : "Create LR"}</Btn>} />}
            mobile={tab === "trips" ? (r) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-head font-bold">{r.trip_no}</span>
                  <Badge>{r.status}</Badge>
                </div>
                <p className="mt-1.5 text-[14px] font-medium">{r.from_name} → {r.to_name}</p>
                <p className="mt-1 text-[13px] text-muted">{dmy(r.start_date)} · {r.vehicle_no} · {r.driver_name || "No driver"}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[13px]">
                  <span className="num font-semibold">{money(r.trip_amount)}</span>
                  <span className="text-muted capitalize">{r.mode}</span>
                  {r.lr_count > 0 && <span className="text-brand-600">{r.lr_count} LR</span>}
                </div>
              </div>
            ) : (r) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-head font-bold">{r.lr_no}</span>
                  <Badge>{r.payment_status}</Badge>
                </div>
                <p className="mt-1.5 text-[14px] font-medium">{r.sender?.name} → {r.receiver?.name || "—"}</p>
                <p className="mt-1 text-[13px] text-muted">{dmy(r.date)} · {r.from_name} → {r.to_name} · {r.vehicle_no}</p>
                <p className="mt-1.5 text-[13px]"><span className="num font-semibold">{money(r.freight)}</span>
                  {r.outstanding > 0 && <span className="text-amber-600"> · {money(r.outstanding)} pending</span>}</p>
              </div>
            )} />
        )}
      </Card>
      <div className="mt-3 flex justify-end">
        <Btn variant="s" onClick={() => exportExcel(tab, tab === "trips" ? tripCols : lrCols, flat(rows))}>Export Excel</Btn>
      </div>
    </div>
  );
}
