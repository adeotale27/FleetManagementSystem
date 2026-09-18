import React, { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { Btn, Input, Modal, Money, Select, TextArea, toast } from "./ui";

const DOCS = [["rc", "RC"], ["insurance", "Insurance"], ["permit", "Permit"], ["fitness", "Fitness"], ["puc", "PUC"]];

export const SCHEMA = {
  vehicles: {
    title: "Vehicle", key: "vehicle_no",
    fields: [
      { k: "vehicle_no", l: "Vehicle Number", req: true, upper: true, ph: "MH 34 AB 1234" },
      { k: "vehicle_type", l: "Vehicle Type", type: "select", opts: ["Truck", "Tempo", "Trailer", "Pickup", "Tanker", "Other"] },
      { k: "make", l: "Make", ph: "Tata / Ashok Leyland" },
      { k: "model", l: "Model" },
      { k: "year", l: "Year", type: "number" },
      { k: "owner_name", l: "Owner" },
      { k: "capacity", l: "Capacity", ph: "9 Ton" },
      { k: "fuel_type", l: "Fuel Type", type: "select", opts: ["Diesel", "CNG", "Petrol", "Electric"] },
      { k: "base_location", l: "Base Location", type: "baseloc" },
      { k: "status", l: "Status", type: "select", opts: ["Available", "On Trip", "Maintenance", "Inactive"] },
    ],
  },
  drivers: {
    title: "Driver", key: "name",
    fields: [
      { k: "name", l: "Driver Name", req: true },
      { k: "mobile", l: "Mobile Number" },
      { k: "licence_no", l: "Licence Number" },
      { k: "licence_expiry", l: "Licence Expiry", type: "date" },
      { k: "joining_date", l: "Joining Date", type: "date" },
      { k: "address", l: "Address", type: "text" },
      { k: "status", l: "Status", type: "select", opts: ["Active", "On Trip", "Inactive"] },
      { k: "opening_balance", l: "Opening Advance (if any)", type: "money", onlyNew: true },
    ],
  },
  team: {
    title: "Team Member", key: "name",
    fields: [
      { k: "name", l: "Name", req: true },
      { k: "role", l: "Role", type: "select", opts: ["Manager", "Deewanji", "Office Staff", "Accountant", "Helper", "Other"] },
      { k: "mobile", l: "Mobile Number" },
      { k: "salary", l: "Monthly Salary", type: "money" },
      { k: "joining_date", l: "Joining Date", type: "date" },
      { k: "address", l: "Address", type: "text" },
      { k: "status", l: "Status", type: "select", opts: ["Active", "Inactive"] },
      { k: "opening_balance", l: "Opening Advance (if any)", type: "money", onlyNew: true },
    ],
  },
  parties: {
    title: "Party", key: "name",
    fields: [
      { k: "name", l: "Party Name", req: true },
      { k: "mobile", l: "Mobile Number", hint: "Helps separate parties with the same name" },
      { k: "city", l: "City" },
      { k: "state", l: "State" },
      { k: "address", l: "Address", type: "text" },
      { k: "pincode", l: "Pincode" },
      { k: "gstin", l: "GSTIN (optional)" },
      { k: "status", l: "Status", type: "select", opts: ["Active", "Inactive"] },
      { k: "opening_balance", l: "Opening Outstanding", type: "money", onlyNew: true },
    ],
  },
  fuel_pumps: {
    title: "Fuel Pump", key: "name",
    fields: [
      { k: "name", l: "Pump Name", req: true },
      { k: "location", l: "Location" },
      { k: "contact", l: "Contact" },
      { k: "status", l: "Status", type: "select", opts: ["Active", "Inactive"] },
      { k: "opening_balance", l: "Opening Outstanding (we owe)", type: "money", onlyNew: true, negative: true },
    ],
  },
  partners: {
    title: "3PL Partner", key: "name",
    fields: [
      { k: "name", l: "Company Name", req: true },
      { k: "contact_person", l: "Contact Person" },
      { k: "mobile", l: "Mobile" },
      { k: "city", l: "City" },
      { k: "address", l: "Address", type: "text" },
      { k: "gstin", l: "GSTIN (optional)" },
      { k: "status", l: "Status", type: "select", opts: ["Active", "Inactive"] },
    ],
  },
};

export default function MasterForm({ res, open, onClose, onDone, item }) {
  const sc = SCHEMA[res];
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const settings = useFetch(open && res === "vehicles" ? "/settings" : null);

  useEffect(() => { if (open) { setF(item ? { ...item } : {}); setErr(""); } }, [open, item]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setDoc = (d, k, v) => setF((s) => ({ ...s, documents: { ...(s.documents || {}), [d]: { ...((s.documents || {})[d] || {}), [k]: v } } }));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body = { ...f };
      if (body.opening_balance && SCHEMA[res].fields.find((x) => x.k === "opening_balance")?.negative)
        body.opening_balance = -Math.abs(Number(body.opening_balance));
      if (item) await api.put(`/masters/${res}/${item.id}`, body);
      else await api.post(`/masters/${res}`, body);
      toast(`${sc.title} ${item ? "updated" : "added"}`);
      onDone?.();
      onClose();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide={res === "vehicles"}
      title={`${item ? "Edit" : "Add"} ${sc.title}`}
      subtitle={item ? f[sc.key] : "Fill only what you know — you can edit later"}
      footer={
        <>
          <Btn variant="s" className="flex-1" onClick={onClose}>Cancel</Btn>
          <Btn className="flex-1" data-testid="master-save" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Btn>
        </>
      }>
      <div className="grid gap-3.5 md:grid-cols-2">
        {sc.fields.filter((x) => !(x.onlyNew && item)).map((x) => {
          const common = { label: x.l, hint: x.hint, required: x.req, "data-testid": `f-${x.k}` };
          if (x.type === "select") return <Select key={x.k} {...common} options={x.opts} value={f[x.k] || ""} onChange={(e) => set(x.k, e.target.value)} />;
          if (x.type === "money") return <Money key={x.k} {...common} value={f[x.k] ?? ""} onChange={(e) => set(x.k, e.target.value)} />;
          if (x.type === "text") return <TextArea key={x.k} {...common} className="md:col-span-2" value={f[x.k] || ""} onChange={(e) => set(x.k, e.target.value)} />;
          if (x.type === "baseloc") return (
            <Select key={x.k} {...common} value={f[x.k] || ""} onChange={(e) => set(x.k, e.target.value)}
              options={(settings.data?.base_locations || []).map((l) => ({ value: l.name, label: l.name }))} />
          );
          return <Input key={x.k} {...common} type={x.type || "text"} placeholder={x.ph} value={f[x.k] || ""}
            onChange={(e) => set(x.k, x.upper ? e.target.value.toUpperCase() : e.target.value)} />;
        })}
      </div>

      {res === "vehicles" && (
        <div className="mt-5">
          <p className="lbl">Documents & Expiry</p>
          <div className="space-y-2.5">
            {DOCS.map(([k, l]) => (
              <div key={k} className="grid grid-cols-[70px_1fr_1fr] items-center gap-2.5">
                <span className="text-[13px] font-semibold text-muted">{l}</span>
                <input className="fld py-2" placeholder="Number" data-testid={`doc-${k}-no`}
                  value={(f.documents?.[k]?.number) || ""} onChange={(e) => setDoc(k, "number", e.target.value)} />
                <input className="fld py-2" type="date" data-testid={`doc-${k}-expiry`}
                  value={(f.documents?.[k]?.expiry) || ""} onChange={(e) => setDoc(k, "expiry", e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <p data-testid="master-error" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13.5px] font-medium text-red-600">{err}</p>}
    </Modal>
  );
}
