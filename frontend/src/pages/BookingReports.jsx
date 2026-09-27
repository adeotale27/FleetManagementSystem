import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, Pencil, Printer, Save, X } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { exportCSV } from "../lib/export";
import { money0, monthStart, todayISO } from "../lib/format";
import { Btn, Card, ErrorState, Loader, PageHead } from "../components/ui";
import { DATA_CHANGE_EVENT } from "../lib/realtime";

const field = "fld w-full";
const PAGE_SIZE = 50;
const makeIdempotencyKey = () => window.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const COLUMNS = [
  { key: "operating_date", label: "Operating date" },
  { key: "site_name", label: "Site" },
  { key: "trip_ref", label: "Booking" },
  { key: "lr_ref", label: "LR" },
  { key: "sender_name", label: "Sender" },
  { key: "receiver_label", label: "Receiver" },
  { key: "sender_phone", label: "Sender phone" },
  { key: "receiver_phone", label: "Receiver phone" },
  { key: "receiver_identifier", label: "Receiver ID" },
  { key: "goods_type", label: "Goods" },
  { key: "total_quantity", label: "Quantity" },
  { key: "rent", label: "Bhada" },
  { key: "hamali", label: "Hamali" },
  { key: "paid_total", label: "Collected" },
  { key: "outstanding", label: "Outstanding" },
  { key: "payment_status", label: "Payment status" },
];

function safeExportRows(rows) {
  const textFields = new Set([
    "site_name", "trip_ref", "lr_ref", "sender_name", "receiver_label", "receiver_name",
    "sender_phone", "receiver_phone", "receiver_identifier", "goods_type", "payment_status",
  ]);
  return rows.map((source) => {
    const row = {
      ...source,
      receiver_label: source.receiver_label || source.receiver_name || "",
      ...(source.rent == null ? { outstanding: "" } : {}),
    };
    return Object.fromEntries(Object.entries(row).map(([key, value]) => {
      if (!textFields.has(key) || value == null) return [key, value];
      const text = String(value);
      return [key, /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text];
    }));
  });
}

const lrDraft = (lr) => ({
  sender_name: lr.sender_name || "",
  sender_phone: lr.sender_phone || "",
  receiver_name: lr.receiver_name || lr.receiver_label || "",
  receiver_phone: lr.receiver_phone || "",
  receiver_identifier: lr.receiver_identifier || "",
  goods_type: lr.goods_type || "",
  containers: (lr.containers || []).map((line) => ({ ...line })),
  rent: lr.rent ?? "",
  hamali: lr.hamali ?? "",
});

