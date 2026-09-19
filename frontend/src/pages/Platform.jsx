import React, { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Building2, KeyRound, Plus, ShieldCheck, SlidersHorizontal, Truck, Wallet } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { money, money0, dmy } from "../lib/format";
import {
  Badge, Btn, Card, DataTable, EmptyState, ErrorState, Input, Loader, Modal, PageHead, Select, Stat, TextArea, toast,
} from "../components/ui";

const DEFAULT_FEATURES = {
  trips: true, vehicles: true, parties: true, team: true, finance: true,
  reports: true, tracking: true, lr_charts: true, dashboard_charts: true,
};

const FEATURE_LABELS = {
  trips: "Trips & LR", vehicles: "Vehicles", parties: "Parties", team: "Team & Payroll",
  finance: "Finance", reports: "Reports", tracking: "GPS Live Tracking",
  lr_charts: "LR Charts", dashboard_charts: "Dashboard Charts",
};

const blank = {
  name: "", owner_name: "", owner_username: "", owner_password: "",
  mobile: "", city: "", state: "", plan: "Business", license_days: 365,
};

export default function Platform() {
  const { data, loading, error, reload } = useFetch("/platform/summary");
  const [form, setForm] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [pw, setPw] = useState("");
  const [cust, setCust] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Loader label="Loading platform data…" />;
  if (error) return <ErrorState text={error} onRetry={reload} />;

  const t = data.totals;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.post("/platform/tenants", { ...form, license_days: Number(form.license_days) || 365 });
      toast("Business licence created");
      setForm(null); reload();
    } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };

  const toggle = async (row) => {
    const next = row.license_status === "Active" ? "Suspended" : "Active";
    try {
      await api.put(`/platform/tenants/${row.id}`, { license_status: next });
      toast(`Licence ${next.toLowerCase()}`); reload();
    } catch (e) { toast(errMsg(e), "err"); }
  };

  const saveCust = async () => {
    setBusy(true);
    try {
      await api.put(`/platform/tenants/${cust.id}`, {
        features: cust.features, custom_requests: cust.custom_requests,
        plan: cust.plan, license_expiry: cust.license_expiry,
      });
      toast("Saved for this business only"); setCust(null); reload();
    } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };

  const resetPw = async () => {
    setBusy(true);
    try {
      await api.post(`/platform/tenants/${pwFor.id}/reset-password`, { password: pw });
      toast("Owner password updated"); setPwFor(null); setPw("");
    } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };

  return (
    <div data-testid="platform-page">
      <PageHead title="Platform Control" subtitle="Licences issued to transport businesses — each business keeps its own separate data"
        actions={<Btn icon={Plus} data-testid="new-tenant-btn" onClick={() => setForm(blank)}>New Business Licence</Btn>} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat testid="stat-licenses" label="Licences Issued" value={t.licenses} icon={Building2} />
        <Stat testid="stat-active-licenses" label="Active Licences" value={t.active} icon={ShieldCheck} tone="text-brand-600" />
        <Stat testid="stat-suspended" label="Suspended" value={t.suspended} icon={ShieldCheck} tone={t.suspended ? "text-red-600" : ""} />
        <Stat testid="stat-platform-revenue" label="Freight Billed (all businesses)" value={money0(t.revenue)} icon={Wallet} />
      </div>

      <Card className="mb-5 p-4">
        <h3 className="mb-3 font-head text-[15.5px] font-bold text-ink">Business Activity</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.tenants.map((x) => ({ name: x.name, trips: x.stats.trips, lrs: x.stats.lrs, vehicles: x.stats.vehicles }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EB" vertical={false} />
            <XAxis dataKey="name" fontSize={11} stroke="#69747F" />
            <YAxis fontSize={11} stroke="#69747F" allowDecimals={false} />
            <Tooltip />
            <Legend iconSize={9} />
            <Bar dataKey="trips" name="Trips" fill="#0B5C4E" radius={[3, 3, 0, 0]} />
            <Bar dataKey="lrs" name="LRs" fill="#2C8474" radius={[3, 3, 0, 0]} />
            <Bar dataKey="vehicles" name="Vehicles" fill="#E0A33E" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3"><h3 className="font-head text-[15.5px] font-bold">Licensed Businesses</h3></div>
        <DataTable testid="tenants-table"
          columns={[
            { key: "name", label: "Business", strong: true },
            { key: "owner_name", label: "Owner" },
            { key: "owner_username", label: "Login" },
            { key: "db_name", label: "Database", render: (r) => <span className="num text-[12px]">{r.db_name || `fleet_db_(${r.id})`}</span> },
            { key: "plan", label: "Plan" },
            { key: "license_expiry", label: "Valid Till", render: (r) => dmy(r.license_expiry) },
            { key: "vehicles", label: "Vehicles", right: true, render: (r) => r.stats.vehicles },
            { key: "trips", label: "Trips", right: true, render: (r) => r.stats.trips },
            { key: "lrs", label: "LRs", right: true, render: (r) => r.stats.lrs },
            { key: "revenue", label: "Freight", right: true, render: (r) => money(r.stats.revenue) },
            { key: "license_status", label: "Licence", render: (r) => <Badge>{r.license_status}</Badge> },
            {
              key: "actions", label: "Actions", render: (r) => (
                <div className="flex gap-2">
                  <button data-testid={`toggle-${r.id}`} onClick={() => toggle(r)}
                    className="rounded-md border border-line px-2 py-1 text-[12px] font-semibold hover:border-brand-400">
                    {r.license_status === "Active" ? "Suspend" : "Activate"}
                  </button>
                  <button data-testid={`reset-${r.id}`} onClick={() => { setPwFor(r); setPw(""); }}
                    className="rounded-md border border-line px-2 py-1 text-[12px] font-semibold hover:border-brand-400">
                    <KeyRound size={13} className="inline" /> Password
                  </button>
                  <button data-testid={`customise-${r.id}`}
                    onClick={() => setCust({ id: r.id, name: r.name, features: { ...DEFAULT_FEATURES, ...(r.features || {}) }, custom_requests: r.custom_requests || "", plan: r.plan, license_expiry: r.license_expiry })}
                    className="rounded-md border border-line px-2 py-1 text-[12px] font-semibold hover:border-brand-400">
                    <SlidersHorizontal size={13} className="inline" /> Customise
                  </button>
                </div>
              ),
            },
          ]}
          rows={data.tenants}
          mobile={(r) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{r.name}</span><Badge>{r.license_status}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">{r.owner_name} · {r.owner_username}</p>
              <p className="mt-1 text-[13px] text-muted">{r.stats.trips} trips · {r.stats.lrs} LRs · <span className="num">{money(r.stats.revenue)}</span></p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => toggle(r)} className="rounded-md border border-line px-2 py-1 text-[12px] font-semibold">
                  {r.license_status === "Active" ? "Suspend" : "Activate"}</button>
                <button onClick={() => { setPwFor(r); setPw(""); }} className="rounded-md border border-line px-2 py-1 text-[12px] font-semibold">Password</button>
              </div>
            </div>
          )} />
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title="Issue a New Business Licence"
        subtitle="A separate database is created for this business — their data never mixes with anyone else's"
        footer={<><Btn variant="s" onClick={() => setForm(null)}>Cancel</Btn>
          <Btn disabled={busy || !form?.name || !form?.owner_username || !form?.owner_password} data-testid="save-tenant" onClick={save}>Create Licence</Btn></>}>
        {form && (
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Business Name" required value={form.name} data-testid="tenant-name" onChange={(e) => set("name", e.target.value)} />
            <Input label="Owner Name" required value={form.owner_name} data-testid="tenant-owner" onChange={(e) => set("owner_name", e.target.value)} />
            <Input label="Owner Login Username" required value={form.owner_username} data-testid="tenant-username"
              onChange={(e) => set("owner_username", e.target.value.toLowerCase().trim())} />
            <Input label="Owner Password" required value={form.owner_password} data-testid="tenant-password" onChange={(e) => set("owner_password", e.target.value)} />
            <Input label="Mobile" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
            <Input label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
            <Input label="State" value={form.state} onChange={(e) => set("state", e.target.value)} />
            <Select label="Plan" value={form.plan} onChange={(e) => set("plan", e.target.value)} options={["Starter", "Business", "Enterprise"]} />
            <Input label="Licence Validity (days)" type="number" value={form.license_days} onChange={(e) => set("license_days", e.target.value)} />
          </div>
        )}
      </Modal>

      <Modal open={!!pwFor} onClose={() => setPwFor(null)} title={`Reset password — ${pwFor?.owner_name || ""}`}
        footer={<><Btn variant="s" onClick={() => setPwFor(null)}>Cancel</Btn>
          <Btn disabled={busy || pw.length < 6} data-testid="save-password" onClick={resetPw}>Update Password</Btn></>}>
        <Input label="New Password" value={pw} data-testid="new-password" hint="Minimum 6 characters" onChange={(e) => setPw(e.target.value)} />
      </Modal>
      <Modal open={!!cust} onClose={() => setCust(null)} title={`Customise — ${cust?.name || ""}`}
        subtitle="Turn modules on or off for this business only. Other businesses stay untouched."
        footer={<><Btn variant="s" onClick={() => setCust(null)}>Cancel</Btn>
          <Btn disabled={busy} data-testid="save-customise" onClick={saveCust}>Save for this Business</Btn></>}>
        {cust && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="Plan" value={cust.plan} onChange={(e) => setCust({ ...cust, plan: e.target.value })}
                options={["Starter", "Business", "Enterprise"]} />
              <label className="block"><span className="lbl">Licence Valid Till</span>
                <input type="date" className="fld" value={cust.license_expiry || ""}
                  data-testid="cust-expiry" onChange={(e) => setCust({ ...cust, license_expiry: e.target.value })} /></label>
            </div>
            <div>
              <p className="lbl">Modules for this business</p>
              <div className="grid gap-2 md:grid-cols-2">
                {Object.keys(DEFAULT_FEATURES).map((k) => (
                  <label key={k} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[13.5px]">
                    <input type="checkbox" checked={cust.features[k] !== false} data-testid={`feat-${k}`}
                      onChange={(e) => setCust({ ...cust, features: { ...cust.features, [k]: e.target.checked } })} />
                    <span className="font-medium capitalize">{FEATURE_LABELS[k] || k}</span>
                  </label>
                ))}
              </div>
            </div>
            <TextArea label="Custom Requirement Notes" value={cust.custom_requests} data-testid="cust-notes"
              onChange={(e) => setCust({ ...cust, custom_requests: e.target.value })}
              hint="Write what this specific business asked for — kept against their licence only" />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function PlatformSettings() {
  const { data, loading, error, reload } = useFetch("/platform/summary");
  const logs = useFetch("/platform/errors");
  if (loading && !data) return <Loader label="Loading console…" />;
  if (error) return <ErrorState text={error} onRetry={reload} />;
  const t = data.totals;
  return (
    <div>
      <PageHead title="Platform console" subtitle="SaaS view — licences, health and requests. Not a transport office." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Businesses" value={t.licenses} />
        <Stat label="Active" value={t.active} tone="text-brand-600" />
        <Stat label="Suspended" value={t.suspended} />
        <Stat label="Expiring" value={t.expiring} tone={t.expiring ? "text-amber-600" : ""} />
      </div>
      <Card className="mb-4 overflow-hidden">
        <div className="border-b border-line px-4 py-3"><h3 className="font-head text-[15.5px] font-bold">Error log</h3>
          <p className="text-[12.5px] text-muted">Server failures only — for you as product owner, not tenants.</p></div>
        <DataTable testid="error-log"
          columns={[
            { key: "created_at", label: "When" },
            { key: "method", label: "Method" },
            { key: "path", label: "Path", strong: true },
            { key: "status", label: "Status" },
            { key: "detail", label: "Detail" },
          ]}
          rows={logs.data || []}
          empty={<EmptyState title="No server errors" text="When an API returns 500, it lands here." />} />
      </Card>
      <Card className="p-4">
        <h3 className="font-head text-[15.5px] font-bold">How licences work</h3>
        <p className="mt-2 text-[14px] text-muted">Open Licences to issue a business, suspend it, reset the owner password, or turn modules on/off. Extra asks go in Customise notes on that licence only.</p>
      </Card>
    </div>
  );
}
