import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api, errMsg } from "../lib/api";
import { Btn, Card, ErrorState, Loader, PageHead } from "../components/ui";
import { DATA_CHANGE_EVENT } from "../lib/realtime";

const field = "fld w-full";
const newPaymentKey = () => `manual-${crypto.randomUUID()}`;
const localDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export default function SiteLRPage({ user }) {
  const { siteId, tripId, lrId } = useParams();
  const location = useLocation();
  const owner = user?.role === "owner";
  const permissions = user?.site_permissions?.[siteId] || [];
  const canPay = owner || permissions.includes("payments:create");
  const canReadPayments = owner || permissions.includes("payments:read");
  const canSeeFinance = owner || permissions.includes("finance:read") || permissions.includes("finance:update");
  const canEdit = owner || permissions.includes("lrs:update");
  const canEditFinance = owner || permissions.includes("finance:update");
  const [lr, setLr] = useState(null);
  const [trip, setTrip] = useState(null);
  const [site, setSite] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editKey, setEditKey] = useState("");
  const [payment, setPayment] = useState({ amount: "", date: localDate(), method: "Cash", reference: "" });
  const [paymentKey, setPaymentKey] = useState(newPaymentKey);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const autoPrintStarted = useRef(false);
  const dirtyFields = useRef({});

  const refresh = useCallback(async (preserveDrafts = false) => {
    setLoading(true);
    setError("");
    try {
      const [lrResponse, tripResponse, siteResponse] = await Promise.all([
        api.get(`/sites/${siteId}/trips/${tripId}/lrs/${lrId}`),
        api.get(`/sites/${siteId}/trips/${tripId}`),
        api.get("/sites"),
      ]);
      setLr(lrResponse.data);
      const nextEditForm = {
        sender_name: lrResponse.data.sender_name,
        sender_phone: lrResponse.data.sender_phone || "",
        receiver_name: lrResponse.data.receiver_name,
        receiver_phone: lrResponse.data.receiver_phone || "",
        receiver_identifier: lrResponse.data.receiver_identifier || "",
        goods_type: lrResponse.data.goods_type,
        containers: lrResponse.data.containers,
        rent: lrResponse.data.rent ?? "",
        hamali: lrResponse.data.hamali ?? "",
      };
      setEditForm((current) => preserveDrafts
        ? { ...nextEditForm, ...Object.fromEntries(Object.keys(dirtyFields.current).map((key) => [key, current?.[key]])) }
        : nextEditForm);
      if (!preserveDrafts) dirtyFields.current = {};
      else if (Object.keys(dirtyFields.current).length) {
        setMessage("Latest data loaded. Your unsaved LR edits were kept; review before saving.");
      }
      setTrip(tripResponse.data);
      setSite(siteResponse.data.find((row) => row.id === siteId) || null);
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, [siteId, tripId, lrId]);

  useEffect(() => {
    refresh();
    const refreshLatest = () => refresh(true);
    window.addEventListener(DATA_CHANGE_EVENT, refreshLatest);
    return () => window.removeEventListener(DATA_CHANGE_EVENT, refreshLatest);
  }, [refresh]);

  useEffect(() => {
    if (!lr || loading || !location.search.includes("autoprint=1") || autoPrintStarted.current) return undefined;
    autoPrintStarted.current = true;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [lr, loading, location.search]);

  const addPayment = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/sites/${siteId}/trips/${tripId}/lrs/${lrId}/payments`, {
        ...payment, idempotency_key: paymentKey,
      });
      setMessage("Payment recorded in the auditable payment history.");
      setPayment({ amount: "", date: localDate(), method: "Cash", reference: "" });
      setPaymentKey(newPaymentKey());
      await refresh(true);
    } catch (e) { setError(errMsg(e)); }
  };

  const saveLR = async (event, receiverAction, receiverIdentityId) => {
    event?.preventDefault();
    const body = {};
    for (const key of [
      "sender_name", "sender_phone", "receiver_name", "receiver_phone",
      "receiver_identifier", "goods_type",
    ]) {
      if (dirtyFields.current[key]) body[key] = editForm[key] || "";
    }
    if (dirtyFields.current.containers) body.containers = editForm.containers;
    if ("receiver_name" in body) {
      body.receiver_match_action = receiverAction;
      body.receiver_identity_id = receiverIdentityId;
    }
    if (canEditFinance) {
      if (dirtyFields.current.rent) body.rent = editForm.rent === "" ? null : editForm.rent;
      if (dirtyFields.current.hamali) body.hamali = editForm.hamali === "" ? null : editForm.hamali;
      if ("rent" in body && body.rent !== lr.rent) body.idempotency_key = editKey || `lr-edit-${crypto.randomUUID()}`;
    }
    if (!Object.keys(body).length) return;
    try {
      await api.patch(`/sites/${siteId}/trips/${tripId}/lrs/${lrId}`, body);
      dirtyFields.current = {};
      setEditKey("");
      setMessage("LR corrections saved and recorded in the audit history.");
      await refresh();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.code === "receiver_match_confirmation_required") {
        const choices = detail.matches || [];
        const answer = window.prompt(
          `A similar receiver was found:\n${choices.map((match, index) => `${index + 1}. ${match.label}`).join("\n")}\nEnter a number for the same person, or D for a different person.`,
        );
        if (answer?.toUpperCase() === "D") {
          const identifier = window.prompt("Optional additional receiver identifier:") || "";
          updateEditField("receiver_identifier", identifier);
          return saveLR(null, "different");
        }
        const index = Number(answer) - 1;
        if (Number.isInteger(index) && choices[index]) return saveLR(null, "same", choices[index].id);
        return;
      }
      setError(errMsg(e));
    }
  };

  const updateEditField = (key, value) => {
    dirtyFields.current[key] = true;
    setEditForm((current) => ({ ...current, [key]: value }));
  };

  const setContainer = (index, key, value) => {
    dirtyFields.current.containers = true;
    setEditForm((current) => ({
      ...current, containers: current.containers.map((line, row) =>
      row === index ? { ...line, [key]: key === "quantity" ? Number(value) : value } : line),
    }));
  };

  const reversePayment = async (paymentId) => {
    const reason = window.prompt("Reason for reversing this payment (required):");
    if (!reason) return;
    try {
      await api.post(`/sites/${siteId}/trips/${tripId}/lrs/${lrId}/payments/${paymentId}/reverse`, { reason });
      setMessage("Reversal recorded. The original payment was retained.");
      await refresh(true);
    } catch (e) { setError(errMsg(e)); }
  };

  const retryPayment = async (paymentId) => {
    try {
      await api.post(`/sites/${siteId}/trips/${tripId}/lrs/${lrId}/payments/${paymentId}/retry`);
      setMessage("Payment posting completed.");
      await refresh(true);
    } catch (e) { setError(errMsg(e)); }
  };

  if (loading && !lr) return <Loader label="Loading lorry receipt…" />;
  if (error && !lr) return <ErrorState text={error} onRetry={refresh} />;
  if (!lr) return null;

  return (
    <div className="space-y-5 print-shell">
      <div className="no-print">
        <PageHead title={`Booking LR ${lr.lr_ref}`} subtitle={`${site?.name || "Site"} · Booking ${trip?.trip_ref || ""}`} />
        {error && <div role="alert" className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div role="status" className="mb-3 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>}
        <div className="flex flex-wrap gap-3">
          <Link className="text-sm text-brand-700 underline" to={`/sites/${siteId}/trips/${tripId}`}>Back to booking</Link>
          <Btn onClick={() => window.print()}>Print / Save PDF</Btn>
        </div>
        <p className="mt-2 text-xs text-muted">Choose a paired printer or Save as PDF in your browser or device print dialog.</p>
      </div>

      <article className="print-area mx-auto max-w-3xl rounded-xl border border-line bg-white p-6 md:p-10">
        <header className="border-b-2 border-ink pb-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Lorry Receipt</p>
          {user?.branding?.logo && <img src={user.branding.logo} alt="" className="mx-auto mt-2 max-h-16 max-w-40 object-contain" />}
          <h1 className="mt-2 text-2xl font-bold">{user?.branding?.name || user?.tenant_name || "Transport Company"}</h1>
          <p className="mt-1 text-sm">{site?.name}{site?.location ? ` · ${site.location}` : ""}</p>
        </header>
        <div className="grid grid-cols-2 gap-3 border-b py-4 text-sm">
          <p><strong>LR number:</strong> {lr.lr_ref}</p><p><strong>Date:</strong> {lr.operating_date}</p>
          <p><strong>Booking:</strong> {trip?.trip_ref}</p><p><strong>Truck number:</strong> {trip?.truck_no}</p>
        </div>
        <section className="grid gap-4 border-b py-5 md:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase text-muted">Sender</p><p className="mt-1 text-lg font-semibold">{lr.sender_name}</p>
            {lr.sender_phone && <p className="mt-1 text-sm">Phone: {lr.sender_phone}</p>}</div>
          <div><p className="text-xs font-semibold uppercase text-muted">Receiver</p><p className="mt-1 text-lg font-semibold">{lr.receiver_label || lr.receiver_name}</p>
            {lr.receiver_phone && <p className="mt-1 text-sm">Phone: {lr.receiver_phone}</p>}</div>
        </section>
        <section className="py-5">
          <h2 className="mb-2 font-semibold">Goods and packages</h2>
          <p className="mb-3">{lr.goods_type}</p>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-y text-left"><th className="py-2">Container type</th><th className="py-2 text-right">Quantity</th></tr></thead>
            <tbody>{lr.containers.map((line, index) => <tr className="border-b" key={`${line.type}-${index}`}>
              <td className="py-2">{line.type}</td><td className="py-2 text-right">{line.quantity}</td>
            </tr>)}</tbody>
            <tfoot><tr><th className="py-2 text-left">Total parcels</th><th className="py-2 text-right">{lr.total_quantity}</th></tr></tfoot>
          </table>
        </section>
        <section className="border-y py-4 text-sm">
          <p><strong>Bhada / rent:</strong> {lr.rent === null || lr.rent === undefined ? "________________" : `₹ ${lr.rent}`}</p>
        </section>
        <footer className="grid grid-cols-2 gap-8 pt-14 text-center text-xs">
          <p className="border-t pt-2">Sender's signature</p><p className="border-t pt-2">Receiver's signature</p>
        </footer>
      </article>

      {(canSeeFinance || canPay || canReadPayments) && <Card className="no-print space-y-3 p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="font-semibold">Internal booking financials</h2>
          {canSeeFinance && <span className="text-sm">Bhada paid: {lr.paid_total} · Outstanding: {lr.outstanding} · Status: {lr.payment_status}</span>}
        </div>
        {canSeeFinance && <p className="text-sm text-muted">Hamali: {lr.hamali ?? "Not entered"} (internal only; never printed on the LR).</p>}
        {canPay && <form onSubmit={addPayment} className="grid gap-3 md:grid-cols-4">
          <input className={field} type="number" min="0.01" step="0.01" required placeholder="Payment amount" value={payment.amount} onChange={(e) => { setPayment({ ...payment, amount: e.target.value }); setPaymentKey(newPaymentKey()); }} />
          <input className={field} type="date" required value={payment.date} onChange={(e) => { setPayment({ ...payment, date: e.target.value }); setPaymentKey(newPaymentKey()); }} />
          <select className={field} value={payment.method} onChange={(e) => { setPayment({ ...payment, method: e.target.value }); setPaymentKey(newPaymentKey()); }}>
            {["Cash", "UPI", "Bank", "Cheque", "Other"].map((method) => <option key={method}>{method}</option>)}
          </select>
          <div className="flex gap-2"><input className={field} placeholder="Transaction reference" value={payment.reference} onChange={(e) => { setPayment({ ...payment, reference: e.target.value }); setPaymentKey(newPaymentKey()); }} /><Btn type="submit">Record payment</Btn></div>
        </form>}
        {canReadPayments && <p className="text-xs text-muted">Posted payments are retained; the business owner records a reversal before entering a correction. Rejected events are not counted and can be corrected with a new payment.</p>}
        {canReadPayments && <div>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[550px] text-left text-sm">
            <thead><tr className="border-b text-muted">{["Date", "Type", "Amount", "Method", "Reference", "Recorded by", "Posting", ""].map((x) => <th key={x} className="p-2">{x}</th>)}</tr></thead>
            <tbody>{(lr.payments || []).map((entry) => <tr className="border-b last:border-0" key={entry.id}>
              <td className="p-2">{entry.date}</td><td className="p-2">{entry.kind}</td><td className="p-2">{entry.amount}</td>
              <td className="p-2">{entry.method}</td><td className="p-2">{entry.reference}</td><td className="p-2">{entry.created_by}</td>
              <td className="p-2">{entry.posting_status || "pending"}</td>
              <td className="space-x-2 p-2">
                {owner && entry.posting_status === "pending" && <button className="text-brand-700 underline" onClick={() => retryPayment(entry.id)}>Retry</button>}
                {owner && entry.kind === "payment" && entry.posting_status === "posted" && <button className="text-red-700 underline" onClick={() => reversePayment(entry.id)}>Reverse</button>}
              </td>
            </tr>)}</tbody>
          </table>
          </div>
          <div className="space-y-2 md:hidden">{(lr.payments || []).map((entry) => <article key={entry.id} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex justify-between gap-2"><strong>{entry.kind} · {entry.date}</strong><strong className="num">{entry.amount}</strong></div>
            <p className="mt-1">{entry.method} {entry.reference ? `· ${entry.reference}` : ""}</p>
            <p className="mt-1 text-xs text-muted">{entry.created_by} · {entry.posting_status || "pending"}</p>
            <div className="mt-2 flex gap-3">
              {owner && entry.posting_status === "pending" && <button className="min-h-11 text-brand-700 underline" onClick={() => retryPayment(entry.id)}>Retry posting</button>}
              {owner && entry.kind === "payment" && entry.posting_status === "posted" && <button className="min-h-11 text-red-700 underline" onClick={() => reversePayment(entry.id)}>Reverse payment</button>}
            </div>
          </article>)}</div>
          {(lr.payments || []).length === 0 && <p className="py-3 text-sm text-muted">No payment events recorded.</p>}
        </div>}
      </Card>}
      {canEdit && trip?.status === "open" && <Card className="no-print p-4">
        <h2 className="mb-3 font-semibold">Correct this LR</h2>
        <form onSubmit={saveLR} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Sender<input className={field} required value={editForm?.sender_name || ""} onChange={(e) => updateEditField("sender_name", e.target.value)} /></label>
            <label className="text-sm">Sender phone (optional)<input className={field} type="tel" autoComplete="tel" inputMode="tel" value={editForm?.sender_phone || ""} onChange={(e) => updateEditField("sender_phone", e.target.value)} /></label>
            <label className="text-sm">Receiver<input className={field} required value={editForm?.receiver_name || ""} onChange={(e) => updateEditField("receiver_name", e.target.value)} /></label>
            <label className="text-sm">Receiver phone (optional)<input className={field} type="tel" autoComplete="tel" inputMode="tel" value={editForm?.receiver_phone || ""} onChange={(e) => updateEditField("receiver_phone", e.target.value)} /></label>
            <label className="text-sm">Receiver identifier<input className={field} value={editForm?.receiver_identifier || ""} onChange={(e) => updateEditField("receiver_identifier", e.target.value)} /></label>
            <label className="text-sm">Goods type<input className={field} required value={editForm?.goods_type || ""} onChange={(e) => updateEditField("goods_type", e.target.value)} /></label>
            {canEditFinance && <>
              <label className="text-sm">Bhada<input className={field} type="number" min="0" step="0.01" value={editForm?.rent ?? ""} onChange={(e) => updateEditField("rent", e.target.value)} /></label>
              <label className="text-sm">Hamali (internal)<input className={field} type="number" min="0" step="0.01" value={editForm?.hamali ?? ""} onChange={(e) => updateEditField("hamali", e.target.value)} /></label>
            </>}
          </div>
          <h3 className="text-sm font-semibold">Containers</h3>
          {editForm?.containers.map((line, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] gap-2">
            <input className={field} required aria-label="Container type" value={line.type} onChange={(e) => setContainer(index, "type", e.target.value)} />
            <input className={field} required type="number" min="1" aria-label="Container quantity" value={line.quantity} onChange={(e) => setContainer(index, "quantity", e.target.value)} />
            <button type="button" className="text-red-700" onClick={() => {
              dirtyFields.current.containers = true;
              setEditForm({ ...editForm, containers: editForm.containers.filter((_, i) => i !== index) });
            }}>Remove</button>
          </div>)}
          <button type="button" className="text-sm text-brand-700 underline" onClick={() => {
            dirtyFields.current.containers = true;
            setEditForm({ ...editForm, containers: [...editForm.containers, { type: "", quantity: 1 }] });
          }}>Add container</button>
          <Btn type="submit">Save LR corrections</Btn>
        </form>
      </Card>}
    </div>
  );
}