function TripLedgerPanel({ reportRow, onSaved }) {
  const { site_id: siteId, trip_id: tripId } = reportRow;
  const [trip, setTrip] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [editingRows, setEditingRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingRows, setSavingRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [rowMessages, setRowMessages] = useState({});
  const requestId = useRef(0);
  const loadedCountRef = useRef(0);
  const dirtyFields = useRef({});

  const loadLedger = useCallback(async (preserveEdits = false) => {
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const [tripResponse, lrsResponse] = await Promise.all([
        api.get(`/sites/${siteId}/trips/${tripId}`),
        api.get(`/sites/${siteId}/trips/${tripId}/lrs`, { params: { limit: 100, offset: 0 } }),
      ]);
      if (request !== requestId.current) return;
      setTrip(tripResponse.data);
      const firstPage = lrsResponse.data.rows || [];
      const wantedCount = preserveEdits ? loadedCountRef.current : 0;
      const pageOffsets = [];
      for (let pageOffset = 100; pageOffset < Math.min(wantedCount, lrsResponse.data.total || 0); pageOffset += 100) {
        pageOffsets.push(pageOffset);
      }
      const additionalPages = await Promise.all(pageOffsets.map((pageOffset) =>
        api.get(`/sites/${siteId}/trips/${tripId}/lrs`, {
          params: { limit: 100, offset: pageOffset },
        })));
      const nextRows = [
        ...firstPage,
        ...additionalPages.flatMap((response) => response.data.rows || []),
      ];
      setRows(nextRows);
      setTotal(lrsResponse.data.total || 0);
      setOffset(nextRows.length);
      loadedCountRef.current = nextRows.length;
      if (preserveEdits) {
        setDrafts((current) => Object.fromEntries(nextRows.map((lr) => {
          const nextDraft = lrDraft(lr);
          const dirty = dirtyFields.current[lr.id] || {};
          for (const key of Object.keys(dirty)) {
            if (dirty[key]) nextDraft[key] = current[lr.id]?.[key] ?? nextDraft[key];
          }
          return [lr.id, nextDraft];
        })));
        setRowMessages((current) => ({
          ...current,
          ...Object.fromEntries(Object.keys(dirtyFields.current).map((id) => [
            id, "Latest data loaded. Your unsaved changes were kept; review before saving.",
          ])),
        }));
      } else {
        dirtyFields.current = {};
        setEditingRows([]);
        setDrafts({});
      }
    } catch (e) {
      if (request === requestId.current) setError(errMsg(e));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [siteId, tripId]);

  useEffect(() => {
    loadLedger();
    const refreshLatest = () => loadLedger(true);
    window.addEventListener(DATA_CHANGE_EVENT, refreshLatest);
    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, refreshLatest);
      requestId.current += 1;
    };
  }, [loadLedger]);

  const loadMore = async () => {
    const request = requestId.current;
    setLoadingMore(true);
    setError("");
    try {
      const response = await api.get(`/sites/${siteId}/trips/${tripId}/lrs`, {
        params: { limit: 100, offset },
      });
      if (request !== requestId.current) return;
      const nextRows = response.data.rows || [];
      setRows((current) => [...current, ...nextRows]);
      setOffset((current) => current + nextRows.length);
      loadedCountRef.current += nextRows.length;
    } catch (e) {
      if (request === requestId.current) setError(errMsg(e));
    } finally {
      if (request === requestId.current) setLoadingMore(false);
    }
  };

  const toggleEdit = (lr) => {
    if (editingRows.includes(lr.id)) {
      delete dirtyFields.current[lr.id];
      setEditingRows((current) => current.filter((id) => id !== lr.id));
      return;
    }
    dirtyFields.current[lr.id] = {};
    setDrafts((current) => ({ ...current, [lr.id]: lrDraft(lr) }));
    setRowErrors((current) => ({ ...current, [lr.id]: "" }));
    setEditingRows((current) => [...current, lr.id]);
  };

  const updateDraft = (lrId, key, value) => {
    dirtyFields.current[lrId] = { ...dirtyFields.current[lrId], [key]: true };
    setDrafts((current) => ({ ...current, [lrId]: { ...current[lrId], [key]: value } }));
    setRowErrors((current) => ({ ...current, [lrId]: "" }));
    setRowMessages((current) => ({ ...current, [lrId]: "" }));
  };

  const updateContainer = (lrId, index, key, value) => {
    const draft = drafts[lrId];
    updateDraft(lrId, "containers", draft.containers.map((line, lineIndex) =>
      lineIndex === index
        ? { ...line, [key]: key === "quantity" && value !== "" ? Number(value) : value }
        : line));
  };

  const saveLR = async (lr, receiverAction, receiverIdentityId, receiverIdentifier) => {
    const draft = drafts[lr.id];
    const body = {};
    const dirty = dirtyFields.current[lr.id] || {};
    for (const key of [
      "sender_name", "sender_phone", "receiver_name", "receiver_phone",
      "receiver_identifier", "goods_type",
    ]) {
      const value = draft[key].trim();
      if (dirty[key] && value !== (lr[key] || (key === "receiver_name" ? lr.receiver_label : "") || "")) {
        body[key] = value;
      }
    }
    const containers = draft.containers.map((line) => ({
      type: line.type.trim(), quantity: Number(line.quantity),
    }));
    if (dirty.containers && JSON.stringify(containers) !== JSON.stringify(lr.containers || [])) body.containers = containers;
    const amountKey = (value) => value === "" || value == null ? "" : Number(value).toFixed(2);
    if (dirty.rent && amountKey(draft.rent) !== amountKey(lr.rent)) {
      body.rent = draft.rent === "" ? null : draft.rent;
      body.idempotency_key = makeIdempotencyKey();
    }
    if (dirty.hamali && amountKey(draft.hamali) !== amountKey(lr.hamali)) body.hamali = draft.hamali === "" ? null : draft.hamali;
    if (receiverAction) {
      body.receiver_match_action = receiverAction;
      body.receiver_identity_id = receiverIdentityId;
      if (receiverIdentifier !== undefined) body.receiver_identifier = receiverIdentifier;
    }
    if (!Object.keys(body).length) {
      delete dirtyFields.current[lr.id];
      setEditingRows((current) => current.filter((id) => id !== lr.id));
      return;
    }

    setSavingRows((current) => [...current, lr.id]);
    setRowErrors((current) => ({ ...current, [lr.id]: "" }));
    setRowMessages((current) => ({ ...current, [lr.id]: "" }));
    try {
      const response = await api.patch(
        `/sites/${siteId}/trips/${tripId}/lrs/${lr.id}`, body,
      );
      const saved = response.data;
      setRows((current) => current.map((row) => row.id === saved.id ? saved : row));
      setDrafts((current) => ({ ...current, [saved.id]: lrDraft(saved) }));
      delete dirtyFields.current[lr.id];
      setEditingRows((current) => current.filter((id) => id !== lr.id));
      setRowMessages((current) => ({ ...current, [lr.id]: "Saved; booking finance uses the updated LR." }));
      onSaved(saved);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.code === "receiver_match_confirmation_required") {
        const matches = detail.matches || [];
        const answer = window.prompt(
          `A similar receiver was found:\n${matches.map((match, index) => `${index + 1}. ${match.label}`).join("\n")}\nEnter a number for the same person, or D for a different person.`,
        );
        if (answer?.toUpperCase() === "D") {
          const identifier = window.prompt("Optional additional receiver identifier:") || "";
          const retryBody = {
            ...body, receiver_match_action: "different", receiver_identifier: identifier,
          };
          try {
            const response = await api.patch(
              `/sites/${siteId}/trips/${tripId}/lrs/${lr.id}`, retryBody,
            );
            const saved = response.data;
            setRows((current) => current.map((row) => row.id === saved.id ? saved : row));
            setDrafts((current) => ({ ...current, [saved.id]: lrDraft(saved) }));
            delete dirtyFields.current[lr.id];
            setEditingRows((current) => current.filter((id) => id !== lr.id));
            setRowMessages((current) => ({ ...current, [lr.id]: "Saved; booking finance uses the updated LR." }));
            onSaved(saved);
          } catch (retryError) {
            setRowErrors((current) => ({ ...current, [lr.id]: errMsg(retryError) }));
          }
        } else {
          const index = Number(answer) - 1;
          if (Number.isInteger(index) && matches[index]) {
            await saveLR(lr, "same", matches[index].id);
          } else {
            setRowErrors((current) => ({
              ...current, [lr.id]: "Receiver change cancelled; no ledger values were saved.",
            }));
          }
        }
      } else {
        setRowErrors((current) => ({ ...current, [lr.id]: errMsg(e) }));
      }
    } finally {
      setSavingRows((current) => current.filter((id) => id !== lr.id));
    }
  };

  if (loading) return <Loader label={`Loading all LRs for booking ${reportRow.trip_ref}…`} />;
  if (error && !trip) return <ErrorState text={error} onRetry={loadLedger} />;

  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">Booking ledger · {trip?.trip_ref || reportRow.trip_ref}</h3>
          <p className="text-xs text-muted">
            {trip?.operating_date || reportRow.operating_date} · {trip?.truck_no || "Truck not assigned"} · {trip?.driver_name || "Driver not assigned"} · {trip?.status || "status unavailable"}
          </p>
        </div>
        <p className="text-xs text-muted">{rows.length} of {total} LRs loaded · edits save to this booking</p>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        <span>{error}</span><Btn variant="s" onClick={loadLedger}>Retry</Btn>
      </div>}
      {!trip && !loading && <ErrorState text={error || "Could not load this booking ledger."} onRetry={loadLedger} />}
      {trip?.status !== "open" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        This booking is closed. Reopen it before making LR changes.
      </p>}
      {trip && !error && rows.length === 0 && <p className="text-sm text-muted">No LRs are linked to this booking.</p>}
      {trip && rows.length > 0 && <div className="overflow-x-auto">
        <table className="w-full min-w-[1600px] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs text-muted">
            <tr>{[
              "LR", "Sender", "Sender phone", "Receiver", "Receiver phone", "Receiver ID",
              "Goods", "Containers / Qty", "Bhada", "Hamali", "Collected", "Outstanding", "Payment status", "Action",
            ].map((label) => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((lr) => {
              const editing = editingRows.includes(lr.id);
              const saving = savingRows.includes(lr.id);
              const draft = drafts[lr.id] || lrDraft(lr);
              const receiverLocked = Boolean(lr.reconciled || Number(lr.paid_total || 0) > 0 || Number(lr.rent || 0) > 0);
              const financeLocked = trip.status !== "open" || lr.reconciled;
              return <React.Fragment key={lr.id}>
                <tr>
                  <th className="px-2 py-2 font-medium">{lr.lr_ref}</th>
                  {["sender_name", "sender_phone", "receiver_name", "receiver_phone", "receiver_identifier", "goods_type"].map((key) =>
                    <td key={key} className="px-2 py-2">
                      {editing ? <input className="fld w-32" aria-label={`${lr.lr_ref} ${key}`}
                        value={draft[key]} maxLength={key.includes("name") ? 160 : key === "receiver_identifier" ? 120 : key.includes("phone") ? 40 : 80}
                        disabled={saving || trip.status !== "open" || (key.startsWith("receiver") && key !== "receiver_phone" && receiverLocked)}
                        onChange={(event) => updateDraft(lr.id, key, event.target.value)} />
                        : (key === "receiver_name" ? lr.receiver_label || lr[key] : lr[key]) || "—"}
                    </td>)}
                  <td className="px-2 py-2">
                    {editing ? <div className="min-w-48 space-y-1">
                      {draft.containers.map((line, index) => <div key={index} className="flex gap-1">
                        <input className="fld w-28" aria-label={`${lr.lr_ref} container ${index + 1} type`}
                          value={line.type} maxLength={80} disabled={saving || trip.status !== "open"}
                          onChange={(event) => updateContainer(lr.id, index, "type", event.target.value)} />
                        <input className="fld w-20" type="number" min="1" max="1000000" step="1"
                          aria-label={`${lr.lr_ref} container ${index + 1} quantity`}
                          value={line.quantity} disabled={saving || trip.status !== "open"}
                          onChange={(event) => updateContainer(lr.id, index, "quantity", event.target.value)} />
                        {draft.containers.length > 1 && <button type="button" className="text-red-700"
                          disabled={saving} aria-label={`${lr.lr_ref} remove container ${index + 1}`}
                          onClick={() => updateDraft(lr.id, "containers",
                            draft.containers.filter((_, lineIndex) => lineIndex !== index))}>×</button>}
                      </div>)}
                      <button type="button" className="text-xs text-brand-700 underline"
                        disabled={saving || trip.status !== "open" || draft.containers.length >= 30}
                        onClick={() => updateDraft(lr.id, "containers", [
                          ...draft.containers, { type: "", quantity: 1 },
                        ])}>Add container type</button>
                    </div> : (lr.containers || []).map((line) => `${line.type} × ${line.quantity}`).join(", ")}
                  </td>
                  {["rent", "hamali"].map((key) => <td key={key} className="num px-2 py-2">
                    {editing ? <input className="fld w-28" type="number" min="0" step="0.01"
                      aria-label={`${lr.lr_ref} ${key}`}
                      value={draft[key] ?? ""} disabled={saving || financeLocked}
                      onChange={(event) => updateDraft(lr.id, key, event.target.value)} />
                      : lr[key] == null ? "—" : money0(lr[key])}
                  </td>)}
                  <td className="num px-2 py-2">{money0(lr.paid_total || 0)}</td>
                  <td className="num px-2 py-2">{lr.rent == null ? "—" : money0(lr.outstanding || 0)}</td>
                  <td className="px-2 py-2">{lr.payment_status || (lr.reconciled ? "Reconciled" : "Pending")}</td>
                  <td className="space-y-1 px-2 py-2">
                    {editing ? <div className="flex gap-1">
                      <Btn variant="s" disabled={saving || trip.status !== "open"} onClick={() => saveLR(lr)}>
                        {saving ? "Saving…" : "Save row"}
                      </Btn>
                      <Btn variant="s" disabled={saving} onClick={() => toggleEdit(lr)}>Cancel</Btn>
                    </div> : <Btn variant="s" disabled={trip.status !== "open"} onClick={() => toggleEdit(lr)}>Edit row</Btn>}
                    {rowErrors[lr.id] && <p role="alert" className="max-w-56 text-xs text-red-700">{rowErrors[lr.id]}</p>}
                    {rowMessages[lr.id] && <p role="status" className="max-w-56 text-xs text-brand-700">{rowMessages[lr.id]}</p>}
                  </td>
                </tr>
              </React.Fragment>;
            })}
          </tbody>
        </table>
      </div>}
      {offset < total && <Btn variant="s" disabled={loadingMore} onClick={loadMore}>
        {loadingMore ? "Loading LRs…" : `Load more LRs (${total - offset} remaining)`}
      </Btn>}
      <p className="text-xs text-muted">
        Collected, outstanding and payment status are calculated from posted payments and bhada; payment history is not directly editable.
        Receiver identity cannot be changed after bhada, payments or reconciliation. Finance changes and audit history are handled by the booking API.
      </p>
    </section>
  );
}

