import React, { useEffect, useState } from "react";
import { Building2, MapPin, Plus, Route, Save, Trash2, Truck, User, X } from "lucide-react";
import { api, errMsg, uploadFile } from "../lib/api";
import { useFetch, useMaster } from "../lib/hooks";
import MasterForm from "../components/MasterForm";
import {
  Badge, Btn, Card, DataTable, EmptyState, Input, Loader, Money, PageHead, Select, Tabs, TextArea, toast,
} from "../components/ui";

const rid = () => Math.random().toString(36).slice(2, 9);

export default function Settings() {
  const { data, loading, reload } = useFetch("/settings");
  const [tab, setTab] = useState("company");
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const partners = useMaster(tab === "partners" ? "partners" : null);

  useEffect(() => { if (data) setS(JSON.parse(JSON.stringify(data))); }, [data]);
  if (loading || !s) return <Loader />;

  const save = async (patch) => {
    setBusy(true);
    try {
      const body = patch || {
        company: s.company, base_locations: s.base_locations, routes: s.routes,
        expense_categories: s.expense_categories, payment_modes: s.payment_modes,
        lr: s.lr, trip: s.trip, receivable_due_days: Number(s.receivable_due_days || 30),
        opening_cash: Number(s.opening_cash || 0), opening_bank: Number(s.opening_bank || 0),
        opening_cash: Number(s.opening_cash || 0), opening_bank: Number(s.opening_bank || 0),
      };
      await api.put("/settings", body);
      toast("Settings saved");
      reload();
      window.dispatchEvent(new Event("fms:branding"));
    } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };

  const setC = (k) => (e) => setS({ ...s, company: { ...s.company, [k]: e.target.value } });
  const locName = (id) => s.base_locations.find((l) => l.id === id)?.name || "";

  const logoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast("Uploading logo…");
    try {
      const url = await uploadFile(file, "logo");
      const company = { ...s.company, logo: url };
      setS((prev) => ({ ...prev, company }));
      await api.put("/settings", { company });
      window.dispatchEvent(new Event("fms:branding"));
      toast("Business logo saved — it will print on LRs");
    } catch (er) { toast(errMsg(er), "err"); }
  };

  const photoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast("Uploading photo…");
    try {
      const url = await uploadFile(file, "owner-photo");
      const company = { ...s.company, owner_photo: url };
      setS((prev) => ({ ...prev, company }));
      await api.put("/settings", { company });
      window.dispatchEvent(new Event("fms:branding"));
      toast("Owner photo saved");
    } catch (er) { toast(errMsg(er), "err"); }
  };

  const SaveBar = (
    <div className="sticky bottom-20 z-20 mt-4 flex justify-end md:bottom-4">
      <Btn icon={Save} data-testid="settings-save" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : "Save Settings"}</Btn>
    </div>
  );

  return (
    <div>
      <PageHead title="Settings" subtitle="Company details, locations, routes and LR setup" />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "company", label: "Company & LR" },
        { value: "locations", label: "Base Locations" },
        { value: "routes", label: "Indoor Routes" },
        { value: "lists", label: "Categories & Modes" },
        { value: "partners", label: "3PL Partners" },
      ]} />

      {tab === "company" && (
        <>
          <Card className="mb-4 p-4">
            <div className="mb-4 flex items-center gap-2 text-brand-600"><Building2 size={18} />
              <h3 className="font-head text-[16px] font-bold text-ink">Company Details (printed on every LR)</h3></div>
            <div className="grid gap-3.5 md:grid-cols-2">
              <Input label="Company Name" value={s.company.name || ""} onChange={setC("name")} data-testid="set-company-name" />
              <Input label="Owner Name" value={s.company.owner_name || ""} onChange={setC("owner_name")} data-testid="set-owner-name" />
              <Input label="Mobile" value={s.company.mobile || ""} onChange={setC("mobile")} />
              <Input label="Alternate Mobile" value={s.company.alt_mobile || ""} onChange={setC("alt_mobile")} />
              <Input label="Email" value={s.company.email || ""} onChange={setC("email")} />
              <TextArea label="Address" className="md:col-span-2" value={s.company.address || ""} onChange={setC("address")} />
              <Input label="City" value={s.company.city || ""} onChange={setC("city")} />
              <Input label="State" value={s.company.state || ""} onChange={setC("state")} />
              <Input label="GSTIN (optional)" value={s.company.gstin || ""} onChange={setC("gstin")} />
              <Input label="PAN (optional)" value={s.company.pan || ""} onChange={setC("pan")} />
              <TextArea label="LR Terms" className="md:col-span-2" value={s.company.terms || ""} onChange={setC("terms")} />
              <Input label="LR Footer Line" className="md:col-span-2" value={s.company.footer || ""} onChange={setC("footer")} />
            </div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <p className="lbl">Business Logo (prints on every LR)</p>
                <div className="flex items-center gap-4">
                  {s.company.logo
                    ? <img src={s.company.logo} alt="logo" className="h-16 w-16 rounded-lg border border-line object-contain" />
                    : <div className="grid h-16 w-16 place-items-center rounded-lg bg-brand-500 text-white"><Truck size={26} /></div>}
                  <div>
                    <input type="file" accept="image/*" onChange={logoUpload} data-testid="set-logo"
                      className="text-[13px] file:mr-3 file:rounded-2xl file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:font-semibold file:text-white" />
                    {s.company.logo && (
                      <button onClick={() => setS({ ...s, company: { ...s.company, logo: "" } })}
                        className="mt-2 block text-[12.5px] font-semibold text-red-600">Remove logo</button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <p className="lbl">Owner Photo</p>
                <div className="flex items-center gap-4">
                  {s.company.owner_photo
                    ? <img src={s.company.owner_photo} alt="owner" className="h-16 w-16 rounded-full border border-line object-cover" />
                    : <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
                        <User size={26} /></div>}
                  <div>
                    <input type="file" accept="image/*" capture="environment" onChange={photoUpload} data-testid="set-owner-photo"
                      className="text-[13px] file:mr-3 file:rounded-2xl file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:font-semibold file:text-white" />
                    {s.company.owner_photo && (
                      <button onClick={() => setS({ ...s, company: { ...s.company, owner_photo: "" } })}
                        className="mt-2 block text-[12.5px] font-semibold text-red-600">Remove photo</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <h3 className="mb-4 font-head text-[16px] font-bold">Numbering & Due Days</h3>
            <div className="grid gap-3.5 md:grid-cols-4">
              <Input label="LR Prefix" value={s.lr.prefix} onChange={(e) => setS({ ...s, lr: { ...s.lr, prefix: e.target.value.toUpperCase() } })} data-testid="set-lr-prefix" />
              <Input label="Next LR Number" type="number" value={s.lr.next} onChange={(e) => setS({ ...s, lr: { ...s.lr, next: Number(e.target.value) } })} />
              <Input label="Trip Prefix" value={s.trip.prefix} onChange={(e) => setS({ ...s, trip: { ...s.trip, prefix: e.target.value.toUpperCase() } })} />
              <Input label="Payment Due Days" type="number" value={s.receivable_due_days}
                onChange={(e) => setS({ ...s, receivable_due_days: e.target.value })}
                hint="Used for overdue and aging" />
            </div>
            <h3 className="mb-3 mt-6 font-head text-[16px] font-bold">Opening Balances</h3>
            <div className="grid gap-3.5 md:grid-cols-2">
              <Money label="Opening Cash in Hand" value={s.opening_cash ?? ""} data-testid="set-opening-cash"
                onChange={(e) => setS({ ...s, opening_cash: e.target.value })}
                hint="Cash you already had before using this app" />
              <Money label="Opening Bank Balance" value={s.opening_bank ?? ""} data-testid="set-opening-bank"
                onChange={(e) => setS({ ...s, opening_bank: e.target.value })} />
            </div>
            <p className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-muted">
              Next LR will be <b className="text-ink">{s.lr.prefix}{String(s.lr.next).padStart(s.lr.pad || 4, "0")}</b> ·
              Next Trip will be <b className="text-ink">{s.trip.prefix}{String(s.trip.next).padStart(s.trip.pad || 4, "0")}</b>
            </p>
          </Card>
          {SaveBar}
        </>
      )}

      {tab === "locations" && (
        <>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-600"><MapPin size={18} />
                <h3 className="font-head text-[16px] font-bold text-ink">Base Locations</h3></div>
              <Btn icon={Plus} data-testid="add-location"
                onClick={() => setS({ ...s, base_locations: [...s.base_locations, { id: `loc_${rid()}`, name: "", address: "", city: "", state: "", active: true }] })}>
                Add Location
              </Btn>
            </div>
            <p className="mb-3 text-[13px] text-muted">Used for indoor trips. Changing an address here updates future trips.</p>
            <div className="space-y-3">
              {s.base_locations.map((l, i) => (
                <div key={l.id} className="grid gap-2.5 rounded-xl border border-line p-3 md:grid-cols-[1fr_2fr_1fr_auto]">
                  <Input label="Name" value={l.name} data-testid={`loc-name-${i}`}
                    onChange={(e) => { const n = [...s.base_locations]; n[i] = { ...l, name: e.target.value }; setS({ ...s, base_locations: n }); }} />
                  <Input label="Address" value={l.address || ""}
                    onChange={(e) => { const n = [...s.base_locations]; n[i] = { ...l, address: e.target.value }; setS({ ...s, base_locations: n }); }} />
                  <Input label="City" value={l.city || ""}
                    onChange={(e) => { const n = [...s.base_locations]; n[i] = { ...l, city: e.target.value }; setS({ ...s, base_locations: n }); }} />
                  <button className="mb-1 self-end rounded-lg p-2.5 text-muted hover:bg-red-50 hover:text-red-600"
                    onClick={() => setS({ ...s, base_locations: s.base_locations.filter((x) => x.id !== l.id) })}>
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              {s.base_locations.length === 0 && <EmptyState title="No base locations" text="Add Hinganghat, Nagpur, Wadi…" />}
            </div>
          </Card>
          {SaveBar}
        </>
      )}

      {tab === "routes" && (
        <>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-600"><Route size={18} />
                <h3 className="font-head text-[16px] font-bold text-ink">Indoor Routes</h3></div>
              <Btn icon={Plus} data-testid="add-route"
                onClick={() => setS({ ...s, routes: [...s.routes, { id: `rt_${rid()}`, from_id: "", to_id: "", name: "", default_amount: 0, active: true }] })}>
                Add Route
              </Btn>
            </div>
            <div className="space-y-3">
              {s.routes.map((r, i) => {
                const upd = (patch) => {
                  const n = [...s.routes];
                  const merged = { ...r, ...patch };
                  merged.name = `${locName(merged.from_id)} > ${locName(merged.to_id)}`;
                  n[i] = merged;
                  setS({ ...s, routes: n });
                };
                return (
                  <div key={r.id} className="grid gap-2.5 rounded-xl border border-line p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <Select label="From" value={r.from_id} data-testid={`route-from-${i}`}
                      options={s.base_locations.map((l) => ({ value: l.id, label: l.name }))}
                      onChange={(e) => upd({ from_id: e.target.value })} />
                    <Select label="To" value={r.to_id} data-testid={`route-to-${i}`}
                      options={s.base_locations.map((l) => ({ value: l.id, label: l.name }))}
                      onChange={(e) => upd({ to_id: e.target.value })} />
                    <Money label="Default Amount (optional)" value={r.default_amount || ""}
                      onChange={(e) => upd({ default_amount: Number(e.target.value || 0) })} />
                    <button className="mb-1 self-end rounded-lg p-2.5 text-muted hover:bg-red-50 hover:text-red-600"
                      onClick={() => setS({ ...s, routes: s.routes.filter((x) => x.id !== r.id) })}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
              {s.routes.length === 0 && <EmptyState title="No routes" text="Add Hinganghat → Nagpur and more." />}
            </div>
          </Card>
          {SaveBar}
        </>
      )}

      {tab === "lists" && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <ChipCard title="Expense Categories" items={s.expense_categories} testid="cat"
              onChange={(v) => setS({ ...s, expense_categories: v })} />
            <ChipCard title="Payment Modes" items={s.payment_modes} testid="mode"
              onChange={(v) => setS({ ...s, payment_modes: v })} />
          </div>
          {SaveBar}
        </>
      )}

      {tab === "partners" && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="font-head text-[16px] font-bold">3PL Partners</h3>
            <Btn icon={Plus} data-testid="add-partner" onClick={() => setForm({ res: "partners" })}>Add Partner</Btn>
          </div>
          <DataTable testid="partners-table"
            columns={[
              { key: "name", label: "Company", strong: true },
              { key: "contact_person", label: "Contact Person" },
              { key: "mobile", label: "Mobile" },
              { key: "city", label: "City" },
              { key: "balance", label: "We Owe", right: true, render: (r) => <span className="num">₹{Math.max(-(r.balance || 0), 0).toLocaleString("en-IN")}</span> },
              { key: "status", label: "Status", type: "badge" },
            ]}
            rows={partners.data || []} onRowClick={(r) => setForm({ res: "partners", item: r })}
            empty={<EmptyState title="No partners" text="Add companies you give trips to."
              action={<Btn onClick={() => setForm({ res: "partners" })}>Add Partner</Btn>} />} />
        </Card>
      )}

      {form && <MasterForm res={form.res} item={form.item} open onClose={() => setForm(null)} onDone={partners.reload} />}
    </div>
  );
}

function ChipCard({ title, items, onChange, testid }) {
  const [val, setVal] = useState("");
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-head text-[16px] font-bold">{title}</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[13px] font-medium">
            {it}
            <button onClick={() => onChange(items.filter((x) => x !== it))} className="text-muted hover:text-red-600"><X size={13} /></button>
          </span>
        ))}
        {items.length === 0 && <span className="text-[13px] text-muted">None yet</span>}
      </div>
      <div className="flex gap-2">
        <input className="fld" value={val} data-testid={`${testid}-input`} placeholder="Add new…"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onChange([...items, val.trim()]); setVal(""); } }} />
        <Btn variant="s" data-testid={`${testid}-add`}
          onClick={() => { if (val.trim()) { onChange([...items, val.trim()]); setVal(""); } }}>Add</Btn>
      </div>
    </Card>
  );
}
