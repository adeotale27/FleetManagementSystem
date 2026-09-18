import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, FileText, Fuel, Plus, Receipt } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { money, dmy } from "../lib/format";
import EntryModal from "../components/QuickForms";
import {
  Badge, Btn, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, Select, toast,
} from "../components/ui";

const FLOW = ["New", "Assigned", "Started", "In Transit", "Delivered", "Completed"];

export default function TripDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: t, loading, error, reload } = useFetch(`/trips/${id}`);
  const [entry, setEntry] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !t) return <Loader />;
  if (error) return <ErrorState text={error} onRetry={reload} />;

  const setStatus = async (status) => {
    setBusy(true);
    try { await api.put(`/trips/${id}`, { status }); toast(`Trip marked ${status}`); reload(); }
    catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!window.confirm("Cancel this trip? Linked amounts will be reversed, nothing is deleted.")) return;
    try { await api.post(`/trips/${id}/cancel`); toast("Trip cancelled"); reload(); }
    catch (e) { toast(errMsg(e), "err"); }
  };

  const next = FLOW[FLOW.indexOf(t.status) + 1];

  return (
    <div>
      <PageHead title={`Trip ${t.trip_no}`} back="/trips"
        subtitle={`${t.from_name} → ${t.to_name} · ${t.trip_type} · ${t.mode === "indoor" ? "Indoor" : "Outdoor"}`}
        actions={
          <>
            {t.status !== "Cancelled" && next && (
              <Btn data-testid="advance-status" disabled={busy} onClick={() => setStatus(next)}>Mark {next}</Btn>
            )}
            <Btn variant="s" icon={FileText} data-testid="create-lr-from-trip" onClick={() => nav(`/lrs/new?trip=${id}`)}>Create LR</Btn>
            {t.status !== "Cancelled" && <Btn variant="d" icon={Ban} onClick={cancel} data-testid="cancel-trip">Cancel Trip</Btn>}
          </>
        } />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-head text-[16px] font-bold">Trip Details</h3>
            <Badge>{t.status}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px] md:grid-cols-3">
            {[
              ["Start", `${dmy(t.start_date)} ${t.start_time || ""}`],
              ...(t.trip_type === "Round Trip" ? [["Return", `${dmy(t.return_date)} ${t.return_time || ""}`]] : []),
              ["Vehicle", t.vehicle_no + (t.temp_vehicle?.vehicle_no ? " (temporary)" : "")],
              ["Driver", t.driver_name || "Not assigned"],
              ["Party", t.party_name || "—"],
              ["Trip Amount", money(t.trip_amount)],
              ["Expected Collection", money(t.expected_collection)],
              ["From Address", t.from_address || t.from_name],
              ["To Address", t.to_address || t.to_name],
              ["Remarks", t.remarks || "—"],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd></div>
            ))}
          </dl>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 font-head text-[16px] font-bold">Change Status</h3>
          <Select value={t.status} data-testid="trip-status-select" onChange={(e) => setStatus(e.target.value)}
            options={[...FLOW, "Cancelled"]} placeholder={t.status} />
          <div className="mt-4 space-y-2">
            <Btn variant="s" icon={Receipt} className="w-full" data-testid="add-trip-expense" onClick={() => setEntry("expense")}>Add Expense</Btn>
            <Btn variant="s" icon={Fuel} className="w-full" onClick={() => setEntry("fuel")}>Add Diesel</Btn>
          </div>
          <div className="mt-4 rounded-lg bg-canvas p-3 text-[13px]">
            <p className="flex justify-between"><span className="text-muted">Trip Expenses</span>
              <b className="num">{money((t.expenses || []).reduce((s, e) => s + e.amount, 0))}</b></p>
            <p className="mt-1 flex justify-between"><span className="text-muted">Diesel</span>
              <b className="num">{money((t.fuel || []).reduce((s, e) => s + e.amount, 0))}</b></p>
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-head text-[15.5px] font-bold">Lorry Receipts ({(t.lrs || []).length})</h3>
          <Btn variant="s" icon={Plus} onClick={() => nav(`/lrs/new?trip=${id}`)}>Add LR</Btn>
        </div>
        <DataTable testid="trip-lrs"
          columns={[
            { key: "lr_no", label: "LR No", strong: true },
            { key: "date", label: "Date", type: "date" },
            { key: "sender", label: "Sender", render: (r) => r.sender?.name },
            { key: "receiver", label: "Receiver", render: (r) => r.receiver?.name || "—" },
            { key: "freight", label: "Freight", type: "money", right: true },
            { key: "payment_status", label: "Status", type: "badge" },
          ]}
          rows={t.lrs || []} onRowClick={(r) => nav(`/lrs/${r.id}`)}
          empty={<EmptyState title="No LR for this trip" text="Create an LR — trip details fill in automatically."
            action={<Btn onClick={() => nav(`/lrs/new?trip=${id}`)}>Create LR</Btn>} />} />
      </Card>

      {((t.expenses || []).length > 0 || (t.fuel || []).length > 0) && (
        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-line px-4 py-3"><h3 className="font-head text-[15.5px] font-bold">Expenses & Diesel</h3></div>
          <DataTable
            columns={[
              { key: "date", label: "Date", type: "date" },
              { key: "category", label: "Detail", render: (r) => r.category || `Diesel ${r.quantity || ""}L` },
              { key: "mode", label: "Mode" },
              { key: "amount", label: "Amount", type: "money", right: true },
            ]}
            rows={[...(t.expenses || []), ...(t.fuel || [])]} />
        </Card>
      )}

      <EntryModal kind={entry || "expense"} open={!!entry} onClose={() => setEntry(null)} onDone={reload}
        preset={{ trip_id: id, trip_no: t.trip_no, vehicle_id: t.vehicle_id, vehicle_no: t.vehicle_no, driver_id: t.driver_id }} />
    </div>
  );
}
