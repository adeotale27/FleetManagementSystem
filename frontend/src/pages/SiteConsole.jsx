import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, Banknote, Check, CheckCircle2, Clock3, Copy, Download, FileText,
  MapPin, Truck, X,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, errMsg } from "../lib/api";
import { Btn, Card, ErrorState, Loader, PageHead } from "../components/ui";
import { DATA_CHANGE_EVENT } from "../lib/realtime";
import { money0 } from "../lib/format";
import { useMaster } from "../lib/hooks";

const field = "fld w-full";
const isoDay = (offset = 0) => {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
};
const dateRangeForPreset = (preset) => {
  if (preset === "yesterday") return { from_date: isoDay(-1), to_date: isoDay(-1) };
  if (preset === "last7") return { from_date: isoDay(-6), to_date: isoDay() };
  if (preset === "last30") return { from_date: isoDay(-29), to_date: isoDay() };
  return { from_date: isoDay(), to_date: isoDay() };
};
const permissionGroups = [
  {
    title: "Booking dashboard",
    description: "View the selected site's booking overview.",
    permissions: [["dashboard:read", "View dashboard"]],
  },
  {
    title: "Trips",
    description: "View trips, create trips, edit trip details, or close trips.",
    permissions: [
      ["trips:read", "View trips"],
      ["trips:create", "Create trips"],
      ["trips:update", "Edit trips"],
    ],
  },
  {
    title: "Lorry receipts (LRs)",
    description: "View, create, or edit LRs on the selected site.",
    permissions: [
      ["lrs:read", "View LRs"],
      ["lrs:create", "Create LRs"],
      ["lrs:update", "Edit LRs"],
    ],
  },
  {
    title: "Reports and ledger",
    description: "Download the complete booking ledger for one operating day at this site.",
    permissions: [["ledger:export", "Download daily ledger"]],
  },
  {
    title: "Finance and payments",
    description: "View site finance, update finance details, and manage payment records.",
    permissions: [
      ["finance:read", "View finance"],
      ["finance:update", "Update finance"],
      ["payments:read", "View payments"],
      ["payments:create", "Record payments"],
    ],
  },
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

function SiteActivityCharts({ sites, activityByDate, fromDate, toDate }) {
  const rows = sites || [];
  if (!rows.length) return null;
  const hasActivity = rows.some((site) =>
    Number(site.total_trips) || Number(site.total_lrs));
  if (!hasActivity) return null;
  const activity = rows.map((row) => ({
    site: row.site.name,
    trips: Number(row.total_trips) || 0,
    lrs: Number(row.total_lrs) || 0,
  }));
  const dailyActivity = (activityByDate || []).map((row) => ({
    date: row.date,
    trips: Number(row.total_trips) || 0,
    lrs: Number(row.total_lrs) || 0,
  }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <div className="mb-2">
          <h2 className="font-semibold">Daily bookings and booking LR volume</h2>
          <p className="text-xs text-muted">Operations by operating date · counts</p>
        </div>
        <div role="img" aria-label="Line chart showing daily booking and booking LR counts for the selected period">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={dailyActivity} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false}
                tickFormatter={(value) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short",
                })} interval="preserveStartEnd"
                label={{ value: "Operating date", position: "insideBottom", offset: -2, fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false}
                label={{ value: "Records", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="trips" name="Bookings" stroke="var(--brand)"
                strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="lrs" name="Booking LRs" stroke="var(--brand-light)"
                strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[11px] text-muted">Source: site dashboard · {fromDate} to {toDate}</p>
      </Card>
      <Card className="p-4">
        <div className="mb-2">
          <h2 className="font-semibold">Booking and LR totals by site</h2>
          <p className="text-xs text-muted">Selected period · booking and booking LR counts</p>
        </div>
        <div role="img" aria-label="Bar chart comparing booking and booking LR counts by site in the selected period">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={activity} margin={{ top: 8, right: 8, bottom: 8, left: 4 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="site" tick={{ fontSize: 11 }} tickLine={false}
                label={{ value: "Site", position: "insideBottom", offset: -2, fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false}
                label={{ value: "Records", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="trips" name="Bookings in range" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lrs" name="Booking LRs in range" fill="var(--brand-light)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[11px] text-muted">Source: site dashboard · {fromDate} to {toDate}</p>
      </Card>
    </div>
  );
}

function activityHref(item) {
  if (!item.site_id) return null;
  if (item.target_type === "trip") return `/sites/${item.site_id}/trips/${item.target_id}`;
  const tripId = item.new_values?.trip_id || item.old_values?.trip_id;
  if (item.target_type === "lr" && tripId) {
    return `/sites/${item.site_id}/trips/${tripId}/lrs/${item.target_id}`;
  }
  return null;
}

function ActivityTimeline({ rows }) {
  if (!rows?.length) return null;
  const iconFor = (action) => action?.includes("payment") ? Banknote
    : action?.startsWith("trip.") ? Truck
      : action?.startsWith("lr.") ? FileText
        : action?.startsWith("ledger.") ? CheckCircle2 : Activity;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Recent activity</h2>
          <p className="text-xs text-muted">Latest site operations</p>
        </div>
        <Clock3 size={17} className="text-muted" aria-hidden="true" />
      </div>
      <ul className="activity-timeline space-y-3">
        {rows.slice(0, 6).map((item) => {
          const Icon = iconFor(item.action);
          const href = activityHref(item);
          const content = (
            <>
              <span className="activity-dot mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                  {(item.action || "activity").replaceAll(".", " ")}
                  {item.new_values?.trip_ref ? ` · ${item.new_values.trip_ref}` : ""}
                  {item.new_values?.lr_ref ? ` · ${item.new_values.lr_ref}` : ""}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {item.actor_name || item.actor_username || "Team member"} · {new Date(item.created_at).toLocaleString()}
                </span>
              </span>
              <Icon size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
            </>
          );
          return (
            <li key={item.id} className="relative flex items-start gap-3 pl-0.5">
              {href
                ? <Link to={href} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg py-1 hover:text-brand-700">{content}</Link>
                : <div className="flex min-w-0 flex-1 items-start gap-3 py-1">{content}</div>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function SiteConsole({ user, adminOnly = false }) {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dates, setDates] = useState({ from_date: "", to_date: "" });
  const [datePreset, setDatePreset] = useState("today");
  const [filters, setFilters] = useState({ site_id: "", trip_id: "", trip_status: "", receiver: "" });
  const datesRef = useRef(dates);
  const filtersRef = useRef(filters);
  const siteIdRef = useRef(siteId);
  datesRef.current = dates;
  filtersRef.current = filters;
  siteIdRef.current = siteId;
  const [siteForm, setSiteForm] = useState({ name: "", code: "", location: "", timezone: "Asia/Kolkata" });
  const [siteEdit, setSiteEdit] = useState({ name: "", location: "", city: "", timezone: "" });
  const [receiptControls, setReceiptControls] = useState({
    hindi_conversion_enabled: true, receipt_language: "hindi",
    sender_address_enabled: true, receiver_address_enabled: true, receipt_fee: "2.00",
  });
  const [categoryForm, setCategoryForm] = useState({ goods: "", containers: "" });
  const [migration, setMigration] = useState(null);
  const [tripForm, setTripForm] = useState({ truck_no: "", driver_name: "", vehicle_id: "", driver_id: "" });
  const [tripResources, setTripResources] = useState({ vehicles: [], drivers: [] });
  const [dailyLedgerDate, setDailyLedgerDate] = useState(isoDay());
  const [downloadingDailyLedger, setDownloadingDailyLedger] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: "", username: "", password: "" });
  const [siteManagerTeamId, setSiteManagerTeamId] = useState("");
  const [newSiteManager, setNewSiteManager] = useState(false);
  const [newTeamManager, setNewTeamManager] = useState({ name: "", mobile: "", role: "Manager" });
  const [temporaryCredential, setTemporaryCredential] = useState(null);
  const [credentialCopied, setCredentialCopied] = useState(false);
  const [grantForm, setGrantForm] = useState({ username: "", site_id: "", permissions: ["dashboard:read", "trips:read", "lrs:read"] });
  const siteEditDirtyFields = useRef({});
  const teamDirectory = useMaster(owner ? "team" : null);

  const loadBoardLrs = useCallback(async (id, tripId) => {
    setBoardTripId(tripId || "");
    setBoardLrs([]);
    if (!id || !tripId) return;
    const sitePermissions = user?.site_permissions?.[id] || [];
    if (!owner && !sitePermissions.includes("lrs:read")) return;
    try {
      const response = await api.get(`/sites/${id}/trips/${tripId}/lrs`, {
        params: { limit: 100, offset: 0 },
      });
      setBoardLrs(response.data.rows || []);
    } catch {
      setBoardLrs([]);
    }
  }, [owner, user]);

  const loadSiteWorkspace = useCallback(async (id) => {
    const results = await Promise.allSettled([
      api.get(`/sites/${id}/trips`, { params: { limit: 20, offset: 0 } }),
      owner ? Promise.resolve(null) : api.get(`/sites/${id}/dashboard`),
      api.get(`/sites/${id}/trip-resources`),
    ]);
    const failures = [];
    const [tripsResult, dashboardResult, resourcesResult] = results;

    if (tripsResult.status === "fulfilled") {
      const rows = tripsResult.value.data.rows || [];
      setTripRows(rows);
      setTripTotal(tripsResult.value.data.total || 0);
      setTripOffset(rows.length);
      await loadBoardLrs(id, rows[0]?.id);
    } else {
      setTripRows([]);
      setTripTotal(0);
      setTripOffset(0);
      setBoardTripId("");
      setBoardLrs([]);
      failures.push(`Booking records: ${errMsg(tripsResult.reason)}`);
    }

    if (!owner) {
      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value.data);
      } else {
        failures.push(`Site dashboard: ${errMsg(dashboardResult.reason)}`);
      }
    }

    if (resourcesResult.status === "fulfilled") {
      setTripResources(resourcesResult.value.data);
    } else {
      setTripResources({ vehicles: [], drivers: [] });
      failures.push(`Vehicle and driver options: ${errMsg(resourcesResult.reason)}`);
    }

    setError(failures.length ? `Some site information could not be loaded. ${failures.join(" · ")}` : "");
  }, [loadBoardLrs, owner]);

  const refresh = useCallback(async (preferredSite = siteIdRef.current, preserveDrafts = false) => {
    setLoading(true);
    setError("");
    try {
      const [siteResponse, dashboardResponse, managerResponse] = await Promise.all([
        api.get("/sites"),
        owner && !adminOnly
          ? api.get("/sites/system-dashboard", { params: Object.fromEntries(
            Object.entries({ ...datesRef.current, ...filtersRef.current }).filter(([, v]) => v),
          ) })
          : Promise.resolve(null),
        owner ? api.get("/sites/managers") : Promise.resolve(null),
      ]);
      const availableSites = siteResponse.data;
      setSites(availableSites);
      if (!adminOnly) setDashboard(dashboardResponse?.data || null);
      setManagers(managerResponse?.data || []);
      const selected = availableSites.find((item) => item.id === preferredSite) || availableSites[0];
      setSiteId(selected?.id || "");
      if (selected) {
        const nextSiteEdit = {
          name: selected.name, location: selected.location || "",
          city: selected.city || "", timezone: selected.timezone || "Asia/Kolkata",
        };
        setSiteEdit((current) => preserveDrafts
          ? { ...nextSiteEdit, ...Object.fromEntries(
            Object.keys(siteEditDirtyFields.current).map((key) => [key, current[key]]),
          ) }
          : nextSiteEdit);
        const configuredReceiptControls = selected.config?.receipt_controls || {};
        setReceiptControls({
          hindi_conversion_enabled: configuredReceiptControls.hindi_conversion_enabled !== false,
          receipt_language: configuredReceiptControls.receipt_language === "english" ? "english" : "hindi",
          sender_address_enabled: configuredReceiptControls.sender_address_enabled !== false,
          receiver_address_enabled: configuredReceiptControls.receiver_address_enabled !== false,
          receipt_fee: configuredReceiptControls.receipt_fee ?? "2.00",
        });
        if (!preserveDrafts) siteEditDirtyFields.current = {};
        else if (Object.keys(siteEditDirtyFields.current).length) {
          setMessage("Latest data loaded. Your unsaved site edits were kept; review before saving.");
        }
      }
      if (selected && !adminOnly) {
        await loadSiteWorkspace(selected.id);
      } else if (selected) {
        setTripRows([]);
        setTripTotal(0);
        setTripOffset(0);
        setTripResources({ vehicles: [], drivers: [] });
        setBoardTripId("");
        setBoardLrs([]);
      } else {
        setTripRows([]);
        setTripTotal(0);
        setTripOffset(0);
        setTripResources({ vehicles: [], drivers: [] });
        setBoardTripId("");
        setBoardLrs([]);
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [adminOnly, loadSiteWorkspace, owner]);

  useEffect(() => {
    refresh();
    const reload = () => refresh(siteIdRef.current, true);
    window.addEventListener(DATA_CHANGE_EVENT, reload);
    return () => window.removeEventListener(DATA_CHANGE_EVENT, reload);
  }, [refresh]);

  const selectSite = async (id) => {
    siteEditDirtyFields.current = {};
    setSiteId(id);
    if (owner) setFilters((current) => ({ ...current, site_id: id }));
    if (!id) {
      setTripRows([]);
      setTripTotal(0);
      setTripOffset(0);
      setTripResources({ vehicles: [], drivers: [] });
      setBoardTripId("");
      setBoardLrs([]);
      return;
    }
    const selected = sites.find((item) => item.id === id);
    if (selected) setSiteEdit({
      name: selected.name, location: selected.location || "",
      city: selected.city || "", timezone: selected.timezone || "Asia/Kolkata",
    });
    if (selected) {
      const configuredReceiptControls = selected.config?.receipt_controls || {};
      setReceiptControls({
        hindi_conversion_enabled: configuredReceiptControls.hindi_conversion_enabled !== false,
        receipt_language: configuredReceiptControls.receipt_language === "english" ? "english" : "hindi",
        sender_address_enabled: configuredReceiptControls.sender_address_enabled !== false,
        receiver_address_enabled: configuredReceiptControls.receiver_address_enabled !== false,
        receipt_fee: configuredReceiptControls.receipt_fee ?? "2.00",
      });
    }
    if (adminOnly) return;
    await loadSiteWorkspace(id);
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
      siteEditDirtyFields.current = {};
      setMessage("Site details updated.");
      await refresh(siteId);
    } catch (e) { setError(errMsg(e)); }
  };

  const saveReceiptControls = async (event) => {
    event.preventDefault();
    const selected = sites.find((site) => site.id === siteId);
    if (!selected) return;
    try {
      await api.put(`/sites/${siteId}`, {
        config: {
          ...(selected.config || {}),
          receipt_controls: {
            hindi_conversion_enabled: receiptControls.hindi_conversion_enabled,
            receipt_language: receiptControls.receipt_language,
            sender_address_enabled: receiptControls.sender_address_enabled,
            receiver_address_enabled: receiptControls.receiver_address_enabled,
            receipt_fee: receiptControls.receipt_fee,
          },
        },
      });
      setMessage("Booking settings updated.");
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
      let teamMemberId = siteManagerTeamId;
      let teamMember = teamDirectory.data?.find((member) => member.id === teamMemberId);
      const result = await api.post("/sites", siteForm);
      if (newSiteManager) {
        try {
          const newMember = await api.post("/masters/team", newTeamManager);
          teamMemberId = newMember.data.id;
          teamMember = newMember.data;
          await teamDirectory.reload();
        } catch (teamError) {
          setMessage(`Site ${result.data.name} was created.`);
          setError(`Could not add the manager to Office Team: ${errMsg(teamError)} You can finish manager setup from Booking access management.`);
          setSiteForm({ name: "", code: "", location: "", timezone: "Asia/Kolkata" });
          await refresh(result.data.id);
          return;
        }
      }

      if (teamMemberId && teamMember) {
        const existingManager = managers.find((manager) => manager.team_member_id === teamMemberId);
        const username = existingManager?.username || managerForm.username.trim().toLowerCase();
        try {
          await api.post(`/sites/${result.data.id}/manager`, {
            name: teamMember.name,
            username,
            team_member_id: teamMemberId,
            ...(existingManager ? {} : { password: managerForm.password }),
          });
          if (!existingManager) {
            setTemporaryCredential({ username, password: managerForm.password });
            setCredentialCopied(false);
          }
          setMessage(`Site ${result.data.name} created and manager ${teamMember.name} assigned.`);
        } catch (managerError) {
          setMessage(`Site ${result.data.name} was created.`);
          setError(`The site manager could not be assigned: ${errMsg(managerError)} Open Booking access management to finish the assignment.`);
        }
      } else {
        setMessage(`Site ${result.data.name} created.`);
      }
      setSiteForm({ name: "", code: "", location: "", timezone: "Asia/Kolkata" });
      setSiteManagerTeamId("");
      setNewSiteManager(false);
      setNewTeamManager({ name: "", mobile: "", role: "Manager" });
      setManagerForm({ name: "", username: "", password: "" });
      await refresh(result.data.id);
    } catch (e) { setError(errMsg(e)); }
  };

  const selectSiteManager = (teamMemberId) => {
    setSiteManagerTeamId(teamMemberId);
    setNewSiteManager(teamMemberId === "__new__");
    const member = teamDirectory.data?.find((row) => row.id === teamMemberId);
    setManagerForm((current) => ({
      ...current,
      name: member?.name || "",
      username: "",
      password: "",
    }));
    setNewTeamManager((current) => ({ ...current, name: "" }));
  };

  const assignManager = async (event) => {
    event.preventDefault();
    try {
      const body = { ...managerForm };
      if (!body.password) delete body.password;
      const username = body.username.trim().toLowerCase();
      const temporaryPassword = body.password;
      await api.post(`/sites/${siteId}/manager`, body);
      if (temporaryPassword) {
        setTemporaryCredential({ username, password: temporaryPassword });
        setCredentialCopied(false);
        setMessage("Site manager assigned. Copy the temporary credential now and share it securely.");
      } else {
        setTemporaryCredential(null);
        setMessage("Site manager assigned.");
      }
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

  const downloadDailyLedger = async () => {
    if (!siteId || !dailyLedgerDate) return;
    setDownloadingDailyLedger(true);
    setError("");
    try {
      const response = await api.get(`/sites/${siteId}/ledger/daily`, {
        params: { operating_date: dailyLedgerDate },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sites.find((site) => site.id === siteId)?.code || "site"}-daily-ledger-${dailyLedgerDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setDownloadingDailyLedger(false);
    }
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

  if (adminOnly) return (
    <div className="space-y-5">
      <PageHead title="Booking setup & access"
        subtitle="Manage booking sites, site-manager access, and booking categories separately from daily operations." />
      {error && <ErrorState text={error} onRetry={() => refresh()} />}
      {message && <div role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>}
      <Card className="p-4">
        <label className="block max-w-sm text-sm font-medium">Site for setup and access
          <select className={field} value={siteId} onChange={(event) => selectSite(event.target.value)}>
            <option value="">Select site...</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name} ({site.code})</option>)}
          </select>
        </label>
      </Card>

      <details open className="rounded-xl border border-line bg-white p-4">
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-700">Site setup</summary>
        <div className="mt-3 space-y-3">
          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Add a site</h2>
            <form onSubmit={createSite} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm">Site name
                  <input className={field} placeholder="Site name" required value={siteForm.name}
                    onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} />
                </label>
                <label className="text-sm">Short code
                  <input className={field} placeholder="e.g. NGP" required value={siteForm.code}
                    onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })} />
                </label>
                <label className="text-sm">Location (optional)
                  <input className={field} placeholder="Street, area, or landmark" value={siteForm.location}
                    onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })} />
                </label>
                <label className="text-sm">Time zone
                  <input className={field} aria-label="IANA time zone" value={siteForm.timezone}
                    onChange={(e) => setSiteForm({ ...siteForm, timezone: e.target.value })} />
                </label>
              </div>
              <label className="block max-w-xl text-sm">Site manager (optional)
                <select className={field} value={newSiteManager ? "__new__" : siteManagerTeamId}
                  onChange={(event) => selectSiteManager(event.target.value)}>
                  <option value="">Assign later</option>
                  {(teamDirectory.data || []).filter((member) =>
                    member.status !== "Inactive" && /manager/i.test(member.role || "")
                  ).map((member) => (
                    <option key={member.id} value={member.id}>{member.name}{member.role ? ` · ${member.role}` : ""}</option>
                  ))}
                  <option value="__new__">+ Add a new manager</option>
                </select>
              </label>
              {teamDirectory.loading && <p className="text-xs text-muted">Loading Office Team…</p>}
              {teamDirectory.error && <p className="text-sm text-red-700">Could not load Office Team: {teamDirectory.error}</p>}
              {newSiteManager && <div className="space-y-3 rounded-lg border border-line bg-canvas p-3">
                <h3 className="font-semibold">Add manager to Office Team</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-sm">Manager name
                    <input className={field} required value={newTeamManager.name}
                      onChange={(e) => {
                        setNewTeamManager({ ...newTeamManager, name: e.target.value });
                        setManagerForm({ ...managerForm, name: e.target.value });
                      }} />
                  </label>
                  <label className="text-sm">Mobile (optional)
                    <input className={field} value={newTeamManager.mobile}
                      onChange={(e) => setNewTeamManager({ ...newTeamManager, mobile: e.target.value })} />
                  </label>
                  <label className="text-sm">Office Team role
                    <input className={field} required value={newTeamManager.role}
                      onChange={(e) => setNewTeamManager({ ...newTeamManager, role: e.target.value })} />
                  </label>
                </div>
              </div>}
              {siteManagerTeamId && siteManagerTeamId !== "__new__" && (() => {
                const linked = managers.find((manager) => manager.team_member_id === siteManagerTeamId);
                return <p className="text-sm text-muted">{linked
                  ? `This team member already has manager login ${linked.username}; it will be assigned to the site.`
                  : "This team member does not have a site login yet. Create a login to grant site access."}</p>;
              })()}
              {(newSiteManager || (siteManagerTeamId && siteManagerTeamId !== "__new__"
                && !managers.some((manager) => manager.team_member_id === siteManagerTeamId))) && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">Manager login ID
                    <input className={field} aria-label="Manager login ID" required minLength={3} value={managerForm.username}
                      onChange={(e) => setManagerForm({ ...managerForm, username: e.target.value })} />
                  </label>
                  <label className="text-sm">Manager password
                    <input className={field} aria-label="Manager password" type="password" required value={managerForm.password}
                      onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })} />
                  </label>
                </div>
              )}
              {(newSiteManager || (siteManagerTeamId && siteManagerTeamId !== "__new__"
                && !managers.some((manager) => manager.team_member_id === siteManagerTeamId))) && (
                <p className="text-xs text-muted">
                  Any non-empty password is accepted. Short passwords are easier to guess; the password is stored as a hash and shown once after creation.
                </p>
              )}
              <Btn type="submit">Create site</Btn>
            </form>
          </Card>
          {siteId && <Card className="p-4">
            <h2 className="mb-3 font-semibold">Edit selected site</h2>
            <form onSubmit={saveSite} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs font-medium text-muted">Site name
                <input className={field} aria-label="Site name" required value={siteEdit.name}
                  onChange={(e) => {
                    siteEditDirtyFields.current.name = true;
                    setSiteEdit({ ...siteEdit, name: e.target.value });
                  }} />
              </label>
              <label className="text-xs font-medium text-muted">Location (optional)
                <input className={field} aria-label="Location" placeholder="Street, area, or landmark" value={siteEdit.location}
                  onChange={(e) => {
                    siteEditDirtyFields.current.location = true;
                    setSiteEdit({ ...siteEdit, location: e.target.value });
                  }} />
              </label>
              <label className="text-xs font-medium text-muted">City (optional)
                <input className={field} aria-label="City" placeholder="City" value={siteEdit.city}
                  onChange={(e) => {
                    siteEditDirtyFields.current.city = true;
                    setSiteEdit({ ...siteEdit, city: e.target.value });
                  }} />
              </label>
              <label className="text-xs font-medium text-muted">Time zone
                <input className={field} aria-label="Site time zone" placeholder="Asia/Kolkata" value={siteEdit.timezone}
                  onChange={(e) => {
                    siteEditDirtyFields.current.timezone = true;
                    setSiteEdit({ ...siteEdit, timezone: e.target.value });
                  }} />
              </label>
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
        </div>
      </details>

      <details className="rounded-xl border border-line bg-white p-4">
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-700">Booking settings</summary>
        {siteId ? <form onSubmit={saveReceiptControls} className="mt-3 space-y-4">
          <Card className="space-y-4 p-4">
            <h2 className="text-lg font-semibold">Receipt controls</h2>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700"
                checked={receiptControls.hindi_conversion_enabled}
                onChange={(event) => setReceiptControls((current) => ({
                  ...current, hindi_conversion_enabled: event.target.checked,
                }))} />
              <span><strong>Convert English entry to Hindi for ledger and printing</strong>
                <span className="mt-1 block text-muted">Receipt entry and editing remain in English. Disabling conversion applies to new and edited receipts.</span>
              </span>
            </label>
            <label className="block max-w-xs text-sm">Receipt print language
              <select className={field} value={receiptControls.receipt_language}
                onChange={(event) => setReceiptControls((current) => ({
                  ...current, receipt_language: event.target.value,
                }))}>
                <option value="hindi">Hindi</option>
                <option value="english">English</option>
              </select>
            </label>
            <label className="block max-w-xs text-sm">Receipt fee (₹)
              <input className={field} type="number" min="0" step="0.01" required
                value={receiptControls.receipt_fee}
                onChange={(event) => setReceiptControls((current) => ({
                  ...current, receipt_fee: event.target.value,
                }))} />
              <span className="mt-1 block text-muted">Applies to receipts created after this setting is saved. Existing receipts keep their recorded fee.</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["sender_address_enabled", "Show sender address on receipt"],
                ["receiver_address_enabled", "Show receiver address on receipt"],
              ].map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-brand-700"
                  checked={receiptControls[key]}
                  onChange={(event) => setReceiptControls((current) => ({
                    ...current, [key]: event.target.checked,
                  }))} />
                <span>{label} (entry and printing)</span>
              </label>)}
            </div>
            <Btn type="submit">Save booking settings</Btn>
          </Card>
        </form> : <p className="mt-3 text-sm text-muted">Select a site to manage receipt controls.</p>}
      </details>

      <details data-testid="booking-access-management" open={Boolean(temporaryCredential) || undefined}
        className="rounded-xl border border-line bg-white p-4">
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-700">Booking access management</summary>
        <div className="mt-3 space-y-3">
          {siteId && <Card className="p-4">
            <h2 className="mb-3 font-semibold">Assign or replace the site manager</h2>
            <form onSubmit={assignManager} className="grid gap-3 md:grid-cols-4">
              <label className="text-sm">Manager name
                <input className={field} placeholder="Manager name" required value={managerForm.name}
                  onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })} />
              </label>
              <label className="text-sm">Manager ID
                <input className={field} placeholder="Username" required value={managerForm.username}
                  onChange={(e) => setManagerForm({ ...managerForm, username: e.target.value })} />
              </label>
              <label className="text-sm">Manager password
                <input className={field} type="password" aria-label="Manager password for assignment"
                  placeholder={managers.some((manager) => manager.username === managerForm.username.trim().toLowerCase())
                    ? "Leave blank to keep current" : "Required for a new login"}
                  required={!managers.some((manager) => manager.username === managerForm.username.trim().toLowerCase())}
                  autoComplete="new-password" value={managerForm.password}
                  onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })} />
              </label>
              <Btn type="submit">Assign manager</Btn>
            </form>
            <p className="mt-2 text-xs text-muted">
              For a new manager, use any non-empty password and share it securely. It is stored as a hash and shown once after assignment. Replacing a manager revokes that site’s access without removing historical records.
            </p>
          </Card>}
          <Card className="p-4">
            <h2 className="font-semibold">Manager site access</h2>
            <p className="mt-1 text-sm text-muted">
              Choose a manager and site, then tick only the actions that manager needs there.
              This changes access for that site only; it does not grant access to every site.
            </p>
            <form onSubmit={grantAccess} className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium">Manager
                  <select className={field} aria-label="Manager for site access" required value={grantForm.username}
                    onChange={(e) => {
                      const permissions = managers.find((manager) => manager.username === e.target.value)
                        ?.site_permissions?.[grantForm.site_id];
                      setGrantForm({
                        ...grantForm,
                        username: e.target.value,
                        permissions: permissions || ["dashboard:read", "trips:read", "lrs:read"],
                      });
                    }}>
                    <option value="">Select a manager</option>
                    {managers.filter((manager) => manager.active).map((manager) => (
                      <option key={manager.username} value={manager.username}>{manager.name} ({manager.username})</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">Site
                  <select className={field} aria-label="Site for manager access" required value={grantForm.site_id}
                    onChange={(e) => {
                      const existingPermissions = managers.find((manager) => manager.username === grantForm.username)?.site_permissions?.[e.target.value];
                      setGrantForm({ ...grantForm, site_id: e.target.value,
                        permissions: existingPermissions || ["dashboard:read", "trips:read", "lrs:read"] });
                    }}>
                    <option value="">Select a site</option>
                    {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {permissionGroups.map((group) => (
                  <fieldset key={group.title} className="rounded-lg border border-line bg-canvas p-3">
                    <legend className="px-1 text-sm font-semibold">{group.title}</legend>
                    <p className="mb-3 text-xs text-muted">{group.description}</p>
                    <div className="space-y-2">
                      {group.permissions.map(([permission, label]) => (
                        <label key={permission} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-white">
                          <input type="checkbox" className="h-4 w-4 accent-brand-700"
                            aria-label={label} disabled={!grantForm.username || !grantForm.site_id}
                            checked={grantForm.permissions.includes(permission)}
                            onChange={(event) => setGrantForm({ ...grantForm, permissions: event.target.checked
                              ? [...grantForm.permissions, permission]
                              : grantForm.permissions.filter((value) => value !== permission) })} />
                          <span>{label}<span className="ml-2 text-xs text-muted">({permission})</span></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-xs text-muted">Unticked actions are unavailable to this manager at this site.</p>
                <Btn type="submit">Save site access</Btn>
              </div>
            </form>
            <h3 className="mt-4 border-t pt-4 font-semibold">Manager account register</h3>
            <p className="mt-1 text-xs text-muted">Manager IDs, status, and assigned sites stay listed here. A newly set password is shown only once after assignment/reset; if it is lost, reset it to create a new one.</p>
            {temporaryCredential && <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3" role="status" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block">Temporary credential — copy it now</strong>
                  <p className="mt-1 text-sm">Manager ID: <code>{temporaryCredential.username}</code></p>
                  <p className="mt-1 break-all text-sm">Temporary password: <code>{temporaryCredential.password}</code></p>
                  <p className="mt-1 text-xs text-muted">Held only in this page’s memory; it is not returned by the server.</p>
                </div>
                <button type="button" className="rounded p-1 text-muted hover:text-ink" aria-label="Dismiss temporary credential"
                  onClick={() => setTemporaryCredential(null)}><X size={18} /></button>
              </div>
              <button type="button" className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`Manager ID: ${temporaryCredential.username}\nTemporary password: ${temporaryCredential.password}`);
                    setCredentialCopied(true);
                  } catch {
                    setError("Could not copy the credential. Select and copy it manually, then share it securely.");
                  }
                }}>
                {credentialCopied ? <Check size={16} /> : <Copy size={16} />}
                {credentialCopied ? "Copied" : "Copy credential"}
              </button>
            </div>}
            <div className="mt-4 divide-y border-t">
              {managers.length === 0
                ? <p className="py-3 text-sm text-muted">No manager accounts have been created.</p>
                : managers.map((manager) => <div key={manager.username} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="min-w-0">
                    <strong className="block">{manager.name} · {manager.active ? "Active" : "Inactive"}</strong>
                    <span>Manager ID: <code>{manager.username}</code></span>
                    <span className="block">Office team profile: {teamDirectory.data?.find((member) => member.id === manager.team_member_id)?.name || "Not linked"}</span>
                    <span className="block">Assigned sites: {sites.filter((site) => manager.site_ids?.includes(site.id)).map((site) => site.name).join(", ") || "None"}</span>
                  </span>
                  <div className="flex gap-2">
                    <button className="text-brand-700 underline" onClick={async () => {
                      const password = window.prompt("Enter a new manager password:");
                      if (!password) return;
                      try {
                        await api.post(`/sites/managers/${encodeURIComponent(manager.username)}/reset-password`, { password });
                        setTemporaryCredential({ username: manager.username, password });
                        setCredentialCopied(false);
                        setMessage("Manager password reset. Copy the temporary credential now and share it securely.");
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
          </Card>
        </div>
      </details>

      <details className="rounded-xl border border-line bg-white p-4">
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-700">Booking categories</summary>
        {siteId ? <Card className="mt-3 grid gap-4 p-4 md:grid-cols-2">
          <form onSubmit={(event) => addCategory("goods", event)} className="flex gap-2">
            <input className={field} aria-label="New goods category" placeholder="Add goods category"
              value={categoryForm.goods} onChange={(event) => setCategoryForm({ ...categoryForm, goods: event.target.value })} />
            <Btn type="submit">Add goods</Btn>
          </form>
          <form onSubmit={(event) => addCategory("containers", event)} className="flex gap-2">
            <input className={field} aria-label="New container category" placeholder="Add container category"
              value={categoryForm.containers} onChange={(event) => setCategoryForm({ ...categoryForm, containers: event.target.value })} />
            <Btn type="submit">Add container</Btn>
          </form>
        </Card> : <p className="mt-3 text-sm text-muted">Select a site to manage its booking categories.</p>}
      </details>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHead title="Booking Dashboard"
        subtitle={owner
          ? `Daily booking activity · ${dashboard?.from_date || "today"} to ${dashboard?.to_date || "today"}`
          : "Daily bookings and transport activity for your assigned site."} />
      {error && <ErrorState text={error} onRetry={() => refresh()} />}
      {message && <div role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>}
      {owner && dashboard?.totals && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Bookings", value: dashboard.totals.total_trips, icon: Truck },
              { label: "Active bookings", value: dashboard.totals.open_trips, icon: Activity },
              { label: "Booking LRs", value: dashboard.totals.total_lrs, icon: FileText },
              { label: "Pending reconciliation", value: dashboard.totals.pending_reconciliation, icon: CheckCircle2 },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="dashboard-kpi dashboard-hero p-3.5">
                <span className="dashboard-kpi-icon"><Icon size={17} strokeWidth={1.9} /></span>
                <p className="mt-3 text-[11px] font-semibold leading-tight text-muted">{label}</p>
                <p className="num mt-1.5 break-words text-lg font-bold leading-tight text-ink">{value}</p>
              </Card>
            ))}
          </div>
          <Card className="dashboard-hero p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Quick actions</h2>
                <p className="mt-0.5 text-xs text-muted">Common tasks, one step away</p>
              </div>
              <MapPin size={17} className="text-brand-500" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <a className="btn-p justify-center" href="#site-trip-create-form">Create booking</a>
              {selectedBoardTrip
                ? <Link className="btn-s justify-center" to={`/sites/${siteId}/trips/${selectedBoardTrip.id}`}>Open selected booking</Link>
                : <a className="btn-s justify-center" href="#booking-lrs">Choose a booking for an LR</a>}
              <a className="btn-s justify-center" href="#booking-records">View booking records</a>
              <Link className="btn-s justify-center" to="/booking/receipts">Receipts</Link>
              <Link className="btn-s justify-center" to="/booking/ledger">Ledger</Link>
              {owner && <Link className="btn-s justify-center" to="/booking-setup">Booking setup & access</Link>}
              <Link className="btn-s justify-center" to="/vehicles">Manage Vehicles</Link>
              <Link className="btn-s justify-center" to="/parties">Manage Parties</Link>
            </div>
          </Card>
          <SiteActivityCharts sites={dashboard.sites} activityByDate={dashboard.activity_by_date}
            fromDate={dashboard.from_date} toDate={dashboard.to_date} />
          <details className="rounded-xl border border-line bg-white p-4">
            <summary className="min-h-11 cursor-pointer content-center font-semibold text-brand-700">
              Dashboard filters
            </summary>
            <div className="mt-3 space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Filter dashboard totals</h2>
            <div className="grid gap-3 md:grid-cols-6">
              <label className="text-sm">Period<select className={field} value={datePreset} onChange={(event) => {
                const value = event.target.value;
                setDatePreset(value);
                if (value !== "custom") setDates(dateRangeForPreset(value));
              }}>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select></label>
              {datePreset === "custom" && <>
                <label className="text-sm">From<input className={field} type="date" value={dates.from_date}
                  onChange={(e) => setDates((x) => ({ ...x, from_date: e.target.value }))} /></label>
                <label className="text-sm">To<input className={field} type="date" value={dates.to_date}
                  onChange={(e) => setDates((x) => ({ ...x, to_date: e.target.value }))} /></label>
              </>}
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
            </div>
          </details>
          {dashboard.alerts && <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="dashboard-kpi-icon bg-amber-50 text-amber-600"><AlertTriangle size={17} /></span>
              <div><h2 className="font-semibold">Needs attention</h2><p className="text-xs text-muted">Operational items that may need action</p></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Trips awaiting closure", dashboard.alerts.trips_awaiting_closure],
                ["Trips awaiting ledger upload", dashboard.alerts.ledgers_awaiting_upload],
                ["Ledger imports to review", dashboard.alerts.ledger_imports_needing_review],
              ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2.5 text-sm">
                <span className="text-muted">{label}</span><strong className="num text-ink">{value}</strong>
              </div>)}
            </div>
          </Card>}
          {!owner && dashboard.receivables && <details className="rounded-xl border border-line bg-white p-4">
            <summary className="min-h-10 cursor-pointer content-center font-semibold text-brand-700">
              Detailed receivables by receiver and goods
            </summary>
            <div className="mt-3 space-y-4">
              <p className="text-sm text-muted">{dashboard.receivables.basis}</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  ["Collectible outstanding", money0(dashboard.receivables.collectible_outstanding), "text-amber-800"],
                  ["Reconciled rent", money0(dashboard.receivables.reconciled_rent), ""],
                  ["Posted payments", money0(dashboard.receivables.posted_payments), ""],
                  ["Unreconciled bhada · not collectible", money0(dashboard.receivables.unreconciled_bhada), "text-amber-800"],
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
            </div>
          </details>}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="font-semibold">Site overview</h2><p className="text-xs text-muted">Select a site to jump to its operational workspace</p></div>
              <MapPin size={18} className="text-brand-500" aria-hidden="true" />
            </div>
            {(dashboard.sites || []).length === 0
              ? <p className="py-5 text-sm text-muted">No sites match the selected dashboard filters.</p>
              : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{dashboard.sites.map((row) => (
                <article key={row.site.id} className={`site-overview-card card p-4 ${siteId === row.site.id ? "border-brand-400" : ""}`}>
                  <button type="button" aria-pressed={siteId === row.site.id}
                    className="flex w-full items-start justify-between gap-3 rounded-lg text-left focus-visible:outline"
                    onClick={() => {
                      selectSite(row.site.id);
                      document.getElementById("booking-lrs")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}>
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="dashboard-kpi-icon shrink-0"><MapPin size={17} /></span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{row.site.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">{row.site.code} · {row.site.location || "Location not set"}</span>
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                      row.site.status === "Active" ? "bg-brand-50 text-brand-700" : "bg-canvas text-muted"}`}>
                      {row.site.status}
                    </span>
                  </button>
                  <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-line pt-3">
                    {[
                      ["Trips today", row.trips_today],
                      ["Active trips", row.open_trips],
                      ["Total LRs", row.total_lrs],
                      ["Pending reconciliation", row.pending_reconciliation],
                    ].map(([label, value]) => <div key={label} className="min-w-0">
                      <p className="truncate text-[10px] font-medium text-muted">{label}</p>
                      <p className="num mt-0.5 truncate text-sm font-semibold text-ink">{value}</p>
                    </div>)}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
                    <span className="text-muted">Manager {row.active_managers ? "assigned" : "unassigned"}</span>
                    {owner && <button type="button" className="min-h-8 rounded-md px-2 font-medium text-brand-700 hover:bg-brand-50"
                      onClick={() => setStatus(row.site)}>
                      {row.site.status === "Active" ? "Deactivate" : "Activate"}
                    </button>}
                  </div>
                </article>
              ))}</div>}
          </Card>
          <ActivityTimeline rows={dashboard.recent_activity} />
        </>
      )}

      <Card id="site-operations" className="p-4">
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

      {siteId && <Card id="booking-lrs" className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">Selected-site booking window</h2>
            <p className="text-sm text-muted">{sites.find((site) => site.id === siteId)?.name || "Site"} · latest trip and its LR context</p>
          </div>
          <label className="w-full text-sm sm:max-w-sm">Trip
            <select className={field} value={boardTripId} onChange={(e) => {
              loadBoardLrs(siteId, e.target.value);
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
        {!selectedBoardTrip && <p className="text-sm text-muted">Select a trip to view its LR context.</p>}
        {boardTripId && <>
          {boardLrs.length === 0
            ? <p className="text-sm text-muted">No LRs found, or LR detail is not available to this role.</p>
            : <div className="grid gap-4 lg:grid-cols-2">
              {!owner && <section className="rounded-lg border border-line p-3">
                <h3 className="mb-2 text-sm font-semibold">Outstanding by receiver / person</h3>
                <div className="space-y-2">{receivableByReceiver.map((group) => <div key={group.label} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0">
                  <span className="min-w-0"><strong className="block break-words">{group.label}</strong><span className="text-xs text-muted">{group.lrs} LR{group.lrs === 1 ? "" : "s"} · {group.parcels} parcels</span></span>
                  {group.hasFinance && <strong className="num shrink-0">{group.outstanding.toFixed(2)}</strong>}
                </div>)}</div>
              </section>}
              {!owner && <section className="rounded-lg border border-line p-3">
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

      {siteId && <Card id="site-trip-create-form" className="p-4">
        <h2 className="mb-3 font-semibold">Create a daily booking</h2>
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
          <Btn type="submit">Create booking</Btn>
        </form>
      </Card>}

      {siteId && (owner || user?.site_permissions?.[siteId]?.includes("ledger:export")) && <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Daily booking ledger</h2>
            <p className="mt-1 text-sm text-muted">Download all bookings, LRs, charges, collections, and payment details for this site and operating date.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">Operating date
              <input className={field} type="date" aria-label="Daily ledger operating date"
                value={dailyLedgerDate} onChange={(event) => setDailyLedgerDate(event.target.value)} />
            </label>
            <Btn icon={Download} disabled={!dailyLedgerDate || downloadingDailyLedger}
              onClick={downloadDailyLedger}>
              {downloadingDailyLedger ? "Preparing ledger…" : "Download daily ledger"}
            </Btn>
          </div>
        </div>
      </Card>}

      {siteId &&       <Card id="booking-records" className="p-4">
        <h2 className="mb-3 font-semibold">Site bookings ({tripRows.length} of {tripTotal})</h2>
        {tripRows.length === 0 ? <p className="text-sm text-muted">No bookings recorded at this site yet.</p> :
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{tripRows.map((trip) => <Link key={trip.id}
            className="rounded-lg border border-line p-3 hover:border-brand-400 hover:text-brand-700"
            to={`/sites/${siteId}/trips/${trip.id}`}>
            <div className="flex items-start justify-between gap-2"><strong>{trip.trip_ref}</strong><span className="text-xs">{trip.status}</span></div>
            <p className="mt-1 break-words text-sm">{trip.truck_no} · {trip.driver_name}</p>
            <p className="mt-1 text-xs text-muted">{trip.operating_date}</p>
          </Link>)}</div>}
        {tripRows.length < tripTotal && <Btn variant="s" className="mt-3" onClick={loadMoreTrips}>Load more bookings</Btn>}
      </Card>}
    </div>
  );
}