export default function BookingReports() {
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({
    from_date: monthStart(), to_date: todayISO(), site_id: "", search: "",
  });
  const [applied, setApplied] = useState(filters);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedLedger, setExpandedLedger] = useState(null);
  const requestId = useRef(0);
  const loadedCountRef = useRef(0);

  const load = useCallback(async (
    nextOffset = 0, append = false, preserveLedger = false, preserveLoadedRows = false,
  ) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries({
        ...applied, limit: PAGE_SIZE, offset: nextOffset,
      }).filter(([, value]) => value !== ""));
      const [siteResponse, reportResponse] = await Promise.all([
        api.get("/sites"),
        api.get("/sites/system-reports/lrs", { params }),
      ]);
      if (currentRequest !== requestId.current) return;
      setSites(siteResponse.data);
      const firstPage = reportResponse.data.rows || [];
      const wantedCount = preserveLoadedRows ? loadedCountRef.current : 0;
      const pageOffsets = [];
      for (let pageOffset = PAGE_SIZE; pageOffset < Math.min(wantedCount, reportResponse.data.total || 0); pageOffset += PAGE_SIZE) {
        pageOffsets.push(pageOffset);
      }
      const additionalPages = await Promise.all(pageOffsets.map((pageOffset) =>
        api.get("/sites/system-reports/lrs", {
          params: { ...params, limit: PAGE_SIZE, offset: pageOffset },
        })));
      const refreshedRows = [
        ...firstPage,
        ...additionalPages.flatMap((response) => response.data.rows || []),
      ];
      const nextRows = append ? firstPage : refreshedRows;
      setRows((current) => append ? [...current, ...nextRows] : nextRows);
      if (!preserveLedger) setExpandedLedger(null);
      setTotal(reportResponse.data.total || 0);
      const nextLoadedCount = append ? nextOffset + nextRows.length : refreshedRows.length;
      setOffset(nextLoadedCount);
      loadedCountRef.current = nextLoadedCount;
    } catch (e) {
      if (currentRequest === requestId.current) setError(errMsg(e));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    load();
    const reloadCurrentReport = () => load(0, false, true, true);
    window.addEventListener(DATA_CHANGE_EVENT, reloadCurrentReport);
    return () => window.removeEventListener(DATA_CHANGE_EVENT, reloadCurrentReport);
  }, [load]);

  const applyFilters = (event) => {
    event.preventDefault();
    setApplied({ ...filters, search: filters.search.trim() });
  };
  const hasMore = offset < total;
  const updateReportLR = (saved) => {
    setRows((current) => current.map((row) => row.id === saved.id ? { ...row, ...saved } : row));
  };
  const toggleTripLedger = (row) => {
    const key = `${row.site_id}:${row.trip_id}`;
    setExpandedLedger((current) => current?.key === key ? null : { key, row });
  };

  return (
    <div className="space-y-5">
      <PageHead title="Booking Reports"
        subtitle="Search and export paginated site-booking LR records. Industrial shipment reports remain separate."
        actions={<>
          <Btn variant="s" icon={Download} disabled={!rows.length}
            onClick={() => exportCSV("booking-lr-report-loaded-rows", COLUMNS, safeExportRows(rows))}>
            Export loaded LRs
          </Btn>
          <Btn variant="s" icon={Printer} onClick={() => window.print()}>Print</Btn>
        </>} />
      <Card className="p-4">
        <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">From
            <input className={field} type="date" value={filters.from_date}
              onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} />
          </label>
          <label className="text-sm">To
            <input className={field} type="date" value={filters.to_date}
              onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} />
          </label>
          <label className="text-sm">Site
            <select className={field} value={filters.site_id}
              onChange={(event) => setFilters({ ...filters, site_id: event.target.value })}>
              <option value="">All sites</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Search LRs
            <input className={field} maxLength={120} value={filters.search}
              placeholder="LR, receiver, goods, booking"
              onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          </label>
          <div className="flex items-end">
            <Btn type="submit" className="w-full justify-center">Apply filters</Btn>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted">
          {total.toLocaleString("en-IN")} matching LRs · {applied.from_date} to {applied.to_date} · Select a booking to open its complete LR ledger for editing. Collections, outstanding, and payment status are calculated from posted payments and bhada.
          Date ranges may be up to 366 days.
        </p>
      </Card>
      {error && <ErrorState text={error} onRetry={() => load()} />}
      {loading && rows.length === 0 ? <Loader label="Loading booking reports…" /> : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1550px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-canvas text-xs text-muted">
                <tr>
                  {[...COLUMNS, { key: "actions", label: "Actions" }].map((column) =>
                    <th key={column.key} className="px-3 py-3 font-medium">{column.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const ledgerKey = `${row.site_id}:${row.trip_id}`;
                  const ledgerOpen = expandedLedger?.key === ledgerKey;
                  return <React.Fragment key={`${row.site_id}-${row.id}`}>
                    <tr className="hover:bg-canvas/70">
                      <td className="px-3 py-3">{row.operating_date}</td>
                      <td className="px-3 py-3">{row.site_name}</td>
                      <td className="px-3 py-3">
                        <button type="button" className="font-medium text-brand-700 underline"
                          aria-expanded={ledgerOpen}
                          onClick={() => toggleTripLedger(row)}>
                          {row.trip_ref || "Open booking"}
                        </button>
                      </td>
                      <td className="px-3 py-3 font-medium">{row.lr_ref}</td>
                      <td className="px-3 py-3">{row.sender_name || "—"}</td>
                      <td className="px-3 py-3">{row.receiver_label || row.receiver_name || "—"}</td>
                      <td className="px-3 py-3">{row.sender_phone || "—"}</td>
                      <td className="px-3 py-3">{row.receiver_phone || "—"}</td>
                      <td className="px-3 py-3">{row.receiver_identifier || "—"}</td>
                      <td className="px-3 py-3">{row.goods_type || "—"}</td>
                      <td className="num px-3 py-3">{row.total_quantity ?? 0}</td>
                      <td className="num px-3 py-3">{row.rent == null ? "—" : money0(row.rent)}</td>
                      <td className="num px-3 py-3">{row.hamali == null ? "—" : money0(row.hamali)}</td>
                      <td className="num px-3 py-3">{row.paid_total === undefined ? "—" : money0(row.paid_total)}</td>
                      <td className="num px-3 py-3">{row.rent == null || row.outstanding === undefined
                        ? "—" : money0(row.outstanding)}</td>
                      <td className="px-3 py-3">{row.payment_status || (row.reconciled ? "Reconciled" : "Pending")}</td>
                      <td className="px-3 py-3">
                        <Btn variant="s" icon={Pencil} aria-expanded={ledgerOpen}
                          onClick={() => toggleTripLedger(row)}>{ledgerOpen ? "Close ledger" : "Open ledger"}</Btn>
                      </td>
                    </tr>
                    {ledgerOpen && <tr>
                      <td colSpan={COLUMNS.length + 1} className="bg-canvas p-3">
                        <TripLedgerPanel reportRow={expandedLedger.row} onSaved={updateReportLR} />
                      </td>
                    </tr>}
                  </React.Fragment>;
                })}
                {!loading && rows.length === 0 && <tr><td colSpan={COLUMNS.length + 1} className="px-4 py-10 text-center text-muted">
                  No booking LRs match these filters.
                </td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">Showing {rows.length} of {total} matching LRs</span>
            {hasMore && <Btn variant="s" disabled={loading} onClick={() => load(offset, true)}>
              {loading ? "Loading…" : "Load more"}
            </Btn>}
          </div>
        </Card>
      )}
    </div>
  );
}
