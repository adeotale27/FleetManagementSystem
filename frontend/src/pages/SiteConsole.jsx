import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, errMsg } from "../lib/api";
import { Btn, Card, ErrorState, Loader, PageHead } from "../components/ui";

const field = "fld w-full";
const allowedPermissions = [
  "dashboard:read", "trips:read", "trips:create", "trips:update", "trips:close",
  "lrs:read", "lrs:create", "lrs:update", "finance:read", "finance:update",
  "payments:read", "payments:create",
];

function ReceivableGroups({ title, breakdown }) {
  const rows = breakdown?.rows || [];
  const renderRow = (row) => (
    <li key={row.label} className="flex items-start justify-between gap-3 border-b py-2 text-sm last:border-0">
      <span className="min-w-0">
        <strong className="block break-words">{row.label}</strong>
        {(row.site_name || row.operating_date) &&
          <span className="text-xs text-muted">{[row.site_name, row.operating_date].filter(Boolean).join(" · ")}</span>}
        <span className="text-xs text-muted">{row.lr_count} LRs · {row.parcels} parcels</span>
        {(row.unreconciled_lrs > 0 || row.unpriced_lrs > 0) &&
          <span className="block text-xs text-amber-800">
            Not collectible: {row.unreconciled_lrs} unreconciled · {row.unpriced_lrs} unpriced
            {Number(row.unreconciled_bhada) > 0 ? ` · ₹${row.unreconciled_bhada} unreconciled bhada` : ""}
          </span>}
      </span>
      <strong className="num shrink-0">{`₹${row.collectible_outstanding}`}</strong>
    </li>
  );
  return (
    <section className="rounded-lg border border-line p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted">No matching LRs.</p> : <>
        <ul>{rows.slice(0, 8).map(renderRow)}</ul>
        {rows.length > 8 && <details className="mt-2">
          <summary className="min-h-11 cursor-pointer content-center text-sm text-brand-700">
            Show {rows.length - 8} more groups{breakdown.truncated ? ` · ${breakdown.group_count} total` : ""}
          </summary>
          <ul>{rows.slice(8).map(renderRow)}</ul>
        </details>}
        {rows.length <= 8 && breakdown.truncated &&
          <p className="mt-2 text-xs text-muted">Showing the top {rows.length} of {breakdown.group_count} groups by balance and pending data.</p>}
      </>}
    </section>
  );
}

