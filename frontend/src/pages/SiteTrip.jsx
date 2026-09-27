import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errMsg } from "../lib/api";
import { Btn, Card, ErrorState, Loader, PageHead } from "../components/ui";
import { money, todayISO } from "../lib/format";
import { DATA_CHANGE_EVENT } from "../lib/realtime";

const field = "fld w-full";
const makeIdempotencyKey = () => window.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const blankLR = () => ({
  sender_name: "", sender_phone: "", receiver_name: "", receiver_phone: "", receiver_identifier: "", goods_type: "",
  containers: [{ type: "", quantity: 1 }], rent: "", hamali: "",
});
const ledgerDraftFor = (lr) => ({
  sender_name: lr.sender_name || "",
  receiver_name: lr.receiver_name || "",
  goods_type: lr.goods_type || "",
  containers: (lr.containers || []).map((line) => ({ ...line })),
});
const mergeDirtyDrafts = (fresh, previous, dirtyFields) => Object.fromEntries(
  Object.entries(fresh).map(([id, values]) => {
    const merged = { ...values };
    for (const key of Object.keys(dirtyFields[id] || {})) {
      if (dirtyFields[id][key]) merged[key] = previous[id]?.[key] ?? merged[key];
    }
    return [id, merged];
  }),
);

function saveBlob(response, fallback) {
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fallback;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SiteTrip({ user }) {
  const { siteId, tripId } = useParams();
  const navigate = useNavigate();
  const owner = user?.role === "owner";
  const sitePermissions = user?.site_permissions?.[siteId] || [];
  const canEditLRs = owner || sitePermissions.includes("lrs:update");
  const canEditFinance = owner || sitePermissions.includes("finance:update");
  const canReadExpenses = owner || sitePermissions.includes("finance:read") || sitePermissions.includes("finance:update");
  const ledgerColumnCount = canReadExpenses ? 8 : 6;
  const canAddExpenses = owner || sitePermissions.includes("finance:update");
  const [trip, setTrip] = useState(null);
  const [tripEdit, setTripEdit] = useState({ truck_no: "", driver_name: "", vehicle_id: "", driver_id: "" });
  const [tripResources, setTripResources] = useState({ vehicles: [], drivers: [] });
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({
    description: "", category: "", amount: "", date: todayISO(), payment_method: "", payee: "",
  });
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [expenseTotal, setExpenseTotal] = useState("0.00");
  const [expenseIdempotencyKey, setExpenseIdempotencyKey] = useState(makeIdempotencyKey);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [expenseMessage, setExpenseMessage] = useState("");
  const [lrs, setLrs] = useState([]);
  const [chargeDrafts, setChargeDrafts] = useState({});
  const [ledgerDrafts, setLedgerDrafts] = useState({});
  const [editingLedgerIds, setEditingLedgerIds] = useState([]);
  const [savingLedgerIds, setSavingLedgerIds] = useState([]);
  const [ledgerErrors, setLedgerErrors] = useState({});
  const [savingChargeIds, setSavingChargeIds] = useState([]);
  const [chargeErrors, setChargeErrors] = useState({});
  const [chargeMessages, setChargeMessages] = useState({});
  const [lrTotal, setLrTotal] = useState(0);
  const [lrOffset, setLrOffset] = useState(0);
  const [categories, setCategories] = useState({ goods: [], containers: [] });
  const [form, setForm] = useState(blankLR);
  const [receiverMatches, setReceiverMatches] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const chargeDirtyFields = useRef({});
  const ledgerDirtyFields = useRef({});
  const tripDirtyFields = useRef({});
  const lrOffsetRef = useRef(0);

  const refreshExpenses = useCallback(async () => {
    if (!canReadExpenses) {
      setExpenseLoading(false);
      return;
    }
    setExpenseLoading(true);
    setExpenseError("");
    try {
      const response = await api.get(`/sites/${siteId}/trips/${tripId}/expenses`);
      const data = response.data;
      const rows = Array.isArray(data) ? data : data?.expenses || data?.rows || [];
      setExpenses(rows);
      setExpenseTotal(data?.total_amount ?? rows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
      setExpenseCategories(data?.expense_categories || []);
      setPaymentModes(data?.payment_modes || []);
    } catch (e) { setExpenseError(errMsg(e)); }
    finally { setExpenseLoading(false); }
  }, [canReadExpenses, siteId, tripId]);

  const refresh = useCallback(async (preserveDrafts = false) => {
    setLoading(true);
    setError("");
    try {
      const [tripResponse, lrResponse, categoryResponse, resourcesResponse] = await Promise.all([
        api.get(`/sites/${siteId}/trips/${tripId}`),
        api.get(`/sites/${siteId}/trips/${tripId}/lrs`, { params: { limit: 100, offset: 0 } }),
        api.get(`/sites/${siteId}/categories`),
        api.get(`/sites/${siteId}/trip-resources`),
      ]);
      const wantedCount = preserveDrafts ? lrOffsetRef.current : 0;
      const pageOffsets = [];
      for (let pageOffset = 100; pageOffset < Math.min(wantedCount, lrResponse.data.total); pageOffset += 100) {
        pageOffsets.push(pageOffset);
      }
      const additionalPages = await Promise.all(pageOffsets.map((pageOffset) =>
        api.get(`/sites/${siteId}/trips/${tripId}/lrs`, {
          params: { limit: 100, offset: pageOffset },
        })));
      const nextLRs = [
        ...(lrResponse.data.rows || []),
        ...additionalPages.flatMap((response) => response.data.rows || []),
      ];
      setTrip(tripResponse.data);
      const nextTripEdit = {
        truck_no: tripResponse.data.truck_no, driver_name: tripResponse.data.driver_name,
        vehicle_id: tripResponse.data.vehicle_id || "", driver_id: tripResponse.data.driver_id || "",
      };
      setTripEdit((current) => preserveDrafts
        ? { ...nextTripEdit, ...Object.fromEntries(Object.keys(tripDirtyFields.current).map((key) => [key, current[key]])) }
        : nextTripEdit);
      setLrs(nextLRs);
      const nextChargeDrafts = Object.fromEntries(nextLRs.map((lr) => [lr.id, {
        rent: lr.rent ?? "",
        hamali: lr.hamali ?? "",
      }]));
      const nextLedgerDrafts = Object.fromEntries(nextLRs.map((lr) => [lr.id, ledgerDraftFor(lr)]));
      setChargeDrafts((current) => preserveDrafts
        ? mergeDirtyDrafts(nextChargeDrafts, current, chargeDirtyFields.current)
        : nextChargeDrafts);
      setLedgerDrafts((current) => preserveDrafts
        ? mergeDirtyDrafts(nextLedgerDrafts, current, ledgerDirtyFields.current)
        : nextLedgerDrafts);
      if (!preserveDrafts) {
        chargeDirtyFields.current = {};
        ledgerDirtyFields.current = {};
        tripDirtyFields.current = {};
      } else if (
        Object.keys(chargeDirtyFields.current).length
        || Object.keys(ledgerDirtyFields.current).length
        || Object.keys(tripDirtyFields.current).length
      ) {
        setMessage("Latest data loaded. Your unsaved edits were kept; review before saving.");
      }
      setLrTotal(lrResponse.data.total);
      setLrOffset(nextLRs.length);
      lrOffsetRef.current = nextLRs.length;
      setCategories(categoryResponse.data);
      setTripResources(resourcesResponse.data);
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }, [siteId, tripId]);

  useEffect(() => {
    refresh();
    const refreshLatest = () => refresh(true);
    window.addEventListener(DATA_CHANGE_EVENT, refreshLatest);
    return () => window.removeEventListener(DATA_CHANGE_EVENT, refreshLatest);
  }, [refresh]);
  useEffect(() => {
    refreshExpenses();
    window.addEventListener(DATA_CHANGE_EVENT, refreshExpenses);
    return () => window.removeEventListener(DATA_CHANGE_EVENT, refreshExpenses);
  }, [refreshExpenses]);
  const addExpense = async (event) => {
    event.preventDefault();
    setExpenseSubmitting(true);
    setExpenseError("");
    setExpenseMessage("");
    try {
      await api.post(`/sites/${siteId}/trips/${tripId}/expenses`, {
        description: expenseForm.description.trim(),
        category: expenseForm.category.trim(),
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
        payment_method: expenseForm.payment_method,
        payee: expenseForm.payee.trim() || null,
        idempotency_key: expenseIdempotencyKey,
      });
      setExpenseIdempotencyKey(makeIdempotencyKey());
      setExpenseForm({
        description: "", category: "", amount: "", date: todayISO(), payment_method: "", payee: "",
      });
      setExpenseMessage("Expense posted to the trip ledger and cashbook.");
      await refreshExpenses();
    } catch (e) { setExpenseError(errMsg(e)); }
    finally { setExpenseSubmitting(false); }
  };

  const updateExpenseForm = (key, value) => {
    setExpenseForm((current) => ({ ...current, [key]: value }));
    setExpenseIdempotencyKey(makeIdempotencyKey());
  };

  const loadMoreLRs = async () => {
    try {
      const response = await api.get(`/sites/${siteId}/trips/${tripId}/lrs`, {
        params: { limit: 100, offset: lrOffset },
      });
      setLrs((current) => [...current, ...response.data.rows]);
      setChargeDrafts((current) => ({
        ...current,
        ...Object.fromEntries(response.data.rows.map((lr) => [lr.id, {
          rent: lr.rent ?? "",
          hamali: lr.hamali ?? "",
        }])),
      }));
      setLedgerDrafts((current) => ({
        ...current,
        ...Object.fromEntries(response.data.rows.map((lr) => [lr.id, ledgerDraftFor(lr)])),
      }));
      const nextOffset = lrOffset + response.data.rows.length;
      setLrOffset(nextOffset);
      lrOffsetRef.current = nextOffset;
    } catch (e) { setError(errMsg(e)); }
  };

  const saveLRCharges = async (lr) => {
    const draft = chargeDrafts[lr.id] || { rent: lr.rent ?? "", hamali: lr.hamali ?? "" };
    const amountKey = (value) => value === "" || value == null ? "" : Number(value).toFixed(2);
    const body = {};
    const dirty = chargeDirtyFields.current[lr.id] || {};
    if (dirty.rent && amountKey(draft.rent) !== amountKey(lr.rent)) body.rent = draft.rent === "" ? null : draft.rent;
    if (dirty.hamali && amountKey(draft.hamali) !== amountKey(lr.hamali)) body.hamali = draft.hamali === "" ? null : draft.hamali;
    if (!Object.keys(body).length) return;
    if ("rent" in body) body.idempotency_key = draft.idempotency_key || makeIdempotencyKey();
    setSavingChargeIds((current) => [...current, lr.id]);
    setError("");
    setMessage("");
    setChargeErrors((current) => ({ ...current, [lr.id]: "" }));
    setChargeMessages((current) => ({ ...current, [lr.id]: "" }));
    try {
      const response = await api.patch(
        `/sites/${siteId}/trips/${tripId}/lrs/${lr.id}`, body,
      );
      const saved = response.data;
      setLrs((current) => current.map((item) => item.id === saved.id ? saved : item));
      setChargeDrafts((current) => ({
        ...current,
        [saved.id]: { rent: saved.rent ?? "", hamali: saved.hamali ?? "" },
      }));
      delete chargeDirtyFields.current[lr.id];
      setChargeMessages((current) => ({ ...current, [saved.id]: "Saved" }));
      setMessage(`${lr.lr_ref} charges saved. Booking finance and reports use the updated LR.`);
    } catch (e) {
      setChargeErrors((current) => ({ ...current, [lr.id]: errMsg(e) }));
      setError(errMsg(e));
    } finally {
      setSavingChargeIds((current) => current.filter((id) => id !== lr.id));
    }
  };

  const updateChargeDraft = (lrId, key, value) => {
    chargeDirtyFields.current[lrId] = { ...chargeDirtyFields.current[lrId], [key]: true };
    setChargeDrafts((current) => ({
      ...current,
      [lrId]: {
        ...(current[lrId] || {}),
        [key]: value,
        ...(key === "rent" ? { idempotency_key: makeIdempotencyKey() } : {}),
      },
    }));
    setChargeErrors((current) => ({ ...current, [lrId]: "" }));
    setChargeMessages((current) => ({ ...current, [lrId]: "" }));
  };

  const updateLedgerDraft = (lr, key, value) => {
    ledgerDirtyFields.current[lr.id] = { ...ledgerDirtyFields.current[lr.id], [key]: true };
    setLedgerDrafts((current) => ({
      ...current,
      [lr.id]: { ...(current[lr.id] || ledgerDraftFor(lr)), [key]: value },
    }));
    setLedgerErrors((current) => ({ ...current, [lr.id]: "" }));
  };

  const updateLedgerContainer = (lr, index, key, value) => {
    const draft = ledgerDrafts[lr.id] || ledgerDraftFor(lr);
    updateLedgerDraft(lr, "containers", draft.containers.map((line, row) =>
      row === index ? { ...line, [key]: key === "quantity" && value !== "" ? Number(value) : value } : line));
  };

  const updateTripDraft = (fields) => {
    for (const key of Object.keys(fields)) tripDirtyFields.current[key] = true;
    setTripEdit((current) => ({ ...current, ...fields }));
  };

  const saveLedgerDetails = async (lr, receiverAction, receiverIdentityId) => {
    const draft = ledgerDrafts[lr.id] || ledgerDraftFor(lr);
    const body = {};
    const dirty = ledgerDirtyFields.current[lr.id] || {};
    for (const key of ["sender_name", "receiver_name", "goods_type"]) {
      const value = draft[key].trim();
      if (dirty[key] && value !== (lr[key] || "")) body[key] = value;
    }
    const containers = draft.containers.map((line) => ({
      type: line.type.trim(),
      quantity: Number(line.quantity),
    }));
    if (dirty.containers && JSON.stringify(containers) !== JSON.stringify(lr.containers || [])) body.containers = containers;
    if (!Object.keys(body).length) {
      delete ledgerDirtyFields.current[lr.id];
      setEditingLedgerIds((current) => current.filter((id) => id !== lr.id));
      return;
    }
    if ("receiver_name" in body) {
      body.receiver_match_action = receiverAction;
      body.receiver_identity_id = receiverIdentityId;
    }

    setSavingLedgerIds((current) => [...current, lr.id]);
    setLedgerErrors((current) => ({ ...current, [lr.id]: "" }));
    try {
      const response = await api.patch(`/sites/${siteId}/trips/${tripId}/lrs/${lr.id}`, body);
      const saved = response.data;
      setLrs((current) => current.map((item) => item.id === saved.id ? saved : item));
      setLedgerDrafts((current) => ({ ...current, [saved.id]: ledgerDraftFor(saved) }));
      delete ledgerDirtyFields.current[lr.id];
      setEditingLedgerIds((current) => current.filter((id) => id !== lr.id));
      setMessage(`${lr.lr_ref} ledger row saved. Booking finance and reports use the updated LR.`);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.code === "receiver_match_confirmation_required") {
        const choices = detail.matches || [];
        const answer = window.prompt(
          `A similar receiver was found:\n${choices.map((match, index) => `${index + 1}. ${match.label}`).join("\n")}\nEnter a number for the same person, or D for a different person.`,
        );
        if (answer?.toUpperCase() === "D") {
          const identifier = window.prompt("Optional additional receiver identifier:") || "";
          await api.patch(`/sites/${siteId}/trips/${tripId}/lrs/${lr.id}`, {
            ...body, receiver_match_action: "different", receiver_identifier: identifier,
          }).then((response) => {
            const saved = response.data;
            setLrs((current) => current.map((item) => item.id === saved.id ? saved : item));
            setLedgerDrafts((current) => ({ ...current, [saved.id]: ledgerDraftFor(saved) }));
            delete ledgerDirtyFields.current[lr.id];
            setEditingLedgerIds((current) => current.filter((id) => id !== lr.id));
            setMessage(`${lr.lr_ref} ledger row saved. Booking finance and reports use the updated LR.`);
          }).catch((saveError) => {
            setLedgerErrors((current) => ({ ...current, [lr.id]: errMsg(saveError) }));
          });
        } else {
          const index = Number(answer) - 1;
          if (Number.isInteger(index) && choices[index]) {
            await saveLedgerDetails(lr, "same", choices[index].id);
          }
        }
      } else {
        setLedgerErrors((current) => ({ ...current, [lr.id]: errMsg(e) }));
      }
    } finally {
      setSavingLedgerIds((current) => current.filter((id) => id !== lr.id));
    }
  };

  const toggleLedgerEdit = (lr) => {
    if (editingLedgerIds.includes(lr.id)) {
      delete ledgerDirtyFields.current[lr.id];
      setEditingLedgerIds((current) => current.filter((id) => id !== lr.id));
      return;
    }
    setLedgerDrafts((current) => ({ ...current, [lr.id]: ledgerDraftFor(lr) }));
    setLedgerErrors((current) => ({ ...current, [lr.id]: "" }));
    setEditingLedgerIds((current) => [...current, lr.id]);
  };

  const createLR = async (event, matchAction, identityId) => {
    event?.preventDefault();
    const body = {
      ...form,
      rent: form.rent === "" ? null : form.rent,
      hamali: form.hamali === "" ? null : form.hamali,
      receiver_match_action: matchAction,
      receiver_identity_id: identityId,
    };
    try {
      const response = await api.post(`/sites/${siteId}/trips/${tripId}/lrs`, body);
      setReceiverMatches(null);
      navigate(`/sites/${siteId}/trips/${tripId}/lrs/${response.data.id}?autoprint=1`);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.code === "receiver_match_confirmation_required") {
        setReceiverMatches(detail.matches || []);
      } else setError(errMsg(e));
    }
  };

  const closeTrip = async () => {
    try {
      if (trip.status === "open") {
        await api.post(`/sites/${siteId}/trips/${tripId}/close`);
        setMessage("Trip closed.");
      } else if (owner) {
        const reason = window.prompt("Reason for reopening this trip (required):");
        if (!reason) return;
        await api.post(`/sites/${siteId}/trips/${tripId}/reopen`, { reason });
        setMessage("Trip reopened; the reason is recorded in the audit history.");
      }
      await refresh();
    } catch (e) { setError(errMsg(e)); }
  };

  const updateTrip = async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(Object.keys(tripDirtyFields.current)
      .map((key) => [key, tripEdit[key]]));
    if (!Object.keys(body).length) return;
    try {
      if ("vehicle_id" in body) body.vehicle_id = body.vehicle_id || null;
      if ("driver_id" in body) body.driver_id = body.driver_id || null;
      await api.patch(`/sites/${siteId}/trips/${tripId}`, body);
      tripDirtyFields.current = {};
      setMessage("Trip details updated and recorded in the audit history.");
      await refresh();
    } catch (e) { setError(errMsg(e)); }
  };

  const downloadLedger = async (section) => {
    try {
      const response = await api.get(
        `/sites/${siteId}/trips/${tripId}/ledger/${section}`, { responseType: "blob" },
      );
      saveBlob(response, `${trip.trip_ref}-${section}.csv`);
    } catch (e) {
      if (section === "goods-detail" && e?.response?.status === 404) {
        setMessage("Goods-detail export is not available on this server yet. The existing goods-wise export remains available.");
      } else setError(errMsg(e));
    }
  };

  const uploadLedger = async (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.ledger.files[0];
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    try {
      const response = await api.post(
        `/sites/${siteId}/trips/${tripId}/ledger-imports`, data,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setImportPreview(response.data);
      setMessage(response.data.already_processed ? "This upload was already reconciled." : "Ledger preview is ready. Review every discrepancy before applying.");
    } catch (e) { setError(errMsg(e)); }
  };

  const editPreview = async (rowIndex, fieldName, value) => {
    const next = { ...importPreview, rows: importPreview.rows.map((row, index) =>
      index === rowIndex ? { ...row, source: { ...row.source, [fieldName]: value } } : row),
      ready_to_commit: false };
    setImportPreview(next);
  };

  const savePreview = async () => {
    try {
      const response = await api.put(
        `/sites/${siteId}/trips/${tripId}/ledger-imports/${importPreview.id}/preview`,
        { rows: importPreview.rows.filter((row) => row.row_number).map((row) => ({
          row_number: row.row_number,
          lr_id: row.source.lr_id,
          rent: row.source.rent,
          hamali: row.source.hamali,
          paid_total: row.source.paid_total,
          payment_date: row.source.payment_date,
          payment_method: row.source.payment_method,
          transaction_reference: row.source.transaction_reference,
          skip: Boolean(row.skip),
        })) },
      );
      setImportPreview(response.data);
      setMessage("Preview changes saved and validated.");
    } catch (e) { setError(errMsg(e)); }
  };

  const commitImport = async () => {
    if (!window.confirm("Apply these ledger changes to the trip? This action updates financial records.")) return;
    try {
      const response = await api.post(
        `/sites/${siteId}/trips/${tripId}/ledger-imports/${importPreview.id}/commit`,
        { confirm: true, acknowledged_missing_lr_ids: importPreview.acknowledged_missing_lr_ids || [] },
      );
      setImportPreview(response.data);
      setMessage(`Reconciliation ${response.data.status}. Unreconciled LRs: ${response.data.unreconciled_lrs ?? response.data.summary?.missing_lr_ids?.length ?? 0}.`);
      await refresh();
    } catch (e) { setError(errMsg(e)); }
  };

  const setContainer = (index, key, value) => setForm((current) => ({
    ...current, containers: current.containers.map((line, row) =>
      row === index ? { ...line, [key]: key === "quantity" ? Number(value) : value } : line),
  }));

  if (loading && !trip) return <Loader label="Loading booking…" />;
  if (error && !trip) return <ErrorState text={error} onRetry={refresh} />;
  if (!trip) return null;

  return (
    <div className="space-y-5">
      <PageHead title={`Booking ${trip.trip_ref}`} subtitle={`${trip.operating_date} · Truck ${trip.truck_no} · Driver ${trip.driver_name}`} />
      {error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <Link className="text-sm text-brand-700 underline" to="/sites">Back to bookings</Link>
        <span className="rounded-full bg-canvas px-3 py-1 text-sm font-medium">Booking {trip.status}</span>
        {(trip.status === "open" || owner) && <Btn onClick={closeTrip}>{trip.status === "open" ? "Close booking" : "Reopen booking"}</Btn>}
      </div>
      {trip.status === "open" && <Card className="p-4">
        <h2 className="mb-3 font-semibold">Booking truck and driver</h2>
        <form onSubmit={updateTrip} className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Vehicle
            <select className={field} aria-label="Select a vehicle or enter manually" value={tripEdit.vehicle_id}
              onChange={(e) => {
                const vehicle = tripResources.vehicles.find((row) => row.id === e.target.value);
                updateTripDraft({ vehicle_id: e.target.value, truck_no: vehicle?.vehicle_no || tripEdit.truck_no });
              }}>
              <option value="">Enter a truck number manually</option>
              {tripEdit.vehicle_id && !tripResources.vehicles.some((row) => row.id === tripEdit.vehicle_id) &&
                <option value={tripEdit.vehicle_id}>{tripEdit.truck_no} · previously assigned</option>}
              {tripResources.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>
                {vehicle.vehicle_no}{vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ""} · {vehicle.status || "Active"}
              </option>)}
            </select>
            {!tripEdit.vehicle_id && <input className={field} aria-label="Truck number" required value={tripEdit.truck_no}
              onChange={(e) => updateTripDraft({ truck_no: e.target.value })} />}
            {tripEdit.vehicle_id && <p className="mt-1 text-xs text-muted">Selected: {tripEdit.truck_no}</p>}
          </label>
          <label className="text-sm">Driver
            <select className={field} aria-label="Select a driver or enter manually" value={tripEdit.driver_id}
              onChange={(e) => {
                const driver = tripResources.drivers.find((row) => row.id === e.target.value);
                updateTripDraft({ driver_id: e.target.value, driver_name: driver?.name || tripEdit.driver_name });
              }}>
              <option value="">Enter a driver name manually</option>
              {tripEdit.driver_id && !tripResources.drivers.some((row) => row.id === tripEdit.driver_id) &&
                <option value={tripEdit.driver_id}>{tripEdit.driver_name} · previously assigned</option>}
              {tripResources.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
            </select>
            {!tripEdit.driver_id && <input className={field} aria-label="Driver name" required value={tripEdit.driver_name}
              onChange={(e) => updateTripDraft({ driver_name: e.target.value })} />}
            {tripEdit.driver_id && <p className="mt-1 text-xs text-muted">Selected: {tripEdit.driver_name}</p>}
          </label>
          <Btn type="submit">Save booking details</Btn>
        </form>
      </Card>}

      {trip.status === "open" && <Card className="p-4">
        <h2 className="mb-3 font-semibold">Book a lorry receipt</h2>
        <form onSubmit={(e) => createLR(e)} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">Sender<input className={field} required value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} /></label>
            <label className="text-sm">Sender phone (optional)<input className={field} type="tel" autoComplete="tel" inputMode="tel" value={form.sender_phone} onChange={(e) => setForm({ ...form, sender_phone: e.target.value })} /></label>
            <label className="text-sm">Receiver<input className={field} required value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} /></label>
            <label className="text-sm">Receiver phone (optional)<input className={field} type="tel" autoComplete="tel" inputMode="tel" value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} /></label>
            <label className="text-sm">Goods type<input className={field} list="goods-categories" required value={form.goods_type} onChange={(e) => setForm({ ...form, goods_type: e.target.value })} /><datalist id="goods-categories">{categories.goods.map((x) => <option key={x} value={x} />)}</datalist></label>
            <label className="text-sm">Bhada (optional)<input className={field} type="number" min="0" step="0.01" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} /></label>
            <label className="text-sm">Hamali (internal only)<input className={field} type="number" min="0" step="0.01" value={form.hamali} onChange={(e) => setForm({ ...form, hamali: e.target.value })} /></label>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Containers and quantities</h3>
              <button type="button" className="text-sm text-brand-700 underline" onClick={() => setForm({ ...form, containers: [...form.containers, { type: "", quantity: 1 }] })}>Add container type</button>
            </div>
            {form.containers.map((line, index) => <div key={index} className="mb-2 grid grid-cols-[minmax(0,1fr)_5.5rem_auto] gap-2">
              <input className={field} list="container-categories" aria-label="Container type" required placeholder="e.g. Box" value={line.type} onChange={(e) => setContainer(index, "type", e.target.value)} />
              <input className={field} type="number" min="1" step="1" aria-label="Quantity" required value={line.quantity} onChange={(e) => setContainer(index, "quantity", e.target.value)} />
              {form.containers.length > 1 && <button type="button" className="px-2 text-red-700" aria-label="Remove container type" onClick={() => setForm({ ...form, containers: form.containers.filter((_, i) => i !== index) })}>Remove</button>}
            </div>)}
            <datalist id="container-categories">{categories.containers.map((x) => <option key={x} value={x} />)}</datalist>
            <p className="text-xs text-muted">Total parcels: {form.containers.reduce((total, item) => total + (Number(item.quantity) || 0), 0)}</p>
          </div>
          <Btn type="submit">Create LR</Btn>
        </form>
        {receiverMatches && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4" role="alert">
          <h3 className="font-semibold">Similar receiver found for this site and date</h3>
          <p className="my-2 text-sm">Choose the same person, or confirm this is a different receiver.</p>
          {receiverMatches.map((match) => <button key={match.id} type="button" onClick={() => createLR(null, "same", match.id)}
            className="mr-2 rounded border bg-white px-3 py-2 text-sm">{match.label}{match.identifier ? ` · ${match.identifier}` : ""} — Same person</button>)}
          <div className="mt-3 flex flex-wrap gap-2">
            <input className={field} aria-label="Receiver identifier" placeholder="Identifier, if available" value={form.receiver_identifier}
              onChange={(e) => setForm({ ...form, receiver_identifier: e.target.value })} />
            <Btn onClick={() => createLR(null, "different")}>Different person</Btn>
          </div>
          <button type="button" className="mt-2 text-sm underline" onClick={() => setReceiverMatches(null)}>Cancel</button>
        </div>}
      </Card>}

      {canReadExpenses && <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Trip expenses</h2>
            <p className="mt-1 text-sm text-muted">Expenses post to the existing business ledger and cashbook.</p>
          </div>
          <div className="rounded-lg bg-canvas px-3 py-2 text-right">
            <p className="text-xs text-muted">Recorded expenses · {expenses.length}</p>
            <p className="font-semibold">{money(expenseTotal, false)}</p>
          </div>
        </div>
        {expenseError && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{expenseError}</div>}
        {expenseMessage && <div role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{expenseMessage}</div>}
        {canAddExpenses && trip.status === "open" && !expenseLoading
          && (!expenseCategories.length || !paymentModes.length)
          && <p role="alert" className="text-sm text-amber-800">
            Expense categories and payment methods are not configured for this business.
          </p>}
        {canAddExpenses && trip.status === "open" && !expenseLoading
          && expenseCategories.length > 0 && paymentModes.length > 0
          && <form onSubmit={addExpense} className="grid gap-3 border-b border-line pb-4 md:grid-cols-2">
          <label className="text-sm">Description
            <input className={field} required maxLength={500} value={expenseForm.description}
              onChange={(e) => updateExpenseForm("description", e.target.value)} />
          </label>
          <label className="text-sm">Category
            <select className={field} required value={expenseForm.category}
              onChange={(e) => updateExpenseForm("category", e.target.value)}>
              <option value="">Select a category</option>
              {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-sm">Amount
            <input className={field} type="number" min="0.01" step="0.01" required value={expenseForm.amount}
              onChange={(e) => updateExpenseForm("amount", e.target.value)} />
          </label>
          <label className="text-sm">Date
            <input className={field} type="date" required value={expenseForm.date}
              onChange={(e) => updateExpenseForm("date", e.target.value)} />
          </label>
          <label className="text-sm">Payment method
            <select className={field} required value={expenseForm.payment_method}
              onChange={(e) => updateExpenseForm("payment_method", e.target.value)}>
              <option value="">Select a payment method</option>
              {paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </label>
          <label className="text-sm">Payee (optional)
            <input className={field} maxLength={160} value={expenseForm.payee}
              onChange={(e) => updateExpenseForm("payee", e.target.value)} />
          </label>
          <div className="md:col-span-2">
            <Btn type="submit" disabled={expenseSubmitting}>
              {expenseSubmitting ? "Posting expense…" : "Post expense"}
            </Btn>
          </div>
        </form>}
        {expenseLoading ? <Loader label="Loading trip expenses…" /> : expenses.length === 0
          ? <p className="text-sm text-muted">No expenses have been recorded for this trip.</p>
          : <div className="space-y-2">
            {expenses.map((expense) => <article key={expense.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line p-3">
              <div className="min-w-0">
                <p className="break-words font-medium">{expense.description || expense.remarks || expense.category}</p>
                <p className="mt-1 text-sm text-muted">
                  {expense.category}{expense.date ? ` · ${expense.date}` : ""}
                  {(expense.payment_method || expense.mode) ? ` · ${expense.payment_method || expense.mode}` : ""}
                  {(expense.payee || expense.vendor) ? ` · Paid to ${expense.payee || expense.vendor}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {expense.recorded_by_name || expense.recorded_by || expense.created_by_name || expense.created_by
                    ? `Recorded by ${expense.recorded_by_name || expense.recorded_by || expense.created_by_name || expense.created_by}`
                    : "Recorder not specified"}
                  {(expense.accountable_driver_name || expense.driver_name)
                    ? ` · Accountable driver: ${expense.accountable_driver_name || expense.driver_name}` : ""}
                </p>
              </div>
              <strong className="shrink-0">{money(expense.amount, false)}</strong>
            </article>)}
          </div>}
      </Card>}

      {!owner && !canEditLRs && <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Lorry receipts ({lrs.length} of {lrTotal})</h2>
        </div>
        {lrs.length === 0 ? <p className="text-sm text-muted">No LRs are recorded for this trip.</p> :
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {lrs.map((lr) => <article key={lr.id} className="rounded-lg border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <Link className="font-semibold text-brand-700 underline" to={`/sites/${siteId}/trips/${tripId}/lrs/${lr.id}`}>{lr.lr_ref}</Link>
                <span className="text-right text-xs text-muted">{lr.payment_status || (lr.reconciled ? "Reconciled" : "Pending")}</span>
              </div>
              <p className="mt-2 break-words text-sm font-medium">{lr.receiver_label || lr.receiver_name}</p>
              <p className="mt-1 break-words text-sm">{lr.goods_type} · {lr.total_quantity} parcels</p>
              <p className="mt-1 text-xs text-muted">{lr.containers.map((c) => `${c.type} × ${c.quantity}`).join(", ")}</p>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
                <span>Bhada {lr.rent ?? "Not entered"}</span>
                {lr.outstanding !== undefined && <strong className="num">Due {lr.outstanding}</strong>}
              </div>
            </article>)}
          </div>}
        {lrs.length < lrTotal && <Btn variant="s" className="mt-3" onClick={loadMoreLRs}>Load more LRs</Btn>}
      </Card>}

      {canEditLRs && <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Trip ledger</h2>
            <p className="mt-1 text-sm text-muted">
              Edit LR details directly in this trip. Saved changes update the booking record, finance, and reports.
            </p>
          </div>
          <span className="text-xs text-muted">{lrs.length} of {lrTotal} LRs loaded</span>
        </div>
        {trip.status !== "open" && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Reopen this booking before editing its ledger.
        </p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs text-muted">
              <tr>
                {["LR", "Sender", "Receiver", "Goods", "Qty",
                  ...(canReadExpenses ? ["Bhada (₹)", "Hamali (₹)"] : []), "Action"].map((label) =>
                  <th key={label} className="px-3 py-2 font-medium">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lrs.map((lr) => {
                const draft = chargeDrafts[lr.id] || { rent: lr.rent ?? "", hamali: lr.hamali ?? "" };
                const canEditCharges = trip.status === "open" && !lr.reconciled && canEditFinance;
                const savingCharges = savingChargeIds.includes(lr.id);
                const editingDetails = editingLedgerIds.includes(lr.id);
                const savingDetails = savingLedgerIds.includes(lr.id);
                const ledgerDraft = ledgerDrafts[lr.id] || ledgerDraftFor(lr);
                const receiverLocked = lr.reconciled || Number(lr.paid_total || 0) > 0 || Number(lr.rent || 0) > 0;
                return <React.Fragment key={lr.id}>
                  <tr>
                    <th scope="row" className="px-3 py-2 font-medium">
                      <Link className="text-brand-700 underline" to={`/sites/${siteId}/trips/${tripId}/lrs/${lr.id}`}>{lr.lr_ref}</Link>
                    </th>
                    <td className="max-w-40 truncate px-3 py-2" title={lr.sender_name}>{lr.sender_name}</td>
                    <td className="max-w-40 truncate px-3 py-2" title={lr.receiver_label || lr.receiver_name}>
                      {lr.receiver_label || lr.receiver_name}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2" title={lr.goods_type}>{lr.goods_type}</td>
                    <td className="num px-3 py-2">{lr.total_quantity}</td>
                    {canReadExpenses && ["rent", "hamali"].map((key) => <td key={key} className="px-3 py-2">
                      {canEditFinance ? <input aria-label={`${lr.lr_ref} ${key === "rent" ? "bhada" : "hamali"}`}
                        className="fld w-32" type="number" min="0" step="0.01"
                        value={draft[key]} disabled={!canEditCharges || savingCharges}
                        onChange={(event) => updateChargeDraft(lr.id, key, event.target.value)} />
                        : <span>{lr[key] ?? "Not entered"}</span>}
                    </td>)}
                    <td className="space-y-1 px-3 py-2">
                      {canEditCharges && <Btn variant="s" disabled={savingCharges} onClick={() => saveLRCharges(lr)}>
                        {savingCharges ? "Saving…" : "Save charges"}
                      </Btn>}
                      {trip.status === "open" && <Btn variant="s" disabled={savingDetails} onClick={() => toggleLedgerEdit(lr)}>
                        {editingDetails ? "Cancel edit" : "Edit details"}
                      </Btn>}
                      {trip.status !== "open" && <span className="text-xs text-muted">Closed</span>}
                      {canEditFinance && chargeErrors[lr.id] && <p role="alert" className="mt-1 max-w-48 text-xs text-red-700">{chargeErrors[lr.id]}</p>}
                      {chargeMessages[lr.id] && <p role="status" className="mt-1 text-xs text-brand-700">{chargeMessages[lr.id]}</p>}
                    </td>
                  </tr>
                  {editingDetails && <tr>
                    <td colSpan={ledgerColumnCount} className="bg-canvas px-3 py-4">
                      <form className="space-y-3" onSubmit={(event) => {
                        event.preventDefault();
                        saveLedgerDetails(lr);
                      }}>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <label className="text-xs">Sender
                            <input className={field} required maxLength={160} value={ledgerDraft.sender_name} disabled={savingDetails}
                              onChange={(event) => updateLedgerDraft(lr, "sender_name", event.target.value)} />
                          </label>
                          <label className="text-xs">Receiver
                            <input className={field} required maxLength={160} value={ledgerDraft.receiver_name}
                              disabled={receiverLocked || savingDetails}
                              onChange={(event) => updateLedgerDraft(lr, "receiver_name", event.target.value)} />
                            {receiverLocked && <span className="text-muted">Locked after bhada, payments, or reconciliation.</span>}
                          </label>
                          <label className="text-xs">Goods type
                            <input className={field} required maxLength={80} value={ledgerDraft.goods_type} disabled={savingDetails}
                              onChange={(event) => updateLedgerDraft(lr, "goods_type", event.target.value)} />
                          </label>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-xs font-semibold">Containers and quantities</h3>
                            <button type="button" className="text-xs text-brand-700 underline"
                              disabled={savingDetails || ledgerDraft.containers.length >= 30}
                              onClick={() => updateLedgerDraft(lr, "containers", [
                                ...ledgerDraft.containers, { type: "", quantity: 1 },
                              ])}>Add container</button>
                          </div>
                          {ledgerDraft.containers.map((line, index) => <div key={index}
                            className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-2">
                            <input className={field} required maxLength={80} aria-label={`${lr.lr_ref} container type ${index + 1}`}
                              value={line.type} disabled={savingDetails}
                              onChange={(event) => updateLedgerContainer(lr, index, "type", event.target.value)} />
                            <input className={field} required type="number" min="1" max="1000000" step="1"
                              aria-label={`${lr.lr_ref} container quantity ${index + 1}`} value={line.quantity} disabled={savingDetails}
                              onChange={(event) => updateLedgerContainer(lr, index, "quantity", event.target.value)} />
                            {ledgerDraft.containers.length > 1 && <button type="button" className="px-2 text-red-700" disabled={savingDetails}
                              onClick={() => updateLedgerDraft(lr, "containers",
                                ledgerDraft.containers.filter((_, row) => row !== index))}>Remove</button>}
                          </div>)}
                        </div>
                        {ledgerErrors[lr.id] && <p role="alert" className="text-sm text-red-700">{ledgerErrors[lr.id]}</p>}
                        <Btn type="submit" disabled={savingDetails}>
                          {savingDetails ? "Saving ledger row…" : "Save ledger row"}
                        </Btn>
                      </form>
                    </td>
                  </tr>}
                </React.Fragment>;
              })}
              {lrs.length === 0 && <tr><td colSpan={ledgerColumnCount} className="px-3 py-8 text-center text-muted">
                Create an LR to start the trip ledger.
              </td></tr>}
            </tbody>
          </table>
        </div>
        {lrs.length < lrTotal && <Btn variant="s" className="mt-3" onClick={loadMoreLRs}>Load more rows</Btn>}
        <p className="mt-2 text-xs text-muted">
          Edits are audited and saved to the canonical booking LR. Finance fields require finance-update access;
          bhada cannot be reduced below posted payments. Reconciled charges stay locked, and closed bookings must be reopened first.
        </p>
      </Card>}

      {owner && <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Trip ledger</h2>
        <p className="text-sm text-muted">Download goods, goods detail (when supported by the server), receiver and summary CSVs, or use the stable-ID import template.</p>
        <div className="flex flex-wrap gap-2">{["goods", "goods-detail", "receivers", "summary", "import-template"].map((section) =>
          <Btn key={section} onClick={() => downloadLedger(section)}>Download {section}</Btn>)}</div>
        <form onSubmit={uploadLedger} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Completed template CSV<input className={field} name="ledger" type="file" accept=".csv,text/csv" required /></label>
          <Btn type="submit">Preview upload</Btn>
        </form>
        {importPreview && <div className="space-y-3 border-t pt-3">
          <div><h3 className="font-semibold">Import status: {importPreview.status}</h3>
            {importPreview.fatal_error && <p className="text-sm text-red-700">{importPreview.fatal_error}</p>}
            <p className="text-sm text-muted">{importPreview.summary?.valid_rows || 0} valid rows · {importPreview.summary?.skipped_rows || 0} skipped · {importPreview.summary?.missing_lr_ids?.length || 0} missing LRs</p>
          </div>
          {importPreview.rows?.filter((row) => row.row_number).map((row, index) => <div key={row.row_number} className="space-y-2 rounded border p-3">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span><strong>Row {row.row_number} · {row.matched_lr_ref || row.source.lr_id}</strong> · {row.matched_receiver || row.source.receiver || "Unknown LR"}</span>
              <label><input type="checkbox" checked={Boolean(row.skip)} onChange={(e) => setImportPreview({
                ...importPreview, ready_to_commit: false,
                rows: importPreview.rows.map((entry, i) => i === index ? { ...entry, skip: e.target.checked } : entry),
              })} /> Skip row</label>
            </div>
            {row.errors?.length > 0 && <p className="text-sm text-red-700">{row.errors.join("; ")}</p>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <label className="text-xs">Bhada<input className={field} type="number" min="0" step="0.01" value={row.source.rent ?? ""}
                onChange={(e) => editPreview(index, "rent", e.target.value)} /></label>
              <label className="text-xs">Hamali<input className={field} type="number" min="0" step="0.01" value={row.source.hamali ?? ""}
                onChange={(e) => editPreview(index, "hamali", e.target.value)} /></label>
              <label className="text-xs">Paid total<input className={field} type="number" min="0" step="0.01" value={row.source.paid_total ?? ""}
                onChange={(e) => editPreview(index, "paid_total", e.target.value)} /></label>
              <label className="text-xs">Payment date<input className={field} type="date" value={row.source.payment_date ?? ""}
                onChange={(e) => editPreview(index, "payment_date", e.target.value)} /></label>
              <label className="text-xs">Payment method<select className={field} value={row.source.payment_method ?? ""}
                onChange={(e) => editPreview(index, "payment_method", e.target.value)}>
                <option value="">Select</option>{["Cash", "UPI", "Bank", "Cheque", "Other"].map((method) => <option key={method}>{method}</option>)}
              </select></label>
              <label className="text-xs">Transaction reference<input className={field} value={row.source.transaction_reference ?? ""}
                onChange={(e) => editPreview(index, "transaction_reference", e.target.value)} /></label>
            </div>
          </div>)}
          {(importPreview.summary?.missing_lr_ids || []).length > 0 && <div className="rounded border border-amber-300 bg-amber-50 p-3">
            <p className="font-medium">These LRs are not included in the uploaded file. They will remain unreconciled.</p>
            <div className="mt-2 space-y-1">{importPreview.summary.missing_lr_ids.map((missingId) => {
              const checked = (importPreview.acknowledged_missing_lr_ids || []).includes(missingId);
              return <label key={missingId} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={checked} onChange={(event) => {
                  const nextIds = event.target.checked
                    ? [...(importPreview.acknowledged_missing_lr_ids || []), missingId]
                    : (importPreview.acknowledged_missing_lr_ids || []).filter((id) => id !== missingId);
                  const noRowErrors = !importPreview.rows.some((row) =>
                    row.errors?.length && !row.missing && !row.skip);
                  setImportPreview({
                    ...importPreview,
                    acknowledged_missing_lr_ids: nextIds,
                    ready_to_commit: importPreview.status === "preview" && noRowErrors
                      && importPreview.summary.missing_lr_ids.every((id) => nextIds.includes(id)),
                  });
                }} />
                Acknowledge missing LR ID {missingId}
              </label>;
            })}</div>
          </div>}
          {importPreview.status !== "applied" && <div className="flex flex-wrap gap-2">
            <Btn onClick={savePreview}>Save and validate preview</Btn>
            <Btn disabled={!importPreview.ready_to_commit} onClick={commitImport}>Confirm and reconcile</Btn>
          </div>}
        </div>}
      </Card>}
    </div>
  );
}
