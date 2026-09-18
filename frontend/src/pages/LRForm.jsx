import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, FileText, Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useFetch } from "../lib/hooks";
import { money, todayISO } from "../lib/format";
import {
  Autocomplete, Btn, Card, Input, Money, PageHead, Select, TextArea, toast,
} from "../components/ui";

const emptyItem = () => ({ description: "", quantity: "", weight: "", rate: "", amount: "" });

export default function LRForm() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const tripId = sp.get("trip") || "";

  const [f, setF] = useState({
    trip_id: tripId, date: todayISO(), from_name: "", to_name: "", vehicle_no: "",
    driver_name: "", goods_description: "", articles: "", freight: "",
    freight_type: "NOT PAID", remarks: "", due_date: "",
  });
  const [sender, setSender] = useState({ name: "", mobile: "", city: "", party_id: null });
  const [receiver, setReceiver] = useState({ name: "", mobile: "", address: "", city: "", state: "", pincode: "" });
  const [items, setItems] = useState([emptyItem()]);
  const [optOpen, setOptOpen] = useState(false);
  const [optional, setOptional] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const trips = useFetch("/trips", { limit: 100 });
  const trip = useFetch(f.trip_id ? `/trips/${f.trip_id}` : null);

  useEffect(() => {
    const t = trip.data;
    if (!t) return;
    setF((s) => ({
      ...s, trip_id: t.id, date: s.date || t.start_date, from_name: t.from_name,
      to_name: t.to_name, vehicle_no: t.vehicle_no, driver_id: t.driver_id, driver_name: t.driver_name || "",
      freight: s.freight || (t.trip_amount ? String(t.trip_amount) : ""),
    }));
    if (t.party_name && !sender.name) setSender({ name: t.party_name, party_id: t.party_id, mobile: "", city: "" });
  }, [trip.data]); // eslint-disable-line

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const itemTotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.amount) || Number(i.quantity || 0) * Number(i.rate || 0)), 0),
    [items]);
  const freight = Number(f.freight || 0) || itemTotal;

  const setItem = (i, k, v) => setItems((s) => {
    const n = [...s];
    n[i] = { ...n[i], [k]: v };
    if (k === "quantity" || k === "rate") n[i].amount = (Number(n[i].quantity || 0) * Number(n[i].rate || 0)) || "";
    return n;
  });

  const save = async () => {
    if (!sender.name?.trim()) return setErr("Sender name is required");
    setBusy(true); setErr("");
    try {
      const body = {
        ...f, freight, sender, receiver, optional,
        items: items.filter((i) => i.description || i.quantity || i.amount),
        payment_status: f.freight_type === "PAID" ? "Paid" : "Pending",
      };
      const r = await api.post("/lrs", body);
      toast(`LR ${r.data.lr_no} created`);
      nav(`/lrs/${r.data.id}`);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead title="Create Lorry Receipt" back="/trips?tab=lrs"
        subtitle="Pick the trip and the details fill in automatically" />

      <Card className="mb-4 space-y-4 p-4">
        <Select label="From Trip (recommended)" value={f.trip_id} data-testid="lr-trip"
          onChange={(e) => setF((s) => ({ ...s, trip_id: e.target.value }))}
          options={(trips.data || []).map((t) => ({
            value: t.id, label: `${t.trip_no} · ${t.from_name} → ${t.to_name} · ${t.vehicle_no}` }))}
          placeholder="Not linked to a trip" />
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="LR Date" type="date" value={f.date} onChange={set("date")} data-testid="lr-date" />
          <Input label="Vehicle Number" value={f.vehicle_no} onChange={set("vehicle_no")} data-testid="lr-vehicle" />
          <Input label="From" value={f.from_name} onChange={set("from_name")} data-testid="lr-from" />
          <Input label="To" value={f.to_name} onChange={set("to_name")} data-testid="lr-to" />
          <Input label="Driver" value={f.driver_name} onChange={set("driver_name")} />
          <Input label="Payment Due Date (optional)" type="date" value={f.due_date} onChange={set("due_date")} />
        </div>
      </Card>

      <Card className="mb-4 space-y-4 p-4">
        <p className="lbl">Sender (party sending the goods)</p>
        <Autocomplete label="Sender Name" required value={sender.name} testid="lr-sender"
          onChange={(v) => setSender((s) => ({ ...s, name: v, party_id: null }))}
          onPick={(p) => setSender({ name: p.name, mobile: p.mobile || "", city: p.city || "", party_id: p.id })}
          fetcher={async (q) => (await api.get("/parties/suggest", { params: { q } })).data}
          hint={sender.party_id ? "Saved party selected" : "New name will be saved to your party list automatically"}
          renderItem={(p) => (
            <div className="flex justify-between gap-3">
              <div><p className="text-[14.5px] font-semibold">{p.name}</p>
                <p className="text-[12.5px] text-muted">{p.mobile || "no mobile"} · {p.city || "—"}</p></div>
              <span className="num text-[13px] text-amber-600">{money(p.balance)}</span>
            </div>
          )} />
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Sender Mobile" value={sender.mobile} data-testid="lr-sender-mobile"
            onChange={(e) => setSender({ ...sender, mobile: e.target.value })}
            hint="Used to tell apart parties with the same name" />
          <Input label="Sender City" value={sender.city} onChange={(e) => setSender({ ...sender, city: e.target.value })} />
        </div>
      </Card>

      <Card className="mb-4 space-y-4 p-4">
        <p className="lbl">Receiver (who will take delivery)</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Receiver Name" value={receiver.name} data-testid="lr-receiver"
            onChange={(e) => setReceiver({ ...receiver, name: e.target.value })} />
          <Input label="Mobile" value={receiver.mobile} onChange={(e) => setReceiver({ ...receiver, mobile: e.target.value })} />
          <Input label="Address" className="md:col-span-2" value={receiver.address}
            onChange={(e) => setReceiver({ ...receiver, address: e.target.value })} />
          <Input label="City" value={receiver.city} onChange={(e) => setReceiver({ ...receiver, city: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="State" value={receiver.state} onChange={(e) => setReceiver({ ...receiver, state: e.target.value })} />
            <Input label="Pincode" value={receiver.pincode} onChange={(e) => setReceiver({ ...receiver, pincode: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card className="mb-4 space-y-4 p-4">
        <p className="lbl">Goods</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Goods Description" value={f.goods_description} data-testid="lr-goods"
            onChange={set("goods_description")} placeholder="Rice bags, cement…" />
          <Input label="Articles" value={f.articles} onChange={set("articles")} placeholder="e.g. 120 bags" />
        </div>

        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Item {i + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => setItems(items.filter((_, x) => x !== i))} className="text-muted hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid gap-2.5 md:grid-cols-5">
                <Input label="Description" className="md:col-span-2" value={it.description}
                  data-testid={`item-desc-${i}`} onChange={(e) => setItem(i, "description", e.target.value)} />
                <Input label="Qty" type="number" value={it.quantity} data-testid={`item-qty-${i}`}
                  onChange={(e) => setItem(i, "quantity", e.target.value)} />
                <Input label="Weight (kg)" type="number" value={it.weight} onChange={(e) => setItem(i, "weight", e.target.value)} />
                <Input label="Rate" type="number" value={it.rate} data-testid={`item-rate-${i}`}
                  onChange={(e) => setItem(i, "rate", e.target.value)} />
              </div>
              <p className="mt-2 text-right text-[13.5px] font-semibold">Amount: <span className="num">{money(Number(it.amount) || 0)}</span></p>
            </div>
          ))}
          <Btn variant="s" icon={Plus} data-testid="add-item" onClick={() => setItems([...items, emptyItem()])}>Add Item</Btn>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Money label="Freight Amount" value={f.freight} onChange={set("freight")} data-testid="lr-freight"
            hint={itemTotal ? `Items total ${money(itemTotal)} — leave blank to use it` : ""} />
          <div>
            <p className="lbl">Freight Type</p>
            <div className="flex gap-2">
              {["PAID", "NOT PAID"].map((t) => (
                <button key={t} data-testid={`freight-${t.replace(" ", "-").toLowerCase()}`}
                  onClick={() => setF({ ...f, freight_type: t })}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-[14px] font-semibold ${
                    f.freight_type === t ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white"}`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              {f.freight_type === "PAID" ? "Freight already received — recorded as a collection." : "Kept as pending in the party ledger."}
            </p>
          </div>
        </div>
        <TextArea label="Remarks" value={f.remarks} onChange={set("remarks")} />
      </Card>

      <Card className="mb-4 overflow-hidden">
        <button onClick={() => setOptOpen((s) => !s)} data-testid="optional-toggle"
          className="flex w-full items-center justify-between px-4 py-3.5 text-left">
          <div>
            <p className="font-head text-[15px] font-bold">Optional Details</p>
            <p className="text-[12.5px] text-muted">Not needed — fill only if you want them printed</p>
          </div>
          <ChevronDown size={18} className={`text-muted transition-transform ${optOpen ? "rotate-180" : ""}`} />
        </button>
        {optOpen && (
          <div className="grid gap-3 border-t border-line p-4 md:grid-cols-2">
            {[["packaging", "Packaging Type"], ["hsn", "HSN Code"], ["invoice_no", "Bill / Invoice Number"],
              ["goods_value", "Total Value of Goods"], ["eway", "E-way Bill Number"]].map(([k, l]) => (
              <Input key={k} label={l} value={optional[k] || ""} onChange={(e) => setOptional({ ...optional, [k]: e.target.value })} />
            ))}
          </div>
        )}
      </Card>

      {err && <p data-testid="lr-error" className="mb-3 rounded-lg bg-red-50 px-3 py-2.5 text-[13.5px] font-medium text-red-600">{err}</p>}

      <div className="sticky bottom-20 z-20 flex gap-2 md:bottom-4">
        <Btn variant="s" className="flex-1" onClick={() => nav("/trips?tab=lrs")}>Cancel</Btn>
        <Btn icon={FileText} className="flex-[2]" data-testid="save-lr" disabled={busy} onClick={save}>
          {busy ? "Saving…" : `Create LR · ${money(freight)}`}
        </Btn>
      </div>
    </div>
  );
}
