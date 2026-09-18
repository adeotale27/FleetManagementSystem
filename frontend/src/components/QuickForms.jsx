import React, { useEffect, useMemo, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useFetch, useMaster, opts } from "../lib/hooks";
import { money, todayISO } from "../lib/format";
import { Autocomplete, Btn, Input, Modal, Money, Select, TextArea, toast } from "./ui";

const TITLES = {
  collection: ["Record Collection", "Money received from a party"],
  payment: ["Record Payment", "Money paid out of the business"],
  expense: ["Record Expense", "Day to day business expense"],
  fuel: ["Record Diesel", "Fuel filled in a vehicle"],
  handover: ["Deewanji Handover", "Cash handed over to office"],
  advance: ["Advance / Repayment", "Driver or team member"],
};

export default function EntryModal({ kind, open, onClose, onDone, preset = {} }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [partyText, setPartyText] = useState("");

  const settings = useFetch(open ? "/settings" : null);
  const vehicles = useMaster(open && (kind === "expense" || kind === "fuel") ? "vehicles" : null);
  const drivers = useMaster(open && (kind === "expense" || kind === "advance" || kind === "payment") ? "drivers" : null);
  const team = useMaster(open ? "team" : null);
  const pumps = useMaster(open && (kind === "fuel" || kind === "payment") ? "fuel_pumps" : null);
  const partners = useMaster(open && kind === "payment" ? "partners" : null);
  const lrs = useFetch(open && kind === "collection" && f.party_id ? "/lrs" : null,
    { party_id: f.party_id, limit: 50 });

  const modes = settings.data?.payment_modes || ["Cash", "UPI", "Bank", "Cheque", "Other"];
  const cats = settings.data?.expense_categories || ["Fuel", "Other"];
  const deewanjis = (team.data || []).filter(
    (t) => (t.role || "").toLowerCase() === "deewanji" || t.cash_with);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setPartyText(preset.party_name || "");
    setF({
      date: todayISO(),
      mode: kind === "fuel" ? "Credit" : "Cash",
      collected_by_type: "office",
      entity_type: kind === "advance" ? "driver" : "fuel_pump",
      kind: "Advance",
      category: kind === "expense" ? "Fuel" : undefined,
      ...preset,
    });
  }, [open, kind]); // eslint-disable-line

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const amount = useMemo(() => {
    if (kind !== "fuel") return f.amount;
    return Number(f.quantity || 0) * Number(f.rate || 0) || f.amount;
  }, [f, kind]);

  const submit = async () => {
    setBusy(true); setErr("");
    const paths = {
      collection: "/receipts", payment: "/payments", expense: "/expenses",
      fuel: "/fuel", handover: "/handovers", advance: "/advances",
    };
    try {
      const body = { ...f, amount: Number(amount || 0) };
      if (kind === "collection" && !body.party_id) {
        setErr("Please pick the party (start typing the name)"); setBusy(false); return;
      }
      if (kind === "payment" && body.entity_type === "vendor") body.entity_name = body.entity_name || "Vendor";
      await api.post(paths[kind], body);
      toast(`${TITLES[kind][0].replace("Record ", "")} saved`);
      onDone?.();
      onClose();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  const [title, sub] = TITLES[kind] || ["", ""];
  const pendingLrs = (lrs.data || []).filter((l) => l.outstanding > 0.5);

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={sub}
      footer={
        <>
          <Btn variant="s" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn data-testid="entry-save" onClick={submit} disabled={busy} className="flex-1">
            {busy ? "Saving…" : "Save"}
          </Btn>
        </>
      }>
      <div className="space-y-4">
        <Input label="Date" type="date" value={f.date || ""} onChange={set("date")} data-testid="entry-date" />

        {kind === "collection" && (
          <>
            <Autocomplete label="Party" required value={partyText} testid="entry-party"
              onChange={(v) => { setPartyText(v); setF((s) => ({ ...s, party_id: null, party_name: v })); }}
              onPick={(p) => { setPartyText(p.name); setF((s) => ({ ...s, party_id: p.id, party_name: p.name })); }}
              fetcher={async (q) => (await api.get("/parties/suggest", { params: { q } })).data}
              allowNew={false}
              hint={f.party_id ? "Party selected" : "Start typing and pick the party"}
              renderItem={(p) => (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14.5px] font-semibold text-ink">{p.name}</p>
                    <p className="text-[12.5px] text-muted">{p.mobile || "no mobile"} · {p.city || "—"}</p>
                  </div>
                  <span className="num text-[13px] font-semibold text-amber-600">{money(p.balance)}</span>
                </div>
              )} />
            {pendingLrs.length > 0 && (
              <Select label="Against LR (optional)" value={f.lr_id || ""}
                data-testid="entry-lr"
                onChange={(e) => {
                  const lr = pendingLrs.find((l) => l.id === e.target.value);
                  setF((s) => ({ ...s, lr_id: e.target.value, lr_no: lr?.lr_no, amount: lr?.outstanding || s.amount }));
                }}
                options={pendingLrs.map((l) => ({ value: l.id, label: `${l.lr_no} · ${money(l.outstanding)} pending` }))}
                placeholder="Not linked to an LR" />
            )}
            <Money label="Amount" value={f.amount || ""} onChange={set("amount")} data-testid="entry-amount" />
            <Select label="Payment Mode" value={f.mode} onChange={set("mode")} options={modes} data-testid="entry-mode" />
            <Select label="Collected By" value={f.collected_by_type} data-testid="entry-collected-by"
              onChange={set("collected_by_type")} placeholder="Office / Owner"
              options={[{ value: "office", label: "Office / Owner" }, { value: "deewanji", label: "Deewanji" }]} />
            {f.collected_by_type === "deewanji" && (
              <Select label="Deewanji" value={f.deewanji_id || ""} onChange={set("deewanji_id")}
                data-testid="entry-deewanji" options={opts(deewanjis.length ? deewanjis : team.data)} />
            )}
            <Input label="Reference (optional)" value={f.reference || ""} onChange={set("reference")} />
          </>
        )}

        {kind === "payment" && (
          <>
            <Select label="Paying To" value={f.entity_type} onChange={(e) => setF((s) => ({ ...s, entity_type: e.target.value, entity_id: "" }))}
              data-testid="entry-entity-type"
              options={[
                { value: "fuel_pump", label: "Fuel Pump" }, { value: "partner", label: "3PL Partner" },
                { value: "driver", label: "Driver" }, { value: "employee", label: "Team Member" },
                { value: "vendor", label: "Other Vendor" }]} />
            {f.entity_type === "vendor" ? (
              <Input label="Vendor Name" value={f.entity_name || ""} onChange={set("entity_name")} />
            ) : (
              <Select label="Name" required value={f.entity_id || ""} onChange={set("entity_id")}
                data-testid="entry-entity"
                options={opts({ fuel_pump: pumps.data, partner: partners.data, driver: drivers.data, employee: team.data }[f.entity_type])} />
            )}
            <Money label="Amount" value={f.amount || ""} onChange={set("amount")} data-testid="entry-amount" />
            <Select label="Payment Mode" value={f.mode} onChange={set("mode")} options={modes} />
            <Input label="Purpose" value={f.purpose || ""} onChange={set("purpose")} placeholder="Diesel bill, trip payment…" />
            <Input label="Reference (optional)" value={f.reference || ""} onChange={set("reference")} />
          </>
        )}

        {kind === "expense" && (
          <>
            <Select label="Category" required value={f.category || ""} onChange={set("category")}
              options={cats} data-testid="entry-category" />
            <Money label="Amount" value={f.amount || ""} onChange={set("amount")} data-testid="entry-amount" />
            <Select label="Vehicle (optional)" value={f.vehicle_id || ""} onChange={set("vehicle_id")}
              options={opts(vehicles.data, "vehicle_no")} data-testid="entry-vehicle" />
            {f.category === "Driver Advance" && (
              <Select label="Driver" value={f.driver_id || ""} onChange={set("driver_id")} options={opts(drivers.data)} />
            )}
            {f.category === "Employee Advance" && (
              <Select label="Team Member" value={f.employee_id || ""} onChange={set("employee_id")} options={opts(team.data)} />
            )}
            <Input label="Paid To / Vendor (optional)" value={f.vendor || ""} onChange={set("vendor")} />
            <Select label="Payment Mode" value={f.mode} onChange={set("mode")} options={modes} />
            <TextArea label="Remarks" value={f.remarks || ""} onChange={set("remarks")} />
          </>
        )}

        {kind === "fuel" && (
          <>
            <Select label="Vehicle" required value={f.vehicle_id || ""} onChange={set("vehicle_id")}
              options={opts(vehicles.data, "vehicle_no")} data-testid="entry-vehicle" />
            <Select label="Fuel Pump" value={f.pump_id || ""} onChange={set("pump_id")}
              options={opts(pumps.data)} data-testid="entry-pump"
              hint="Add pumps from Vehicles → Fuel Pumps" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Litres" type="number" step="0.01" value={f.quantity || ""} onChange={set("quantity")} data-testid="entry-qty" />
              <Money label="Rate / Litre" value={f.rate || ""} onChange={set("rate")} data-testid="entry-rate" />
            </div>
            <div className="rounded-lg bg-brand-50 px-3 py-2.5 text-[14px] font-semibold text-brand-600">
              Amount: <span className="num" data-testid="fuel-amount">{money(amount)}</span>
            </div>
            <Input label="Odometer (optional)" type="number" value={f.odometer || ""} onChange={set("odometer")} />
            <Select label="Payment" value={f.mode} onChange={set("mode")}
              options={["Credit", ...modes]} data-testid="entry-mode"
              hint="Credit keeps it pending in the fuel pump ledger" />
            <TextArea label="Remarks" value={f.remarks || ""} onChange={set("remarks")} />
          </>
        )}

        {kind === "handover" && (
          <>
            <Select label="Deewanji" required value={f.deewanji_id || ""} onChange={set("deewanji_id")}
              data-testid="entry-deewanji"
              options={(deewanjis.length ? deewanjis : team.data || []).map((d) => ({
                value: d.id, label: `${d.name}${d.cash_with ? ` · ${money(d.cash_with)} in hand` : ""}` }))} />
            <Money label="Amount" value={f.amount || ""} onChange={set("amount")} data-testid="entry-amount" />
            <Select label="Handed To" value={f.to || "Office"} onChange={set("to")}
              options={["Office", "Owner", "Bank"]} placeholder="Office" />
            <Select label="Mode" value={f.mode} onChange={set("mode")} options={modes} />
            <Input label="Reference (optional)" value={f.reference || ""} onChange={set("reference")} />
          </>
        )}

        {kind === "advance" && (
          <>
            <Select label="Person Type" value={f.entity_type} data-testid="entry-entity-type"
              onChange={(e) => setF((s) => ({ ...s, entity_type: e.target.value, entity_id: "" }))}
              options={[{ value: "driver", label: "Driver" }, { value: "employee", label: "Team Member" }]} />
            <Select label="Person" required value={f.entity_id || ""} onChange={set("entity_id")}
              data-testid="entry-entity"
              options={opts(f.entity_type === "driver" ? drivers.data : team.data)} />
            <Select label="Entry Type" value={f.kind} onChange={set("kind")} data-testid="entry-kind"
              options={["Advance", "Loan", "Pre-salary", "Repayment", "Deduction", "Salary Paid"]} />
            <Money label="Amount" value={f.amount || ""} onChange={set("amount")} data-testid="entry-amount" />
            <Select label="Mode" value={f.mode} onChange={set("mode")} options={modes} />
            <TextArea label="Remarks" value={f.remarks || ""} onChange={set("remarks")} />
          </>
        )}

        {err && <p data-testid="entry-error" className="rounded-lg bg-red-50 px-3 py-2.5 text-[13.5px] font-medium text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
