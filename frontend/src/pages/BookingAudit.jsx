import React, { useEffect, useMemo, useState } from "react";
import { api, errMsg } from "../lib/api";
import { Card, Loader } from "../components/ui";
import { dmy, dmyDateTime, money } from "../lib/format";

const field = "fld w-full";
const auditLabels = {
  "trip.created": "Trip created",
  "trip.updated": "Trip updated",
  "trip.closed": "Trip closed",
  "trip.reopened": "Trip reopened",
  "lr.created": "Receipt created",
  "lr.updated": "Receipt updated",
  "lr.voided": "Receipt voided",
  "lr.unvoided": "Receipt restored",
  "lr.payment_recorded": "Payment recorded",
  "lr.payment_reversed": "Payment reversed",
  "lr.settlement_marked_received": "Marked as paid",
  "lr.settlement_reversed": "Payment tick reversed",
  "lr.payment_followup_updated": "Payment follow-up updated",
};
const fieldLabels = {
  receiver_name: "Receiver", sender_name: "Sender", rent: "Bhada", hamali: "Hamali",
  receipt_date: "Receipt date", goods_rows: "Goods", containers: "Goods",
  payment_promised_date: "Promised date", payment_followup_note: "Follow-up note",
  voided: "Receipt status", reason: "Reason", amount: "Amount", status: "Status",
};

function auditValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return "Updated";
  return String(value);
}

export default function BookingAudit({ user }) {
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState(localStorage.getItem("booking_site_id") || "");
  const [receipts, setReceipts] = useState([]);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/sites").then((response) => {
      if (!active) return;
      const available = response.data || [];
      setSites(available);
      setSiteId((current) => available.some((site) => site.id === current)
        ? current : available[0]?.id || "");
    }).catch((requestError) => {
      if (active) { setError(errMsg(requestError)); setBusy(false); }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!siteId) { setReceipts([]); setEvents([]); setBusy(false); return undefined; }
    let active = true;
    setBusy(true);
    setError("");
    localStorage.setItem("booking_site_id", siteId);
    Promise.all([
      api.get(`/sites/${siteId}/booking-finance`),
      api.get(`/sites/${siteId}/audit`, { params: { limit: 25, offset: 0 } }),
    ]).then(([finance, audit]) => {
      if (!active) return;
      setReceipts(finance.data.rows || []);
      setEvents(audit.data.rows || []);
    }).catch((requestError) => {
      if (active) setError(errMsg(requestError));
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [siteId]);

  const pendingRows = useMemo(() => receipts.filter((row) =>
    Number(row.outstanding) > 0 || !row.reconciled || row.rent == null,
  ).filter((row) => {
    const term = search.trim().toLowerCase();
    return !term || [row.lr_ref, row.trip_ref, row.sender_name, row.receiver_name, row.goods]
      .some((value) => String(value || "").toLowerCase().includes(term));
  }), [receipts, search]);

  if (user?.role !== "owner") return <Card className="p-6">Booking Audit is available to the business owner only.</Card>;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold text-brand-700">BOOKING</p>
          <h1 className="text-2xl font-bold">Booking Audit</h1>
          <p className="mt-1 text-sm text-muted">Review unpaid Bhada, pending receipts and manager activity.</p></div>
        <label className="w-full sm:max-w-xs"><span className="lbl">Site / garage</span>
          <select className={field} value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
      </header>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {busy ? <Loader label="Loading booking audit…" /> : <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4"><p className="text-sm text-muted">Unpaid receipts</p>
            <strong className="mt-1 block text-2xl">{receipts.filter((row) => Number(row.outstanding) > 0).length}</strong></Card>
          <Card className="p-4"><p className="text-sm text-muted">Pending order checks</p>
            <strong className="mt-1 block text-2xl">{receipts.filter((row) => !row.reconciled).length}</strong></Card>
          <Card className="p-4"><p className="text-sm text-muted">Asked for more time</p>
            <strong className="mt-1 block text-2xl">{receipts.filter((row) => row.promised_date || row.followup_note).length}</strong></Card>
        </div>
        <Card className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-xl font-bold">Pending orders and amounts</h2>
              <p className="text-sm text-muted">Unreconciled, unpriced, and unpaid receipts are shown for owner review.</p></div>
            <label className="w-full sm:max-w-sm"><span className="lbl">Search</span>
              <input className={field} value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="LR, trip, sender or receiver" /></label>
          </div>
          <div className="space-y-3">
            {pendingRows.map((row) => <article key={row.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><strong>{row.lr_ref}</strong>
                  <p className="break-words">{row.receiver_name || "Receiver missing"}
                    {row.sender_name ? ` · From ${row.sender_name}` : ""}</p>
                  <p className="text-sm text-muted">{row.trip_ref} · {dmy(row.receipt_date)} · {row.goods}</p></div>
                <div className="text-left sm:text-right"><strong>{money(row.outstanding)} pending Bhada</strong>
                  <p className="text-xs text-muted">{row.payment_status} · {row.age_days} days old</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>{row.reconciled ? "Reconciled" : "Order check pending"}</span>
                {row.rent == null && <span className="font-semibold text-amber-800">Bhada not entered</span>}
                {row.promised_date && <span className="font-semibold">Asked for time until {dmy(row.promised_date)}</span>}
                {row.followup_note && <span className="text-muted">Note: {row.followup_note}</span>}
              </div>
            </article>)}
            {!pendingRows.length && <p className="py-6 text-center text-muted">No pending receipts match this search.</p>}
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-3"><h2 className="text-xl font-bold">Recent activity</h2>
            <p className="text-sm text-muted">Owner-only history of trip, receipt, charge and follow-up changes.</p></div>
          <div className="space-y-3">
            {events.map((event) => <article key={event.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div><strong>{auditLabels[event.action] || String(event.action || "Activity").replaceAll(".", " ")}</strong>
                  <p className="text-sm text-muted">{event.target_type === "lr" ? "Receipt" : event.target_type || "Booking"}</p>
                  <p className="text-xs text-muted">By {event.actor_name || event.actor_username || "Unknown"}
                    {event.actor_role ? ` · ${event.actor_role}` : ""}</p></div>
                <time className="text-xs text-muted">{dmyDateTime(event.created_at)}</time>
              </div>
              {event.reason && <p className="mt-2 text-sm">Reason: {event.reason}</p>}
              {(event.old_values || event.new_values) && <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-semibold">Change details</summary>
                <dl className="mt-2 grid gap-1 rounded-lg bg-canvas p-3">
                  {[...new Set([
                    ...Object.keys(event.old_values || {}),
                    ...Object.keys(event.new_values || {}),
                  ])].filter((key) => !["updated_at", "expected_updated_at"].includes(key)).slice(0, 8)
                    .map((key) => <div key={key} className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-2">
                      <dt className="font-semibold">{fieldLabels[key] || key.replaceAll("_", " ")}</dt>
                      <dd className="break-words">
                        {auditValue(event.old_values?.[key])}
                        {event.new_values?.[key] !== undefined
                          ? ` → ${auditValue(event.new_values[key])}` : ""}
                      </dd>
                    </div>)}
                </dl>
              </details>}
            </article>)}
            {!events.length && <p className="py-4 text-sm text-muted">No activity recorded for this site yet.</p>}
          </div>
        </Card>
      </>}
    </div>
  );
}