export default function SiteConsole({ user }) {
  const owner = user?.role === "owner";
  const [sites, setSites] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [managers, setManagers] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [tripRows, setTripRows] = useState([]);
  const [tripTotal, setTripTotal] = useState(0);
  const [tripOffset, setTripOffset] = useState(0);
  const [boardTripId, setBoardTripId] = useState("");
  const [boardLrs, setBoardLrs] = useState([]);
  const [boardReceivables, setBoardReceivables] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dates, setDates] = useState({ from_date: "", to_date: "" });
  const [filters, setFilters] = useState({ site_id: "", trip_id: "", trip_status: "", receiver: "" });
  const datesRef = useRef(dates);
  const filtersRef = useRef(filters);
  const siteIdRef = useRef(siteId);
  datesRef.current = dates;
  filtersRef.current = filters;
  siteIdRef.current = siteId;
  const [siteForm, setSiteForm] = useState({ name: "", code: "", location: "", timezone: "Asia/Kolkata" });
  const [siteEdit, setSiteEdit] = useState({ name: "", location: "", city: "", timezone: "" });
  const [categoryForm, setCategoryForm] = useState({ goods: "", containers: "" });
  const [migration, setMigration] = useState(null);
  const [tripForm, setTripForm] = useState({ truck_no: "", driver_name: "", vehicle_id: "", driver_id: "" });
  const [tripResources, setTripResources] = useState({ vehicles: [], drivers: [] });
  const [managerForm, setManagerForm] = useState({ name: "", username: "", password: "" });
  const [grantForm, setGrantForm] = useState({ username: "", site_id: "", permissions: ["dashboard:read", "trips:read", "lrs:read"] });

  const loadBoardLrs = useCallback(async (id, tripId, operatingDate) => {
    setBoardTripId(tripId || "");
    setBoardLrs([]);
    setBoardReceivables(null);
    if (!id || !tripId) return;
    const sitePermissions = user?.site_permissions?.[id] || [];
    if (!owner && !sitePermissions.includes("lrs:read")) return;
    try {
      const requests = [
        api.get(`/sites/${id}/trips/${tripId}/lrs`, { params: { limit: 100, offset: 0 } }),
      ];
      if (owner) {
        const dateFilters = { ...datesRef.current };
        if (!dateFilters.from_date && !dateFilters.to_date && operatingDate) {
          dateFilters.from_date = operatingDate;
          dateFilters.to_date = operatingDate;
        }
        requests.push(api.get("/sites/system-dashboard", { params: {
          ...dateFilters, ...filtersRef.current, site_id: id, trip_id: tripId,
        } }));
      }
      const [response, receivableResponse] = await Promise.all(requests);
      setBoardLrs(response.data.rows || []);
      if (receivableResponse) setBoardReceivables(receivableResponse.data.receivables || null);
    } catch {
      setBoardLrs([]);
      setBoardReceivables(null);
    }
  }, [owner, user]);

  const refresh = useCallback(async (preferredSite = siteIdRef.current) => {
    setLoading(true);
    setError("");
    try {
      const [siteResponse, dashboardResponse, managerResponse] = await Promise.all([
        api.get("/sites"),
        owner
          ? api.get("/sites/system-dashboard", { params: Object.fromEntries(
            Object.entries({ ...datesRef.current, ...filtersRef.current }).filter(([, v]) => v),
          ) })
          : Promise.resolve(null),
        owner ? api.get("/sites/managers") : Promise.resolve(null),
      ]);
      const availableSites = siteResponse.data;
      setSites(availableSites);
      setDashboard(dashboardResponse?.data || null);
      setManagers(managerResponse?.data || []);
      const selected = availableSites.find((item) => item.id === preferredSite) || availableSites[0];
      setSiteId(selected?.id || "");
      if (selected) setSiteEdit({
        name: selected.name, location: selected.location || "",
        city: selected.city || "", timezone: selected.timezone || "Asia/Kolkata",
      });
      if (selected) {
        const [siteDash, trips, resources] = await Promise.all([
          owner ? Promise.resolve(null) : api.get(`/sites/${selected.id}/dashboard`),
          api.get(`/sites/${selected.id}/trips`, { params: { limit: 20, offset: 0 } }),
          api.get(`/sites/${selected.id}/trip-resources`),
        ]);
        if (!owner) setDashboard(siteDash.data);
        setTripRows(trips.data.rows);
        setTripTotal(trips.data.total);
        setTripOffset(trips.data.rows.length);
        setTripResources(resources.data);
        await loadBoardLrs(
          selected.id, trips.data.rows[0]?.id, trips.data.rows[0]?.operating_date,
        );
      } else {
        setTripRows([]);
        setTripTotal(0);
        setTripOffset(0);
        setTripResources({ vehicles: [], drivers: [] });
        setBoardTripId("");
        setBoardLrs([]);
        setBoardReceivables(null);
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [loadBoardLrs, owner]);

  useEffect(() => { refresh(); }, [refresh]);

  const selectSite = async (id) => {
    setSiteId(id);
    if (owner) setFilters((current) => ({ ...current, site_id: id }));
    if (!id) {
      setTripRows([]);
      setTripTotal(0);
      setTripOffset(0);
      setTripResources({ vehicles: [], drivers: [] });
      setBoardTripId("");
      setBoardLrs([]);
      setBoardReceivables(null);
      return;
    }
    const selected = sites.find((item) => item.id === id);
    if (selected) setSiteEdit({
      name: selected.name, location: selected.location || "",
      city: selected.city || "", timezone: selected.timezone || "Asia/Kolkata",
    });
    try {
      const [trips, dash, resources] = await Promise.all([
        api.get(`/sites/${id}/trips`, { params: { limit: 20, offset: 0 } }),
        owner ? Promise.resolve(null) : api.get(`/sites/${id}/dashboard`),
        api.get(`/sites/${id}/trip-resources`),
      ]);
      setTripRows(trips.data.rows);
      setTripTotal(trips.data.total);
      setTripOffset(trips.data.rows.length);
      setTripResources(resources.data);
      await loadBoardLrs(id, trips.data.rows[0]?.id, trips.data.rows[0]?.operating_date);
      if (!owner) setDashboard(dash.data);
    } catch (e) { setError(errMsg(e)); }
  };

  const loadMoreTrips = async () => {
    try {
      const response = await api.get(`/sites/${siteId}/trips`, {
        params: { limit: 20, offset: tripOffset },
      });
      setTripRows((current) => [...current, ...response.data.rows]);
      setTripOffset(tripOffset + response.data.rows.length);
    } catch (e) { setError(errMsg(e)); }
  };

  const selectedBoardTrip = tripRows.find((trip) => trip.id === boardTripId);
  const receivableByReceiver = Object.values(boardLrs.reduce((groups, lr) => {
    const label = lr.receiver_label || lr.receiver_name || "Receiver not entered";
    const group = groups[label] || (groups[label] = { label, lrs: 0, parcels: 0, outstanding: 0, hasFinance: false });
    group.lrs += 1;
    group.parcels += Number(lr.total_quantity) || 0;
    if (lr.outstanding !== undefined) {
      group.outstanding += Number(lr.outstanding) || 0;
      group.hasFinance = true;
    }
    return groups;
  }, {})).sort((a, b) => b.outstanding - a.outstanding);
  const receivableByGoods = Object.values(boardLrs.reduce((groups, lr) => {
    const label = lr.goods_type || "Goods not entered";
    const group = groups[label] || (groups[label] = { label, lrs: 0, parcels: 0, outstanding: 0, hasFinance: false });
    group.lrs += 1;
    group.parcels += Number(lr.total_quantity) || 0;
    if (lr.outstanding !== undefined) {
      group.outstanding += Number(lr.outstanding) || 0;
      group.hasFinance = true;
    }
    return groups;
  }, {})).sort((a, b) => b.outstanding - a.outstanding);

  const saveSite = async (event) => {
    event.preventDefault();
    try {
      await api.put(`/sites/${siteId}`, siteEdit);
      setMessage("Site details updated.");
      await refresh(siteId);
    } catch (e) { setError(errMsg(e)); }
  };

  const addCategory = async (kind, event) => {
    event.preventDefault();
    const name = categoryForm[kind].trim();
    if (!name) return;
    try {
      await api.post(`/sites/${siteId}/categories`, { kind, name });
      setCategoryForm((current) => ({ ...current, [kind]: "" }));
      setMessage("Category added.");
    } catch (e) { setError(errMsg(e)); }
  };

  const previewMigration = async () => {
    try {
      const response = await api.get("/sites/migration/legacy", { params: { site_id: siteId } });
      setMigration(response.data);
    } catch (e) { setError(errMsg(e)); }
  };

  const applyMigration = async () => {
    if (!window.confirm(`Assign ${migration?.total || 0} legacy records to the business default site? This only fills missing site/business IDs.`)) return;
    try {
      const response = await api.post("/sites/migration/legacy", { site_id: siteId, confirm: true });
      setMigration({ ...migration, applied: true, result: response.data });
      setMessage("Legacy records were assigned to the default site.");
    } catch (e) { setError(errMsg(e)); }
  };

  const createSite = async (event) => {
    event.preventDefault();
    try {
      const result = await api.post("/sites", siteForm);
      setMessage(`Site ${result.data.name} created.`);
      setSiteForm({ name: "", code: "", location: "", timezone: "Asia/Kolkata" });
      await refresh(result.data.id);
    } catch (e) { setError(errMsg(e)); }
  };

  const assignManager = async (event) => {
    event.preventDefault();
    try {
      const body = { ...managerForm };
      if (!body.password) delete body.password;
      await api.post(`/sites/${siteId}/manager`, body);
      setMessage("Site manager assigned. Share the username and temporary password securely.");
      setManagerForm({ name: "", username: "", password: "" });
      await refresh(siteId);
    } catch (e) { setError(errMsg(e)); }
  };

  const createTrip = async (event) => {
    event.preventDefault();
    try {
      const result = await api.post(`/sites/${siteId}/trips`, tripForm);
      setMessage(`Trip ${result.data.trip_ref} created.`);
      setTripForm({ truck_no: "", driver_name: "", vehicle_id: "", driver_id: "" });
      await refresh(siteId);
    } catch (e) { setError(errMsg(e)); }
  };

  const setStatus = async (site) => {
    if (site.status === "Active" && !window.confirm(`Deactivate ${site.name}? Its site manager will lose access until the site is reactivated.`)) return;
    try {
      await api.put(`/sites/${site.id}`, { status: site.status === "Active" ? "Inactive" : "Active" });
      await refresh(siteId);
    } catch (e) { setError(errMsg(e)); }
  };

  const grantAccess = async (event) => {
    event.preventDefault();
    try {
      await api.put(`/sites/managers/${encodeURIComponent(grantForm.username)}/access`, {
        site_id: grantForm.site_id, permissions: grantForm.permissions,
      });
      setMessage("Site access updated.");
      await refresh(siteId);
    } catch (e) { setError(errMsg(e)); }
  };

  if (loading && sites.length === 0) return <Loader label="Loading sites…" />;

  return (
    <div className="space-y-5">
      <PageHead title={owner ? "Bookings Window Board" : "Site Operations"}
        subtitle={owner ? "Business overview, selected-site bookings, receivables and administration." : "Your assigned site's trips and daily transport activity."} />
      {error && <ErrorState text={error} onRetry={() => refresh()} />}
      {message && <div role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>}
      {owner && dashboard?.totals && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Active sites", dashboard.totals.active_sites],
              ["Managers", dashboard.totals.active_managers],
              ["Trips today", dashboard.totals.trips_today],
              ["Open trips", dashboard.totals.open_trips],
              ["Trips pending ledger", dashboard.totals.pending_reconciliation],
              ["Total LRs", dashboard.totals.total_lrs],
              ["Parcels", dashboard.totals.total_parcels],
              ["Reconciled bhada", dashboard.totals.reconciled_bhada],
              ["Collectible outstanding bhada", dashboard.totals.outstanding_bhada],
              ["Recorded rent net of posted collections", dashboard.totals.recorded_outstanding_bhada],
            ].map(([label, value]) => <Card key={label} className="p-4">
              <p className="text-xs text-muted">{label}</p><p className="num mt-1 text-xl font-bold">{value}</p>
            </Card>)}
          </div>
          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Filter the business dashboard</h2>
            <div className="grid gap-3 md:grid-cols-6">
              <label className="text-sm">From<input className={field} type="date" value={dates.from_date}
                onChange={(e) => setDates((x) => ({ ...x, from_date: e.target.value }))} /></label>
              <label className="text-sm">To<input className={field} type="date" value={dates.to_date}
                onChange={(e) => setDates((x) => ({ ...x, to_date: e.target.value }))} /></label>
              <label className="text-sm">Site<select className={field} value={filters.site_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setFilters((x) => ({ ...x, site_id: id, trip_id: "" }));
                  selectSite(id);
                }}>
                <option value="">All sites</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name} ({site.code})</option>)}
              </select></label>
              <label className="text-sm">Trip<select className={field} value={filters.trip_id}
                onChange={(e) => setFilters((x) => ({ ...x, trip_id: e.target.value }))}>
                <option value="">All trips</option>{tripRows.map((trip) => <option key={trip.id} value={trip.id}>{trip.trip_ref}</option>)}
              </select></label>
              <label className="text-sm">Trip status<select className={field} value={filters.trip_status}
                onChange={(e) => setFilters((x) => ({ ...x, trip_status: e.target.value }))}>
                <option value="">All statuses</option><option value="open">Open</option><option value="closed">Closed</option>
              </select></label>
              <label className="text-sm">Receiver<input className={field} value={filters.receiver} placeholder="Receiver name"
                onChange={(e) => setFilters((x) => ({ ...x, receiver: e.target.value }))} /></label>
            </div>
            <Btn className="mt-3" onClick={() => refresh(siteId)}>Apply filters</Btn>
          </Card>
          {dashboard.alerts && <Card className="p-4">
            <h2 className="mb-3 font-semibold">Alerts</h2>
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <p>Trips awaiting closure: <strong>{dashboard.alerts.trips_awaiting_closure}</strong></p>
              <p>Trips awaiting ledger upload: <strong>{dashboard.alerts.ledgers_awaiting_upload}</strong></p>
              <p>Ledger imports needing review: <strong>{dashboard.alerts.ledger_imports_needing_review}</strong></p>
              <p>Unpaid LRs: <strong>{dashboard.alerts.unpaid_lrs}</strong></p>
              <p>Collectible outstanding bhada: <strong>{dashboard.alerts.outstanding_bhada}</strong></p>
            </div>
          </Card>}
          {dashboard.receivables && <Card className="space-y-4 p-4">
            <div>
              <h2 className="font-semibold">Collectible receivables by receiver and goods</h2>
              <p className="mt-1 text-sm text-muted">{dashboard.receivables.basis}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Collectible outstanding", dashboard.receivables.collectible_outstanding, "text-amber-800"],
                ["Reconciled rent", dashboard.receivables.reconciled_rent, ""],
                ["Posted payments", dashboard.receivables.posted_payments, ""],
                ["Unreconciled bhada · not collectible", dashboard.receivables.unreconciled_bhada, "text-amber-800"],
                ["Unpriced LRs", dashboard.receivables.unpriced_lrs, ""],
              ].map(([label, value, tone]) => <div key={label} className="rounded-lg bg-canvas p-3">
                <p className="text-xs text-muted">{label}</p>
                <p className={`num mt-1 break-words text-lg font-bold ${tone}`}>{value}</p>
              </div>)}
            </div>
            <p className="text-xs text-muted">
              {dashboard.receivables.unreconciled_lrs} unreconciled LRs and {dashboard.receivables.unpriced_lrs} unpriced LRs are excluded from collectible balances.
              {dashboard.receivables.unpaid_lrs > 0 ? ` ${dashboard.receivables.unpaid_lrs} reconciled LRs have a remaining balance.` : ""}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <ReceivableGroups title="By receiver / person" breakdown={dashboard.receivables.by_receiver} />
              <ReceivableGroups title="By goods" breakdown={dashboard.receivables.by_goods} />
            </div>
          </Card>}
          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Site-wise operations and finances</h2>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead><tr className="border-b text-muted">
                {["Site", "Trips today", "Open", "Closed", "Pending ledger", "LRs", "Bhada recorded", "Reconciled", "Collected", "Collectible outstanding", "Recorded rent net of posted collections", "Manager", "Status"].map((x) => <th key={x} className="p-2">{x}</th>)}
              </tr></thead>
              <tbody>{(dashboard.sites || []).map((row) => (
                <tr className="border-b last:border-0" key={row.site.id}>
                  <td className="p-2"><button className="font-semibold text-brand-700" onClick={() => selectSite(row.site.id)}>{row.site.name} ({row.site.code})</button></td>
                  {[row.trips_today, row.open_trips, row.closed_trips, row.pending_reconciliation, row.total_lrs,
                    row.recorded_bhada, row.reconciled_bhada, row.collected_bhada, row.outstanding_bhada,
                    row.recorded_outstanding_bhada].map((x, i) => <td className="p-2" key={i}>{x}</td>)}
                  <td className="p-2">{row.active_managers ? "Assigned" : "Unassigned"}</td>
                  <td className="p-2">{row.site.status} <button className="ml-1 text-brand-700 underline" onClick={() => setStatus(row.site)}>{row.site.status === "Active" ? "Deactivate" : "Activate"}</button></td>
                </tr>
              ))}</tbody>
            </table>
            </div>
            <div className="space-y-3 md:hidden">{(dashboard.sites || []).map((row) => (
              <article key={row.site.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button className="text-left font-semibold text-brand-700 underline" onClick={() => selectSite(row.site.id)}>
                    {row.site.name} <span className="font-normal text-muted">({row.site.code})</span>
                  </button>
                  <span className="rounded-full bg-canvas px-2.5 py-1 text-xs">{row.site.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <p>Trips today <strong>{row.trips_today}</strong></p><p>Open trips <strong>{row.open_trips}</strong></p>
                  <p>Pending ledger <strong>{row.pending_reconciliation}</strong></p><p>LRs <strong>{row.total_lrs}</strong></p>
                  <p>Collected <strong>{row.collected_bhada}</strong></p><p className="font-semibold text-amber-800">Collectible outstanding <strong>{row.outstanding_bhada}</strong></p>
                  <p>Recorded rent net of posted collections <strong>{row.recorded_outstanding_bhada}</strong></p>
                  <p>Manager <strong>{row.active_managers ? "Assigned" : "None"}</strong></p>
                </div>
                <button className="mt-3 min-h-11 text-sm text-brand-700 underline" onClick={() => setStatus(row.site)}>
                  {row.site.status === "Active" ? "Deactivate site" : "Activate site"}
                </button>
              </article>
            ))}</div>
          </Card>
          {dashboard.recent_activity?.length > 0 && <Card className="p-4">
            <h2 className="mb-3 font-semibold">Recent activity</h2>
            <ul className="space-y-2 text-sm">{dashboard.recent_activity.map((item) => <li key={item.id}>
              <span className="font-medium">{item.actor_name || item.actor_username}</span> · {item.action.replaceAll(".", " ")} · {new Date(item.created_at).toLocaleString()}
            </li>)}</ul>
          </Card>}
        </>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="min-w-52 text-sm font-medium">Selected site
            <select className={field} value={siteId} onChange={(e) => selectSite(e.target.value)}>
              <option value="">Select site...</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name} ({site.code})</option>)}
            </select>
          </label>
          {sites.length === 0 && <p className="text-sm text-muted">No sites are configured for this business yet.</p>}
        </div>
      </Card>

      {owner && <Card className="p-4">
        <h2 className="mb-3 font-semibold">Add a site</h2>
        <form onSubmit={createSite} className="grid gap-3 md:grid-cols-4">
          <input className={field} placeholder="Site name" required value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} />
          <input className={field} placeholder="Short code, e.g. NGP" required value={siteForm.code} onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })} />
          <input className={field} placeholder="Location" value={siteForm.location} onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })} />
          <div className="flex gap-2"><input className={field} aria-label="IANA time zone" value={siteForm.timezone} onChange={(e) => setSiteForm({ ...siteForm, timezone: e.target.value })} /><Btn type="submit">Create site</Btn></div>
        </form>
      </Card>}

      {owner && siteId && <Card className="p-4">
        <h2 className="mb-3 font-semibold">Edit selected site</h2>
        <form onSubmit={saveSite} className="grid gap-3 md:grid-cols-5">
          <input className={field} aria-label="Site name" required value={siteEdit.name} onChange={(e) => setSiteEdit({ ...siteEdit, name: e.target.value })} />
          <input className={field} aria-label="Location" value={siteEdit.location} onChange={(e) => setSiteEdit({ ...siteEdit, location: e.target.value })} />
          <input className={field} aria-label="City" value={siteEdit.city} onChange={(e) => setSiteEdit({ ...siteEdit, city: e.target.value })} />
          <input className={field} aria-label="Site time zone" value={siteEdit.timezone} onChange={(e) => setSiteEdit({ ...siteEdit, timezone: e.target.value })} />
          <Btn type="submit">Save site</Btn>
        </form>
        {sites.find((site) => site.id === siteId)?.is_default && <div className="mt-3">
          <Btn variant="s" onClick={previewMigration}>Preview legacy-data migration</Btn>
          {migration && <div className="mt-3 rounded border p-3 text-sm">
            <p>Dry-run: {migration.total} records lack site assignment. No records have changed.</p>
            <pre className="my-2 whitespace-pre-wrap">{JSON.stringify(migration.unassigned, null, 2)}</pre>
            {!migration.applied && migration.total > 0 && <Btn variant="s" onClick={applyMigration}>Confirm assignment to default site</Btn>}
            {migration.applied && <p>Migration status: {migration.result?.status}</p>}
          </div>}
        </div>}
      </Card>}

      {siteId && dashboard && !owner && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Trips today", dashboard.trips_today], ["Open trips", dashboard.open_trips],
          ["Pending ledger", dashboard.pending_reconciliation], ["LRs", dashboard.total_lrs],
          ["Parcels", dashboard.total_parcels],
          ...(dashboard.outstanding_bhada === undefined ? [] : [
            ["Recorded bhada", dashboard.recorded_bhada],
            ["Reconciled bhada", dashboard.reconciled_bhada],
            ["Collected bhada", dashboard.collected_bhada],
            ["Outstanding bhada", dashboard.outstanding_bhada],
          ])]
          .map(([label, value]) => <Card key={label} className="p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></Card>)}
      </div>}

      {siteId && <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">Selected-site booking window</h2>
            <p className="text-sm text-muted">{sites.find((site) => site.id === siteId)?.name || "Site"} · latest trip and its LR context</p>
          </div>
          <label className="w-full text-sm sm:max-w-sm">Trip
            <select className={field} value={boardTripId} onChange={(e) => {
              const selectedTrip = tripRows.find((trip) => trip.id === e.target.value);
              loadBoardLrs(siteId, e.target.value, selectedTrip?.operating_date);
            }}>
              <option value="">Choose a trip</option>
              {tripRows.map((trip) => <option key={trip.id} value={trip.id}>{trip.trip_ref} · {trip.operating_date}</option>)}
            </select>
          </label>
        </div>
        {selectedBoardTrip && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas p-3 text-sm">
          <span><strong>{selectedBoardTrip.trip_ref}</strong> · {selectedBoardTrip.truck_no} · {selectedBoardTrip.driver_name}</span>
          <span>{selectedBoardTrip.operating_date} · <strong>{selectedBoardTrip.status}</strong></span>
          <Link className="min-h-11 content-center text-brand-700 underline" to={`/sites/${siteId}/trips/${selectedBoardTrip.id}`}>Open trip</Link>
        </div>}
        {!selectedBoardTrip && <p className="text-sm text-muted">Select a trip to view its LR and receivable detail.</p>}
        {boardTripId && <>
          {owner && boardReceivables && <div className="space-y-3">
            <p className="text-xs text-muted">{boardReceivables.basis}</p>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <p>Collectible outstanding <strong className="num block">₹{boardReceivables.collectible_outstanding}</strong></p>
              <p>Reconciled rent <strong className="num block">₹{boardReceivables.reconciled_rent}</strong></p>
              <p>Unreconciled bhada <strong className="num block">₹{boardReceivables.unreconciled_bhada}</strong></p>
              <p>Unpriced LRs <strong className="block">{boardReceivables.unpriced_lrs}</strong></p>
            </div>
          </div>}
          {boardLrs.length === 0
            ? <p className="text-sm text-muted">No LRs found, or LR detail is not available to this role.</p>
            : <div className="grid gap-4 lg:grid-cols-2">
              {owner && boardReceivables
                ? <ReceivableGroups title="Trip collectible outstanding by receiver / person" breakdown={boardReceivables.by_receiver} />
                : <section className="rounded-lg border border-line p-3">
                <h3 className="mb-2 text-sm font-semibold">Outstanding by receiver / person</h3>
                <div className="space-y-2">{receivableByReceiver.map((group) => <div key={group.label} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0">
                  <span className="min-w-0"><strong className="block break-words">{group.label}</strong><span className="text-xs text-muted">{group.lrs} LR{group.lrs === 1 ? "" : "s"} · {group.parcels} parcels</span></span>
                  {group.hasFinance && <strong className="num shrink-0">{group.outstanding.toFixed(2)}</strong>}
                </div>)}</div>
              </section>}
              {owner && boardReceivables
                ? <ReceivableGroups title="Trip collectible outstanding by goods" breakdown={boardReceivables.by_goods} />
                : <section className="rounded-lg border border-line p-3">
                <h3 className="mb-2 text-sm font-semibold">Goods and outstanding</h3>
                <div className="space-y-2">{receivableByGoods.map((group) => <div key={group.label} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0">
                  <span className="min-w-0"><strong className="block break-words">{group.label}</strong><span className="text-xs text-muted">{group.lrs} LR{group.lrs === 1 ? "" : "s"} · {group.parcels} parcels</span></span>
                  {group.hasFinance && <strong className="num shrink-0">{group.outstanding.toFixed(2)}</strong>}
                </div>)}</div>
              </section>}
              <section className="space-y-2 lg:col-span-2">
                <h3 className="text-sm font-semibold">LRs in this trip</h3>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{boardLrs.map((lr) => <Link key={lr.id}
                  className="rounded-lg border border-line p-3 text-sm hover:border-brand-400"
                  to={`/sites/${siteId}/trips/${boardTripId}/lrs/${lr.id}`}>
                  <div className="flex justify-between gap-2"><strong className="text-brand-700">{lr.lr_ref}</strong>
                    <span className="text-right text-xs text-muted">{lr.rent == null ? "Unpriced" : lr.reconciled ? (lr.payment_status || "Reconciled") : "Unreconciled · not collectible"}</span></div>
                  <p className="mt-1 break-words">{lr.receiver_label || lr.receiver_name}</p>
                  <p className="mt-1 text-xs text-muted">{lr.goods_type} · {lr.total_quantity} parcels</p>
                </Link>)}</div>
              </section>
            </div>}
        </>}
      </Card>}

      {siteId && <Card className="p-4">
        <h2 className="mb-3 font-semibold">Create a trip</h2>
        <form onSubmit={createTrip} className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Vehicle
            <select className={field} value={tripForm.vehicle_id} onChange={(e) => {
              const vehicle = tripResources.vehicles.find((row) => row.id === e.target.value);
              setTripForm({ ...tripForm, vehicle_id: e.target.value, truck_no: vehicle?.vehicle_no || tripForm.truck_no });
            }}>
              <option value="">Enter a truck number manually</option>
              {tripResources.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>
                {vehicle.vehicle_no}{vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ""} · {vehicle.status || "Active"}
              </option>)}
            </select>
            {!tripForm.vehicle_id && <input className={field} placeholder="Truck number" required value={tripForm.truck_no}
              onChange={(e) => setTripForm({ ...tripForm, truck_no: e.target.value })} />}
            {tripForm.vehicle_id && <p className="mt-1 text-xs text-muted">Selected: {tripForm.truck_no}</p>}
          </label>
          <label className="text-sm">Driver
            <select className={field} value={tripForm.driver_id} onChange={(e) => {
              const driver = tripResources.drivers.find((row) => row.id === e.target.value);
              setTripForm({ ...tripForm, driver_id: e.target.value, driver_name: driver?.name || tripForm.driver_name });
            }}>
              <option value="">Enter a driver name manually</option>
              {tripResources.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
            </select>
            {!tripForm.driver_id && <input className={field} placeholder="Driver name" required value={tripForm.driver_name}
              onChange={(e) => setTripForm({ ...tripForm, driver_name: e.target.value })} />}
            {tripForm.driver_id && <p className="mt-1 text-xs text-muted">Selected: {tripForm.driver_name}</p>}
          </label>
          <Btn type="submit">Create trip</Btn>
        </form>
      </Card>}

      {owner && siteId && <Card className="p-4">
        <h2 className="mb-3 font-semibold">Assign or replace the site manager</h2>
        <form onSubmit={assignManager} className="grid gap-3 md:grid-cols-4">
          <input className={field} placeholder="Manager name" required value={managerForm.name} onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })} />
          <input className={field} placeholder="Username" required value={managerForm.username} onChange={(e) => setManagerForm({ ...managerForm, username: e.target.value })} />
          <input className={field} type="password" placeholder="Temporary password (12+ chars)" minLength="12" value={managerForm.password} onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })} />
          <Btn type="submit">Assign manager</Btn>
        </form>
        <p className="mt-2 text-xs text-muted">For a new manager, set a temporary password and share it securely. A replaced manager loses this site's access while their audit history remains.</p>
      </Card>}

      {owner && managers.length > 0 && <Card className="p-4">
        <h2 className="mb-3 font-semibold">Grant explicit cross-site access</h2>
        <form onSubmit={grantAccess} className="grid gap-3 md:grid-cols-3">
          <select className={field} required value={grantForm.username} onChange={(e) => setGrantForm({ ...grantForm, username: e.target.value })}>
            <option value="">Select manager</option>{managers.filter((m) => m.active).map((m) => <option key={m.username} value={m.username}>{m.name} ({m.username})</option>)}
          </select>
          <select className={field} required value={grantForm.site_id} onChange={(e) => {
            const existingPermissions = managers.find((m) => m.username === grantForm.username)?.site_permissions?.[e.target.value];
            setGrantForm({ ...grantForm, site_id: e.target.value,
              permissions: existingPermissions || ["dashboard:read", "trips:read", "lrs:read"] });
          }}>
            <option value="">Select site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Btn type="submit">Save access permissions</Btn>
        </form>
        <div className="my-3 grid gap-2 sm:grid-cols-3">
          {allowedPermissions.map((permission) => <label key={permission} className="text-xs">
            <input type="checkbox" checked={grantForm.permissions.includes(permission)}
              onChange={(event) => setGrantForm({ ...grantForm, permissions: event.target.checked
                ? [...grantForm.permissions, permission]
                : grantForm.permissions.filter((value) => value !== permission) })} /> {permission}
          </label>)}
        </div>
        <p className="mt-2 text-xs text-muted">A manager can access only the selected site and only the checked actions.</p>
        <div className="mt-4 divide-y border-t">
          {managers.map((manager) => <div key={manager.username} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>{manager.name} · {manager.username} · {manager.active ? "Active" : "Inactive"} · Sites: {sites.filter((site) => manager.site_ids?.includes(site.id)).map((site) => site.name).join(", ") || "None"}</span>
            <div className="flex gap-2">
              <button className="text-brand-700 underline" onClick={async () => {
                const password = window.prompt("Enter a new temporary password (12+ characters):");
                if (!password) return;
                try {
                  await api.post(`/sites/managers/${encodeURIComponent(manager.username)}/reset-password`, { password });
                  setMessage("Manager password reset.");
                } catch (e) { setError(errMsg(e)); }
              }}>Reset password</button>
              {manager.active && <button className="text-red-700 underline" onClick={async () => {
                if (!window.confirm(`Deactivate ${manager.name} and revoke all site access?`)) return;
                try {
                  await api.delete(`/sites/managers/${encodeURIComponent(manager.username)}`);
                  setMessage("Manager deactivated; historical records and audit events were retained.");
                  await refresh(siteId);
                } catch (e) { setError(errMsg(e)); }
              }}>Deactivate</button>}
            </div>
          </div>)}
        </div>
      </Card>}

      {owner && siteId && <Card className="grid gap-4 p-4 md:grid-cols-2">
        <form onSubmit={(e) => addCategory("goods", e)} className="flex gap-2">
          <input className={field} aria-label="New goods category" placeholder="Add goods category" value={categoryForm.goods}
            onChange={(e) => setCategoryForm({ ...categoryForm, goods: e.target.value })} />
          <Btn type="submit">Add goods</Btn>
        </form>
        <form onSubmit={(e) => addCategory("containers", e)} className="flex gap-2">
          <input className={field} aria-label="New container category" placeholder="Add container category" value={categoryForm.containers}
            onChange={(e) => setCategoryForm({ ...categoryForm, containers: e.target.value })} />
          <Btn type="submit">Add container</Btn>
        </form>
      </Card>}

      {siteId && <Card className="p-4">
        <h2 className="mb-3 font-semibold">Site trips ({tripRows.length} of {tripTotal})</h2>
        {tripRows.length === 0 ? <p className="text-sm text-muted">No trips recorded at this site yet.</p> :
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{tripRows.map((trip) => <Link key={trip.id}
            className="rounded-lg border border-line p-3 hover:border-brand-400 hover:text-brand-700"
            to={`/sites/${siteId}/trips/${trip.id}`}>
            <div className="flex items-start justify-between gap-2"><strong>{trip.trip_ref}</strong><span className="text-xs">{trip.status}</span></div>
            <p className="mt-1 break-words text-sm">{trip.truck_no} · {trip.driver_name}</p>
            <p className="mt-1 text-xs text-muted">{trip.operating_date}</p>
          </Link>)}</div>}
        {tripRows.length < tripTotal && <Btn variant="s" className="mt-3" onClick={loadMoreTrips}>Load more trips</Btn>}
      </Card>}
    </div>
  );
}
