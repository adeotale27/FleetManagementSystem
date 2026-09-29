import React, { useEffect, useMemo, useState } from "react";
import { api, errMsg } from "../lib/api";
import { Card, Loader } from "../components/ui";
import { dmy, money } from "../lib/format";

const field = "fld w-full";
const requestKey = () => window.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function BookingFinance({ user }) {
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState(localStorage.getItem("booking_site_id") || "");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [saveStatus, setSaveStatus] = useState({});
  const [settlementStatus, setSettlementStatus] = useState({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/sites").then((response) => {
      if (!active) return;
      const available = response.data || [];
      setSites(available);
      const selected = available.some((site) => site.id === siteId)
        ? siteId : available[0]?.id || "";
      setSiteId(selected);
    }).catch((requestError) => {
      if (active) { setError(errMsg(requestError)); setBusy(false); }
    });
    return () => { active = false; };
  }, []); // Sites are loaded once; selected site changes independently.

  useEffect(() => {
    if (!siteId) { setData(null); setBusy(false); return undefined; }
    let active = true;
    setBusy(true);
    setError("");
    localStorage.setItem("booking_site_id", siteId);
    api.get(`/sites/${siteId}/booking-finance`).then((response) => {
      if (active) { setData(response.data); setDrafts({}); setSaveStatus({}); }
    }).catch((requestError) => {
      if (active) setError(errMsg(requestError));
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [siteId]);

  const rows = useMemo(() => (data?.rows || []).filter((row) => {
    const term = search.trim().toLowerCase();
    return !term || [row.lr_ref, row.trip_ref, row.sender_name, row.receiver_name, row.goods]
      .some((value) => String(value || "").toLowerCase().includes(term));
  }), [data, search]);
  const totals = data?.totals || {};
  const updateDraft = (row, key, value) => setDrafts((current) => ({
    ...current, [row.id]: { ...(current[row.id] || {}), [key]: value },
  }));
  const saveFollowup = async (row) => {
    const changes = drafts[row.id] || {};
    setSaveStatus((current) => ({ ...current, [row.id]: "Saving…" }));
    try {
      const response = await api.patch(
        `/sites/${row.site_id}/trips/${row.trip_id}/lrs/${row.id}/followup`,
        {
          promised_date: changes.promised_date ?? row.promised_date ?? "",
          note: changes.note ?? row.followup_note ?? "",
        },
      );
      setData((current) => ({
        ...current,
        rows: current.rows.map((item) => item.id === row.id
          ? { ...item, promised_date: response.data.promised_date, followup_note: response.data.note }
          : item),
      }));
      setDrafts((current) => ({ ...current, [row.id]: {} }));
      setSaveStatus((current) => ({ ...current, [row.id]: "Saved" }));
    } catch (requestError) {
      setSaveStatus((current) => ({ ...current, [row.id]: `Failed: ${errMsg(requestError)}` }));
    }
  };
  const settleReceipt = async (row) => {
    setSettlementStatus((current) => ({ ...current, [row.id]: "Recording payment…" }));
    try {
      await api.post(`/sites/${row.site_id}/trips/${row.trip_id}/lrs/${row.id}/settlement`, {
        received: true, idempotency_key: requestKey(),
      });
      setSettlementStatus((current) => ({ ...current, [row.id]: "Payment recorded" }));
      try {
        const response = await api.get(`/sites/${siteId}/booking-finance`);
        setData(response.data);
      } catch (refreshError) {
        setSettlementStatus((current) => ({
          ...current, [row.id]: `Payment recorded; refresh to reload totals: ${errMsg(refreshError)}`,
        }));
      }
    } catch (requestError) {
      setSettlementStatus((current) => ({ ...current, [row.id]: `Failed: ${errMsg(requestError)}` }));
    }
  };

  if (user?.role !== "owner") return <Card className="p-6">Booking Finance is available to the business owner only.</Card>;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold text-brand-700">BOOKING</p>
          <h1 className="text-2xl font-bold">Booking Finance</h1>
          <p className="mt-1 text-sm text-muted">Receipt totals, collections and unpaid Bhada by site.</p></div>
        <label className="w-full sm:max-w-xs"><span className="lbl">Site / garage</span>
          <select className={field} value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
      </header>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {busy ? <Loader label="Loading booking finance…" /> : data && <>
        <div className="grid gap-3 grid-cols-2 xl:grid-cols-6">
          {[
            ["Grand total · Bhada + Hamali", totals.grand_total],
            ["Bhada recorded", totals.recorded_bhada],
            ["Hamali recorded", totals.recorded_hamali],
            ["Bhada collected", totals.collected_bhada],
            ["Bhada pending", totals.outstanding_bhada],
            ["Collectible after reconciliation", totals.collectible_outstanding_bhada],
          ].map(([label, value], index) => <Card key={label} className={`p-4 ${index === 0 ? "border-brand-700" : ""}`}>
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className="mt-2 text-lg font-bold sm:text-xl">{money(value)}</p>
          </Card>)}
        </div>
        <Card className="p-4 text-sm text-muted">{data.basis}
          <span className="ml-2 font-semibold text-ink">{totals.receipt_count || 0} receipts ·
            {" "}{totals.unpaid_receipts || 0} unpaid · {totals.pending_orders || 0} awaiting reconciliation</span>
        </Card>
        <Card className="p-4">
          <div className="mb-3"><h2 className="text-lg font-bold">Bhada by receiver</h2>
            <p className="text-sm text-muted">Outstanding balance is grouped by the receiver’s party account.</p></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(data.receiver_balances || []).map((receiver) => <article key={`${receiver.receiver_label}-${receiver.receiver_name}`}
              className="rounded-lg border border-line p-3">
              <strong>{receiver.receiver_label || receiver.receiver_name || "Receiver"}</strong>
              <p className="mt-1 text-xs text-muted">{receiver.receipt_count} receipt(s)</p>
              <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
                <span>Bhada <b className="block">{money(receiver.bhada)}</b></span>
                <span>Paid <b className="block">{money(receiver.collected)}</b></span>
                <span>Due <b className="block">{money(receiver.outstanding)}</b></span>
              </div>
            </article>)}
            {!data.receiver_balances?.length && <p className="text-sm text-muted">No receiver balances yet.</p>}
          </div>
        </Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-bold">Receipts and follow-up</h2>
            <p className="text-sm text-muted">Record the date a customer asked for more time and a short note.</p></div>
          <label className="w-full sm:max-w-sm"><span className="lbl">Search receipts</span>
            <input className={field} value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="LR, receiver, sender or goods" /></label>
        </div>
        <div className="hidden overflow-hidden rounded-xl border border-line bg-white lg:block">
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 bg-canvas"><tr>
                {["Date / LR", "Receiver · goods", "Bhada", "Hamali", "Total", "Paid", "Pending Bhada", "Payment", "Promised date", "Follow-up note", "Save"].map((label) =>
                  <th key={label} className="px-2 py-3 text-left text-xs">{label}</th>)}
              </tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-line align-top">
                <td className="px-2 py-3"><strong>{row.lr_ref}</strong><span className="block text-xs text-muted">{dmy(row.receipt_date)}</span>
                  <span className="text-xs text-muted">{row.trip_ref}</span></td>
                <td className="break-words px-2 py-3">{row.receiver_name || "Receiver missing"}
                  <span className="block text-xs text-muted">{row.goods}</span></td>
                <td className="px-2 py-3">{money(row.rent)}</td><td className="px-2 py-3">{money(row.hamali)}</td>
                <td className="px-2 py-3 font-bold">{money(row.total)}</td><td className="px-2 py-3">{money(row.paid)}</td>
                <td className="px-2 py-3 font-semibold">{money(row.outstanding)}</td>
                <td className="px-2 py-3"><button className="btn-s px-2 py-1"
                  disabled={Number(row.outstanding) <= 0 || settlementStatus[row.id] === "Recording payment…"}
                  onClick={() => settleReceipt(row)}>Settle</button>
                  <span className="mt-1 block text-[10px] text-muted">{settlementStatus[row.id] || ""}</span></td>
                <td className="px-2 py-3"><input className={`${field} min-w-0 px-2`} type="date"
                  aria-label={`${row.lr_ref} promised date`}
                  value={drafts[row.id]?.promised_date ?? row.promised_date ?? ""}
                  onChange={(event) => updateDraft(row, "promised_date", event.target.value)} /></td>
                <td className="px-2 py-3"><input className={`${field} min-w-0 px-2`}
                  aria-label={`${row.lr_ref} follow-up note`} placeholder="Asked for a few days?"
                  value={drafts[row.id]?.note ?? row.followup_note ?? ""}
                  onChange={(event) => updateDraft(row, "note", event.target.value)} /></td>
                <td className="px-2 py-3"><button className="btn-s px-2 py-1" onClick={() => saveFollowup(row)}>Save</button>
                  <span className="mt-1 block text-xs text-muted">{saveStatus[row.id] || ""}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3 lg:hidden">
          {rows.map((row) => <Card key={row.id} className="space-y-3 p-4">
            <div className="flex justify-between gap-3"><div><strong>{row.lr_ref}</strong>
              <p className="text-sm">{row.receiver_name || "Receiver missing"}</p>
              <p className="text-xs text-muted">{row.trip_ref} · {dmy(row.receipt_date)} · {row.goods}</p></div>
              <strong>{money(row.outstanding)} pending</strong></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p>Bhada: {money(row.rent)}</p><p>Hamali: {money(row.hamali)}</p>
              <p>Total: {money(row.total)}</p><p>Paid: {money(row.paid)}</p></div>
            <button className="btn-p min-h-11 w-full" disabled={Number(row.outstanding) <= 0}
              onClick={() => settleReceipt(row)}>Settle full pending Bhada</button>
            <p className="text-xs text-muted">{settlementStatus[row.id] || ""}</p>
            <label><span className="lbl">Promised payment date</span>
              <input className={field} type="date" value={drafts[row.id]?.promised_date ?? row.promised_date ?? ""}
                onChange={(event) => updateDraft(row, "promised_date", event.target.value)} /></label>
            <label><span className="lbl">Follow-up note</span>
              <input className={field} value={drafts[row.id]?.note ?? row.followup_note ?? ""}
                placeholder="Asked for a few days?" onChange={(event) => updateDraft(row, "note", event.target.value)} /></label>
            <div className="flex items-center justify-between"><span className="text-xs text-muted">{saveStatus[row.id] || ""}</span>
              <button className="btn-p" onClick={() => saveFollowup(row)}>Save follow-up</button></div>
          </Card>)}
          {!rows.length && <Card className="p-8 text-center text-muted">No receipts match this search.</Card>}
        </div>
      </>}
    </div>
  );
}
