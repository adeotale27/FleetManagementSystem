import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, Check, ChevronRight, Download, FileText, Plus, Printer, Truck, X } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { Btn, Card, ErrorState, Loader, PageHead } from "../components/ui";
import { todayISO } from "../lib/format";
import BookingAudit from "./BookingAudit";
import BookingFinance from "./BookingFinance";

const field = "fld w-full";
const blankGoods = () => Array.from({ length: 5 }, () => ({
  type: "", type_hindi: "", description: "", quantity: "",
}));
const keyForRequest = () => window.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isHindi = (value) => /[\u0900-\u097f]/.test(value || "");
const commonGoodsHindi = {
  cement: "सीमेंट", "food grains": "खाद्यान्न", rice: "चावल", wheat: "गेहूँ",
  flour: "आटा", sugar: "चीनी", salt: "नमक", steel: "लोहा", iron: "लोहा",
  bricks: "ईंट", brick: "ईंट", sand: "रेत", stone: "पत्थर", wood: "लकड़ी",
  fertilizer: "खाद", clothes: "कपड़े", cloth: "कपड़ा", oil: "तेल", vegetables: "सब्ज़ियाँ",
  fruits: "फल", "general goods": "सामान", "building material": "निर्माण सामग्री",
  car: "कार", cars: "कारें", hardware: "हार्डवेयर", part: "पार्ट", parts: "पार्ट्स",
  "car part": "कार का पुर्जा", "car parts": "कार के पुर्ज़े", "spare parts": "स्पेयर पार्ट्स",
  bag: "बोरा", bags: "बोरे", box: "बॉक्स", boxes: "बॉक्स", drum: "ड्रम",
  carton: "कार्टन", parcel: "पार्सल", grain: "अनाज", grains: "अनाज",
  machine: "मशीन", machinery: "मशीनरी", tools: "औज़ार", pipe: "पाइप", rod: "छड़",
  plastic: "प्लास्टिक", paper: "कागज़", potato: "आलू",
  mango: "आम", onion: "प्याज़", medicine: "दवाई", water: "पानी",
};
export const romanHindi = (source) => {
  const input = source.trim();
  if (!input || isHindi(input)) return input;
  if (commonGoodsHindi[input.toLowerCase()]) return commonGoodsHindi[input.toLowerCase()];
  const consonants = [
    ["ksh", "क्ष"], ["chh", "छ"], ["sh", "श"], ["ch", "च"], ["kh", "ख"], ["gh", "घ"],
    ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["jh", "झ"], ["ng", "ङ"],
    ["ny", "ञ"], ["q", "क़"], ["k", "क"], ["g", "ग"], ["c", "क"], ["j", "ज"],
    ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["b", "ब"], ["m", "म"],
    ["y", "य"], ["r", "र"], ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"],
    ["h", "ह"], ["f", "फ़"], ["z", "ज़"],
  ];
  const vowels = [["aa", "ा"], ["ee", "ी"], ["ii", "ी"], ["oo", "ू"], ["uu", "ू"],
    ["ai", "ै"], ["au", "ौ"], ["a", ""], ["i", "ि"], ["u", "ु"],
    ["e", "े"], ["o", "ो"]];
  return input.split(/(\s+|[-/])/).map((part) => {
    if (!part || /^\s+$|[-/]/.test(part)) return part;
    const lower = part.toLowerCase();
    if (commonGoodsHindi[lower]) return commonGoodsHindi[lower];
    let output = "";
    let index = 0;
    let pendingConsonant = false;
    while (index < lower.length) {
      const vowel = vowels.find(([roman]) => lower.startsWith(roman, index));
      if (vowel) {
        if (pendingConsonant) {
          output += vowel[1];
          pendingConsonant = false;
        } else {
          output += vowel[1] ? ({ "ा": "आ", "ी": "ई", "ू": "ऊ", "ै": "ऐ", "ौ": "औ",
            "ि": "इ", "ु": "उ", "े": "ए", "ो": "ओ" })[vowel[1]] : "अ";
        }
        index += vowel[0].length;
        continue;
      }
      const consonant = consonants.find(([roman]) => lower.startsWith(roman, index));
      if (consonant) {
        if (pendingConsonant) output += "्";
        output += consonant[1];
        pendingConsonant = true;
        index += consonant[0].length;
      } else {
        if (pendingConsonant) output += "्";
        output += part[index];
        pendingConsonant = false;
        index += 1;
      }
    }
    return output;
  }).join("");
};

function money(value) {
  return `₹${(Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function amountInput(value) {
  if (value == null || value === "") return "";
  return String(value).replace(/(?:\.0+|(\.\d*?)0+)$/, "$1");
}

function receiptCreatedTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZoneName: "short",
  }).format(date);
}

function getGoodsRows(receipt) {
  const rows = receipt.goods_rows || receipt.containers || [];
  return rows.map((line) => ({
    type: line.type || "",
    type_hindi: line.type_hindi || line.type || "",
    description: line.description || "",
    quantity: line.quantity ?? "",
  }));
}

function stripGoodsCharges(line) {
  const goodsLine = { ...line };
  delete goodsLine.rent;
  delete goodsLine.hamali;
  return goodsLine;
}

function printGoods(receipt) {
  const lines = getGoodsRows(receipt).filter((line) => line.type && Number(line.quantity) > 0);
  return lines.length ? lines : [{ type_hindi: receipt.goods_type_hindi || receipt.goods_type, quantity: receipt.total_quantity }];
}

function HindiInput({ label, value, hindi, onChange, onHindiChange, onGenerateHindi, required = false, inputMode = "text" }) {
  return (
    <div>
      <label className="lbl">{label}{required ? " *" : ""}</label>
      <input className={field} required={required} value={value}
        onChange={(event) => onChange(event.target.value)} inputMode={inputMode} placeholder="Type name" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="text-sm font-semibold text-brand-700">Hindi / हिंदी (print text)</label>
        <button type="button" className="text-xs font-semibold text-brand-700" onClick={onGenerateHindi}>
          Make Hindi / हिंदी बनाएं
        </button>
      </div>
      <input className={`${field} font-semibold`} value={hindi}
        onChange={(event) => onHindiChange(event.target.value)}
        lang="hi" dir="auto" aria-label={`${label} Hindi`} />
    </div>
  );
}

function ReceiptPrint({ receipt, trip, site, branding, showCharges, active }) {
  if (!receipt) return null;
  const rows = printGoods(receipt);
  const companyName = branding?.name || site?.name || "Garage";
  const companyAddress = [branding?.address, branding?.city, branding?.state].filter(Boolean).join(", ");
  const contacts = [branding?.mobile, branding?.alt_mobile].filter(Boolean).join(" · ");
  const city = receipt.city || site?.city || "";
  return (
    <article className="booking-print-target" data-active={active ? "true" : "false"} lang="hi">
      <div className="receipt-print-header">
        {branding?.logo && <img src={branding.logo} alt="" className="receipt-print-logo" />}
        <div className="receipt-print-contact">{contacts && <span>संपर्क: {contacts}</span>}</div>
        <div className="receipt-print-company">
          <h1>{companyName}</h1>
          <p>माल रसीद</p>
          {companyAddress && <span>{companyAddress}</span>}
        </div>
      </div>
      <div className="receipt-print-meta">
        <strong>रसीद नंबर: {receipt.lr_ref}</strong>
        <span>दिनांक: {receipt.receipt_date || receipt.operating_date || trip?.operating_date}</span>
        {receiptCreatedTime(receipt.receipt_created_at || receipt.created_at) &&
          <span>समय: {receiptCreatedTime(receipt.receipt_created_at || receipt.created_at)}</span>}
        {city && <span>शहर: {city}</span>}
      </div>
      <section className="receipt-print-parties">
        {(receipt.sender_name_hindi || receipt.sender_name || receipt.sender_address) && <div>
          <strong>भेजने वाला:</strong>
          {receipt.sender_name_hindi || receipt.sender_name}
          {receipt.sender_address && <span>{receipt.sender_address}</span>}
        </div>}
        {(receipt.receiver_name_hindi || receipt.receiver_name || receipt.receiver_address) && <div>
          <strong>प्राप्त करने वाला:</strong>
          {receipt.receiver_name_hindi || receipt.receiver_name}
          {receipt.receiver_address && <span>{receipt.receiver_address}</span>}
        </div>}
      </section>
      <table className="receipt-print-goods">
        <thead><tr><th>मात्रा</th><th>माल का विवरण</th></tr></thead>
        <tbody>{rows.map((line, index) => <tr key={`${line.type_hindi}-${index}`}>
          <td>{line.quantity}</td>
          <td>{line.type_hindi || line.type}{line.description && <span className="receipt-print-description">{line.description}</span>}</td>
        </tr>)}</tbody>
      </table>
      {showCharges ? <table className="receipt-print-charges">
        <tbody>
          <tr><th>भाड़ा (Bhada)</th><td>{money(receipt.rent)}</td></tr>
          <tr><th>हमाली (Hamali)</th><td>{money(receipt.hamali)}</td></tr>
          <tr className="receipt-print-total-row"><th>कुल किराया</th>
            <td>{money(receipt.total_rent ?? Number(receipt.rent || 0) + Number(receipt.hamali || 0))}</td></tr>
        </tbody>
      </table> : receipt.total_rent != null &&
        <p className="receipt-print-total">कुल किराया: {money(receipt.total_rent)}</p>}
      {branding?.footer && <p className="receipt-print-footer">{branding.footer}</p>}
    </article>
  );
}

function ReceiptForm({ trip, receipt, canEditFinance, owner, addressSuggestions, onCancel, onSaved }) {
  const [form, setForm] = useState(() => receipt ? {
    receipt_date: receipt.receipt_date || receipt.operating_date || trip.operating_date,
    sender_name: receipt.sender_name || "", sender_name_hindi: receipt.sender_name_hindi || "",
    sender_address: receipt.sender_address || "", city: receipt.city || "",
    receiver_name: receipt.receiver_name || "", receiver_name_hindi: receipt.receiver_name_hindi || "",
    receiver_address: receipt.receiver_address || "", receiver_phone: receipt.receiver_phone || "",
    goods_rows: [...getGoodsRows(receipt), ...Array.from({ length: Math.max(0, 5 - getGoodsRows(receipt).length) }, () => ({
      type: "", type_hindi: "", description: "", quantity: "",
    }))],
    rent: receipt.rent ?? "0", hamali: receipt.hamali ?? "0",
  } : {
    receipt_date: trip.operating_date, sender_name: "", sender_name_hindi: "", sender_address: "", city: "",
    receiver_name: "", receiver_name_hindi: "", receiver_address: "",
    receiver_phone: "", goods_rows: blankGoods(), rent: "0", hamali: "0",
  });
  const [manualHindi, setManualHindi] = useState({
    sender: Boolean(receipt?.sender_name_hindi),
    receiver: Boolean(receipt?.receiver_name_hindi),
  });
  const [error, setError] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [receiverMatch, setReceiverMatch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveKey] = useState(keyForRequest);
  const senderTimer = useRef(null);
  const receiverTimer = useRef(null);
  const goodsTimers = useRef({});
  const manualGoodsHindi = useRef(new Set());

  useEffect(() => {
    senderTimer.current = window.setTimeout(() => {
      if (!manualHindi.sender) {
        setForm((current) => ({ ...current, sender_name_hindi: romanHindi(current.sender_name) }));
      }
    }, 450);
    return () => window.clearTimeout(senderTimer.current);
  }, [form.sender_name, manualHindi.sender]);
  useEffect(() => {
    receiverTimer.current = window.setTimeout(() => {
      if (!manualHindi.receiver) {
        setForm((current) => ({ ...current, receiver_name_hindi: romanHindi(current.receiver_name) }));
      }
    }, 450);
    return () => window.clearTimeout(receiverTimer.current);
  }, [form.receiver_name, manualHindi.receiver]);

  const patch = (values) => setForm((current) => ({ ...current, ...values }));
  const changeGoods = (index, key, value) => {
    setForm((current) => ({ ...current, goods_rows: current.goods_rows.map((line, row) =>
      row === index ? { ...line, [key]: value } : line) }));
  };
  const changeGoodsType = (index, value) => {
    changeGoods(index, "type", value);
    manualGoodsHindi.current.delete(index);
    window.clearTimeout(goodsTimers.current[index]);
    goodsTimers.current[index] = window.setTimeout(() => {
      if (!manualGoodsHindi.current.has(index)) {
        changeGoods(index, "type_hindi", romanHindi(value));
      }
    }, 450);
  };
  const changeGoodsHindi = (index, value) => {
    manualGoodsHindi.current.add(index);
    window.clearTimeout(goodsTimers.current[index]);
    changeGoods(index, "type_hindi", value);
  };
  const save = async (event, printAfter = false, matchChoice = null) => {
    event?.preventDefault();
    setError("");
    const goods = form.goods_rows.filter((line) => line.type.trim() && Number(line.quantity) > 0);
    if (!form.receiver_name.trim() || !goods.length) {
      setError("Enter the receiver and at least one goods row.");
      return;
    }
    if (goods.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0)) {
      setError("Goods quantity must be a whole number greater than zero.");
      return;
    }
    setSaving(true);
    const body = {
      receipt_date: form.receipt_date,
      sender_name: form.sender_name.trim(),
      sender_name_hindi: form.sender_name_hindi.trim() || romanHindi(form.sender_name),
      sender_address: form.sender_address.trim(), city: form.city.trim(),
      receiver_name: form.receiver_name.trim(),
      receiver_name_hindi: form.receiver_name_hindi.trim() || romanHindi(form.receiver_name),
      receiver_address: form.receiver_address.trim(), receiver_phone: form.receiver_phone.trim(),
      goods_rows: goods.map((line) => ({
        type: line.type.trim(), type_hindi: line.type_hindi.trim() || romanHindi(line.type),
        description: line.description.trim(), quantity: Number(line.quantity),
      })),
      ...(canEditFinance ? {
        rent: form.rent === "" ? "0" : form.rent || "0",
        hamali: form.hamali === "" ? "0" : form.hamali || "0",
      } : {}),
      ...(owner && correctionReason.trim() ? { owner_correction_reason: correctionReason.trim() } : {}),
      ...(matchChoice ? {
        receiver_match_action: matchChoice.action,
        ...(matchChoice.identityId ? { receiver_identity_id: matchChoice.identityId } : {}),
      } : {}),
    };
    try {
      const response = receipt
        ? await api.patch(`/sites/${trip.site_id}/trips/${trip.id}/lrs/${receipt.id}`, {
          ...body, ...(!canEditFinance ? { rent: undefined, hamali: undefined } : {}),
          expected_updated_at: receipt.updated_at,
          ...(canEditFinance ? { idempotency_key: keyForRequest() } : {}),
        })
        : await api.post(`/sites/${trip.site_id}/trips/${trip.id}/lrs`, {
          ...body, idempotency_key: saveKey,
        });
      setReceiverMatch(null);
      await onSaved(response.data, printAfter);
    } catch (requestError) {
      const detail = requestError?.response?.data?.detail;
      if (detail?.code === "receiver_match_confirmation_required") {
        setReceiverMatch(detail);
        setError(detail.message || "Choose whether this is the same receiver or a different receiver.");
      } else {
        setError(errMsg(requestError));
      }
    } finally {
      setSaving(false);
    }
  };
  const rentTotal = Number(form.rent) || 0;
  const hamaliTotal = Number(form.hamali) || 0;
  const total = rentTotal + hamaliTotal;

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">{receipt ? "Edit receipt" : "New receipt"}</h2>
          <p className="mt-1 text-sm text-muted">Trip {trip.trip_ref} · {trip.operating_date}</p></div>
        <button type="button" onClick={onCancel} aria-label="Close receipt form" className="rounded-lg p-2 hover:bg-canvas"><X size={20} /></button>
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</div>}
      {receiverMatch && <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h3 className="font-bold">Check the receiver before saving</h3>
        <p className="mt-1 text-sm">{receiverMatch.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(receiverMatch.matches || []).map((match) => <button key={match.id} type="button" className="btn-s"
            disabled={saving} onClick={() => save(null, false, { action: "same", identityId: match.id })}>
            Same receiver: {match.label || match.name}
          </button>)}
          <button type="button" className="btn-s" disabled={saving}
            onClick={() => save(null, false, { action: "different" })}>
            Different receiver
          </button>
        </div>
      </section>}
      <form onSubmit={(event) => save(event)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="lbl">Receipt date</span><input className={field} type="date" required
            value={form.receipt_date} onChange={(event) => patch({ receipt_date: event.target.value })} /></label>
          <div className="rounded-lg bg-canvas px-3 py-3 text-sm"><span className="lbl">Trip number</span><strong>{trip.trip_ref}</strong></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <HindiInput label="Sender / भेजने वाला" value={form.sender_name} hindi={form.sender_name_hindi}
            onChange={(value) => { patch({ sender_name: value }); setManualHindi((current) => ({ ...current, sender: false })); }}
            onHindiChange={(value) => { patch({ sender_name_hindi: value }); setManualHindi((current) => ({ ...current, sender: true })); }}
            onGenerateHindi={() => { patch({ sender_name_hindi: romanHindi(form.sender_name) }); setManualHindi((current) => ({ ...current, sender: true })); }} />
          <HindiInput label="Receiver / पाने वाला" value={form.receiver_name} hindi={form.receiver_name_hindi}
            required onChange={(value) => { patch({ receiver_name: value }); setManualHindi((current) => ({ ...current, receiver: false })); }}
            onHindiChange={(value) => { patch({ receiver_name_hindi: value }); setManualHindi((current) => ({ ...current, receiver: true })); }}
            onGenerateHindi={() => { patch({ receiver_name_hindi: romanHindi(form.receiver_name) }); setManualHindi((current) => ({ ...current, receiver: true })); }} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label><span className="lbl">Sender address (optional)</span><input className={field} list="sender-address-options"
            value={form.sender_address} onChange={(event) => patch({ sender_address: event.target.value })} />
            <datalist id="sender-address-options">{addressSuggestions.sender.map((address) =>
              <option key={address} value={address} />)}</datalist></label>
          <label><span className="lbl">Receiver address (optional)</span><input className={field} list="receiver-address-options"
            value={form.receiver_address} onChange={(event) => patch({ receiver_address: event.target.value })} />
            <datalist id="receiver-address-options">{addressSuggestions.receiver.map((address) =>
              <option key={address} value={address} />)}</datalist></label>
          <label><span className="lbl">City (optional)</span><input className={field} maxLength={100} value={form.city}
            placeholder="City" onChange={(event) => patch({ city: event.target.value })} /></label>
          <label><span className="lbl">Receiver phone (10 digits, optional)</span><input className={field} type="tel"
            inputMode="numeric" maxLength={10} pattern="[0-9]{10}" value={form.receiver_phone}
            aria-label="Receiver phone (10 digits, optional)"
            onChange={(event) => patch({ receiver_phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} /></label>
        </div>
        {owner && receipt && <label className="block">
          <span className="lbl">Owner correction reason (needed for posted/closed receipts)</span>
          <input className={field} maxLength={500} value={correctionReason}
            placeholder="Example: receiver name was entered incorrectly"
            onChange={(event) => setCorrectionReason(event.target.value)} />
        </label>}
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">Goods / सामान</h3>
            <button type="button" className="btn-s" onClick={() => patch({ goods_rows: [...form.goods_rows, {
              type: "", type_hindi: "", description: "", quantity: "",
            }] })}>
              <Plus size={17} /> Add row
            </button>
          </div>
          <div className="space-y-2">
            {form.goods_rows.map((line, index) => <div key={index}
              className="grid grid-cols-[2rem_minmax(0,1fr)_4rem_2.25rem] items-start gap-2 rounded-xl border border-line p-2">
              <span className="pt-3 text-center font-semibold">{index + 1}</span>
              <div>
                <input className={field} list="booking-goods-suggestions" value={line.type} placeholder="Goods type"
                  aria-label={`Goods type row ${index + 1}`} onChange={(event) => {
                    const value = event.target.value;
                    changeGoodsType(index, value);
                  }} />
                <input className={`${field} mt-1 font-semibold`} lang="hi" dir="auto" placeholder="हिंदी में छपाई"
                  aria-label={`Goods type Hindi row ${index + 1}`} value={line.type_hindi}
                  onChange={(event) => changeGoodsHindi(index, event.target.value)} />
                <button type="button" className="mt-1 text-left text-xs font-semibold text-brand-700"
                  onClick={() => changeGoodsHindi(index, romanHindi(line.type))}>Make Hindi / हिंदी बनाएं</button>
                <input className={`${field} mt-1`} maxLength={500} value={line.description} placeholder="Description of goods (optional)"
                  aria-label={`Goods description row ${index + 1}`}
                  onChange={(event) => changeGoods(index, "description", event.target.value)} />
              </div>
              <input className={field} type="number" min="1" step="1" inputMode="numeric" placeholder="Qty"
                aria-label={`Quantity row ${index + 1}`} value={line.quantity}
                onChange={(event) => changeGoods(index, "quantity", event.target.value)} />
              <button type="button" aria-label={`Clear goods row ${index + 1}`} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-700 lg:order-last"
                onClick={() => {
                  setForm((current) => ({ ...current, goods_rows: current.goods_rows.map((row, rowIndex) =>
                    rowIndex === index ? { type: "", type_hindi: "", description: "", quantity: "" } : row) }));
                  manualGoodsHindi.current.delete(index);
                  window.clearTimeout(goodsTimers.current[index]);
                }}>
                <X size={18} />
              </button>
            </div>)}
          </div>
          <datalist id="booking-goods-suggestions">
            {["General Goods", "Food Grains", "Cement", "Steel", "Fertilizer", "Rice", "Wheat", "Bricks"].map((value) => <option key={value} value={value} />)}
          </datalist>
        </section>
        {canEditFinance && <section className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
          <label><span className="lbl">Bhada (₹)</span><input className={field} type="number" min="0"
            step="0.01" inputMode="decimal" aria-label="Receipt Bhada"
            value={amountInput(form.rent)} onChange={(event) => patch({ rent: event.target.value })} /></label>
          <label><span className="lbl">Hamali (₹)</span><input className={field} type="number" min="0"
            step="0.01" inputMode="decimal" aria-label="Receipt Hamali"
            value={amountInput(form.hamali)} onChange={(event) => patch({ hamali: event.target.value })} /></label>
        </section>}
        <section className="rounded-xl bg-brand-50 p-4">
          <h3 className="text-lg font-bold">Receipt total / कुल</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <p>Bhada: <strong>{money(rentTotal)}</strong></p>
            <p>Hamali: <strong>{money(hamaliTotal)}</strong></p>
          </div>
          <p className="mt-2 flex justify-between text-xl font-bold"><span>Total</span><span>{money(total)}</span></p>
        </section>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Btn type="submit" disabled={saving} className="min-h-12 flex-1 text-base">
            {saving ? "Saving…" : receipt ? "Save changes" : "Save receipt"}
          </Btn>
          <button type="button" disabled={saving} onClick={(event) => save(event, true)} className="btn-s min-h-12 flex-1 text-base">
            <Printer size={18} /> Save & print
          </button>
        </div>
      </form>
    </Card>
  );
}

export default function Booking({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const page = location.pathname.endsWith("/receipts") ? "receipts"
    : location.pathname.endsWith("/ledger") ? "ledger"
      : location.pathname.endsWith("/finance") ? "finance"
        : location.pathname.endsWith("/audit") ? "audit" : "dashboard";
  const owner = user?.role === "owner";
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState(localStorage.getItem("booking_site_id") || "");
  const [siteError, setSiteError] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [tripError, setTripError] = useState("");
  const [tripLoading, setTripLoading] = useState(false);
  const [tripFormOpen, setTripFormOpen] = useState(false);
  const [tripForm, setTripForm] = useState({ date: todayISO(), truck_no: "", driver_name: "" });
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [printReceipt, setPrintReceipt] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [success, setSuccess] = useState("");
  const [ledgerRows, setLedgerRows] = useState([]);
  const [tripOptions, setTripOptions] = useState([]);
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [ledgerError, setLedgerError] = useState("");
  const [ledgerDate, setLedgerDate] = useState(todayISO());
  const [allDates, setAllDates] = useState(false);
  const [tripSearch, setTripSearch] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState({});
  const [settlementBusy, setSettlementBusy] = useState({});
  const dirtyRows = useRef({});
  const saveTimers = useRef({});
  const savingRows = useRef(new Set());
  const queuedRows = useRef(new Set());
  const revisions = useRef({});
  const rowVersions = useRef({});
  const ledgerRowCache = useRef({});
  const tripsCache = useRef(new Map());
  const receiptsCache = useRef(new Map());
  const tripsRequestVersions = useRef(new Map());
  const receiptsRequestVersions = useRef(new Map());
  const activeTripsRequest = useRef("");
  const activeReceiptsRequest = useRef("");
  const activeLedgerRequest = useRef(0);
  const restoredTripId = useRef("");
  const site = sites.find((item) => item.id === siteId);
  const permissions = user?.site_permissions?.[siteId] || [];
  const can = (permission) => owner || permissions.includes(permission);
  const canFinanceRead = can("finance:read") || can("finance:update") || can("lrs:create") || can("lrs:update");
  const canEditFinance = can("lrs:update");

  const refreshTrips = useCallback(async (dateValue = selectedDate, targetSite = siteId) => {
    if (!targetSite) { setTrips([]); return; }
    const cacheKey = `${targetSite}:${dateValue}`;
    activeTripsRequest.current = cacheKey;
    const requestVersion = (tripsRequestVersions.current.get(cacheKey) || 0) + 1;
    tripsRequestVersions.current.set(cacheKey, requestVersion);
    const cachedTrips = tripsCache.current.get(cacheKey);
    if (cachedTrips) {
      setTrips(cachedTrips);
      setTripLoading(false);
    } else {
      setTripLoading(true);
    }
    setTripError("");
    try {
      const response = await api.get(`/sites/${targetSite}/trips`, { params: {
        from_date: dateValue, to_date: dateValue, limit: 100, offset: 0,
      } });
      const rows = response.data.rows || [];
      if (tripsRequestVersions.current.get(cacheKey) === requestVersion) {
        tripsCache.current.set(cacheKey, rows);
        if (activeTripsRequest.current === cacheKey) setTrips(rows);
      }
    } catch (requestError) {
      if (tripsRequestVersions.current.get(cacheKey) === requestVersion
        && activeTripsRequest.current === cacheKey) setTripError(errMsg(requestError));
    } finally {
      if (tripsRequestVersions.current.get(cacheKey) === requestVersion
        && activeTripsRequest.current === cacheKey) setTripLoading(false);
    }
  }, [selectedDate, siteId]);

  const refreshReceipts = useCallback(async (targetTrip = selectedTrip) => {
    if (!targetTrip) { setReceipts([]); return; }
    const cacheKey = `${targetTrip.site_id}:${targetTrip.id}`;
    activeReceiptsRequest.current = cacheKey;
    const requestVersion = (receiptsRequestVersions.current.get(cacheKey) || 0) + 1;
    receiptsRequestVersions.current.set(cacheKey, requestVersion);
    const cachedReceipts = receiptsCache.current.get(cacheKey);
    setReceipts(cachedReceipts || []);
    try {
      const path = `/sites/${targetTrip.site_id}/trips/${targetTrip.id}/lrs`;
      const first = await api.get(path, { params: { limit: 100, offset: 0 } });
      let rows = first.data.rows || [];
      if (receiptsRequestVersions.current.get(cacheKey) === requestVersion) {
        receiptsCache.current.set(cacheKey, rows);
        if (activeReceiptsRequest.current === cacheKey) setReceipts(rows);
      }
      const total = Math.min(Number(first.data.total) || rows.length, 10000);
      const offsets = [];
      for (let offset = rows.length; offset < total; offset += 100) offsets.push(offset);
      if (!offsets.length) return;
      const pages = await Promise.all(offsets.map((offset) =>
        api.get(path, { params: { limit: 100, offset } })));
      rows = rows.concat(...pages.map((page) => page.data.rows || []));
      if (receiptsRequestVersions.current.get(cacheKey) === requestVersion) {
        receiptsCache.current.set(cacheKey, rows);
        if (activeReceiptsRequest.current === cacheKey) setReceipts(rows);
      }
    } catch (requestError) {
      if (receiptsRequestVersions.current.get(cacheKey) === requestVersion
        && activeReceiptsRequest.current === cacheKey) setTripError(errMsg(requestError));
    }
  }, [selectedTrip]);

  useEffect(() => {
    api.get("/sites").then((response) => {
      setSites(response.data || []);
      setSiteError("");
      if (!response.data?.some((item) => item.id === siteId) && response.data?.length) {
        const firstSiteId = response.data[0].id;
        setSiteId(firstSiteId);
        localStorage.setItem("booking_site_id", firstSiteId);
      }
    }).catch((requestError) => setSiteError(errMsg(requestError)));
  }, []); // Sites are permission-filtered by the server.

  useEffect(() => {
    if (!siteId) return;
    localStorage.setItem("booking_site_id", siteId);
    refreshTrips(selectedDate, siteId);
  }, [siteId, selectedDate, refreshTrips]);

  useEffect(() => {
    if (!selectedTrip || page !== "receipts") return;
    refreshReceipts(selectedTrip);
  }, [selectedTrip, page, refreshReceipts]);

  useEffect(() => {
    const tripId = localStorage.getItem("booking_trip_id");
    if (!siteId || !tripId || selectedTrip || page !== "receipts" || restoredTripId.current === tripId) return;
    restoredTripId.current = tripId;
    api.get(`/sites/${siteId}/trips/${tripId}`).then((response) => {
      if (response.data.site_id !== siteId) return;
      setSelectedTrip(response.data);
      setSelectedDate(response.data.operating_date);
    }).catch(() => {
      localStorage.removeItem("booking_trip_id");
      restoredTripId.current = "";
    });
  }, [siteId, selectedTrip, page]);

  useEffect(() => {
    if (!printMode) return undefined;
    let cancelled = false;
    const finishPrint = () => {
      setPrintMode(null);
      setPrintReceipt(null);
    };
    const onAfterPrint = () => finishPrint();
    window.addEventListener("afterprint", onAfterPrint);
    const timer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        if (!cancelled) window.print();
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printMode]);

  const selectSite = (value) => {
    setSiteId(value);
    setTrips(tripsCache.current.get(`${value}:${selectedDate}`) || []);
    setTripError("");
    setSelectedTrip(null);
    localStorage.removeItem("booking_trip_id");
    setReceipts([]);
  };
  const openTrip = async (trip) => {
    setSelectedTrip(trip);
    localStorage.setItem("booking_trip_id", trip.id);
    setReceiptFormOpen(false);
    setEditingReceipt(null);
    setSuccess("");
    navigate("/booking/receipts");
  };
  const createTrip = async (event) => {
    event.preventDefault();
    if (!siteId) return;
    setTripError("");
    try {
      const response = await api.post(`/sites/${siteId}/trips`, {
        operating_date: tripForm.date, truck_no: tripForm.truck_no.trim(),
        driver_name: tripForm.driver_name.trim(),
      });
      const trip = response.data;
      setSuccess(`Trip created: ${trip.trip_ref}`);
      setTripFormOpen(false);
      setSelectedDate(trip.operating_date);
      setSelectedTrip(trip);
      localStorage.setItem("booking_trip_id", trip.id);
      await refreshTrips(trip.operating_date, siteId);
      navigate("/booking/receipts");
    } catch (requestError) { setTripError(errMsg(requestError)); }
  };
  const changeTripStatus = async (reopen = false) => {
    if (!selectedTrip) return;
    const reason = reopen ? window.prompt("Why does this trip need to be reopened?") : "";
    if (reopen && !reason?.trim()) return;
    try {
      const response = await api.post(`/sites/${siteId}/trips/${selectedTrip.id}/${reopen ? "reopen" : "close"}`,
        reopen ? { reason: reason.trim() } : {});
      const updatedTrip = {
        ...selectedTrip, ...response.data,
        lr_count: response.data.lr_count ?? selectedTrip.lr_count,
      };
      setSelectedTrip(updatedTrip);
      const cacheKey = `${siteId}:${selectedDate}`;
      tripsRequestVersions.current.set(cacheKey, (tripsRequestVersions.current.get(cacheKey) || 0) + 1);
      const updateTrip = (trip) => trip.id === updatedTrip.id
        ? { ...trip, ...updatedTrip, lr_count: updatedTrip.lr_count ?? trip.lr_count }
        : trip;
      const cachedTrips = tripsCache.current.get(cacheKey);
      if (cachedTrips) tripsCache.current.set(cacheKey, cachedTrips.map(updateTrip));
      setTrips((current) => current.map(updateTrip));
      setSuccess(`${response.data.trip_ref} ${reopen ? "reopened" : "closed"}.`);
    } catch (requestError) { setTripError(errMsg(requestError)); }
  };
  const receiptSaved = async (receipt, printAfter) => {
    setReceiptFormOpen(false);
    setEditingReceipt(null);
    setSuccess(`Saved ${receipt.lr_ref || "receipt"} successfully.`);
    const cacheKey = `${selectedTrip.site_id}:${selectedTrip.id}`;
    receiptsRequestVersions.current.set(cacheKey, (receiptsRequestVersions.current.get(cacheKey) || 0) + 1);
    const cachedReceipts = receiptsCache.current.get(cacheKey) || receipts;
    const nextReceipts = cachedReceipts.some((item) => item.id === receipt.id)
      ? cachedReceipts.map((item) => item.id === receipt.id ? receipt : item)
      : [receipt, ...cachedReceipts];
    receiptsCache.current.set(cacheKey, nextReceipts);
    setReceipts(nextReceipts);
    void refreshReceipts(selectedTrip);
    void refreshTrips(selectedDate, siteId);
    if (printAfter) {
      setPrintReceipt({ ...receipt, _printToken: Date.now() });
      setPrintMode("receipt");
    }
  };
  const queuePrint = (receipt) => {
    setPrintReceipt({ ...receipt, _printToken: Date.now() });
    setPrintMode("receipt");
  };
  const printLedger = () => {
    setPrintReceipt(null);
    setPrintMode("ledger");
  };

  const loadLedger = useCallback(async () => {
    if (!siteId) { setLedgerRows([]); return; }
    const requestId = activeLedgerRequest.current + 1;
    activeLedgerRequest.current = requestId;
    setLedgerBusy(true);
    setLedgerError("");
    try {
      const params = {
        limit: 1000, offset: 0,
        ...(allDates ? {} : { from_date: ledgerDate, to_date: ledgerDate }),
        ...(tripSearch ? { trip_ref: tripSearch } : {}),
        ...(partySearch ? { search: partySearch } : {}),
      };
      const first = await api.get(`/sites/${siteId}/ledger/entries`, { params });
      let rows = first.data.rows || [];
      const applyRows = (nextRows) => {
        nextRows.forEach((row) => {
          ledgerRowCache.current[row.id] = row;
          if (row.updated_at) rowVersions.current[row.id] = row.updated_at;
        });
        setLedgerRows(nextRows.map((row) => ({ ...row, ...(dirtyRows.current[row.id] || {}) })));
        if (!tripSearch) setTripOptions([...new Set(nextRows.map((row) => row.trip_ref).filter(Boolean))]);
      };
      applyRows(rows);
      if (requestId === activeLedgerRequest.current) setLedgerBusy(false);
      const total = Math.min(Number(first.data.total) || rows.length, 10000);
      const offsets = [];
      for (let offset = rows.length; offset < total; offset += 1000) offsets.push(offset);
      if (!offsets.length) return;
      const pages = await Promise.all(offsets.map((offset) =>
        api.get(`/sites/${siteId}/ledger/entries`, { params: { ...params, offset } })));
      rows = rows.concat(...pages.map((page) => page.data.rows || []));
      if (requestId === activeLedgerRequest.current) applyRows(rows);
      else rows.forEach((row) => { ledgerRowCache.current[row.id] = row; });
    } catch (requestError) {
      if (requestId === activeLedgerRequest.current) setLedgerError(errMsg(requestError));
    } finally {
      if (requestId === activeLedgerRequest.current) setLedgerBusy(false);
    }
  }, [siteId, ledgerDate, allDates, tripSearch, partySearch]);

  useEffect(() => {
    if (page !== "ledger") return undefined;
    const timer = window.setTimeout(loadLedger, 300);
    return () => window.clearTimeout(timer);
  }, [page, loadLedger]);

  const flushLedgerRow = async (rowId) => {
    window.clearTimeout(saveTimers.current[rowId]);
    if (savingRows.current.has(rowId)) { queuedRows.current.add(rowId); return; }
    const dirty = dirtyRows.current[rowId];
    if (!dirty || !Object.keys(dirty).length) return;
    if (dirty.goods_rows?.some((line) => !line.type.trim() || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)) {
      setLedgerStatus((current) => ({ ...current, [rowId]: "Unsaved goods row" }));
      return;
    }
    const row = ledgerRows.find((item) => item.id === rowId) || ledgerRowCache.current[rowId];
    if (!row) return;
    const snapshot = { ...dirty };
    if (snapshot.goods_rows) {
      snapshot.goods_rows = snapshot.goods_rows.map(stripGoodsCharges);
    }
    if (!canEditFinance && snapshot.goods_rows) {
      snapshot.goods_rows = snapshot.goods_rows.map(({ rent, hamali, ...line }) => line);
      delete snapshot.rent;
      delete snapshot.hamali;
    }
    for (const key of ["rent", "hamali"]) {
      if (snapshot[key] === "") snapshot[key] = "0";
    }
    const protectedCorrection = owner && (
      row.trip_status !== "open"
      || (row.reconciled && ("rent" in snapshot || "hamali" in snapshot))
      || (("receiver_name" in snapshot || "receiver_identifier" in snapshot)
        && (row.reconciled || Number(row.rent) > 0 || Number(row.paid_total) > 0))
    );
    if (protectedCorrection) {
      const reason = window.prompt(`Why are you correcting ${row.lr_ref}?`);
      if (!reason?.trim()) {
        setLedgerStatus((current) => ({ ...current, [rowId]: "Not saved: owner correction reason required" }));
        return;
      }
      snapshot.owner_correction_reason = reason.trim();
    }
    const revision = revisions.current[rowId] || 0;
    savingRows.current.add(rowId);
    setLedgerStatus((current) => ({ ...current, [rowId]: "Saving" }));
    try {
      const response = await api.patch(`/sites/${row.site_id}/trips/${row.trip_id}/lrs/${rowId}`, {
        ...snapshot,
        expected_updated_at: rowVersions.current[rowId] || row.updated_at,
        ...(Object.hasOwn(snapshot, "rent") || Object.hasOwn(snapshot, "goods_rows")
          || Object.hasOwn(snapshot, "receiver_name")
          || Object.hasOwn(snapshot, "receiver_identifier") ? { idempotency_key: keyForRequest() } : {}),
      });
      const saved = response.data;
      if (saved.updated_at) rowVersions.current[rowId] = saved.updated_at;
      const currentDirty = dirtyRows.current[rowId] || {};
      Object.keys(snapshot).forEach((key) => {
        if ((revisions.current[rowId] || 0) === revision) delete currentDirty[key];
      });
      dirtyRows.current[rowId] = currentDirty;
      const updatedRow = { ...row, ...saved, ...currentDirty };
      ledgerRowCache.current[rowId] = updatedRow;
      setLedgerRows((current) => current.map((item) => item.id === rowId ? updatedRow : item));
      setLedgerStatus((current) => ({ ...current, [rowId]: Object.keys(currentDirty).length ? "Saving" : "Saved" }));
    } catch (requestError) {
      setLedgerStatus((current) => ({ ...current, [rowId]: `Failed to save: ${errMsg(requestError)}` }));
    } finally {
      savingRows.current.delete(rowId);
      if (queuedRows.current.has(rowId)) {
        queuedRows.current.delete(rowId);
        if (Object.keys(dirtyRows.current[rowId] || {}).length) flushLedgerRow(rowId);
      }
    }
  };

  const editLedgerCell = (rowId, key, value) => {
    const row = ledgerRows.find((item) => item.id === rowId);
    if (!row) return;
    const patch = { [key]: value };
    if (key === "goods_rows") {
      patch.goods_rows = value.map(stripGoodsCharges);
      patch.goods_type = patch.goods_rows[0]?.type || "";
      patch.goods_type_hindi = patch.goods_rows[0]?.type_hindi || "";
    }
    dirtyRows.current[rowId] = { ...dirtyRows.current[rowId], ...patch };
    revisions.current[rowId] = (revisions.current[rowId] || 0) + 1;
    const next = { ...row, ...patch, goods_rows: key === "goods_rows" ? patch.goods_rows : row.goods_rows };
    if (key === "rent" || key === "hamali") {
      next.total_rent = (Number(key === "rent" ? value : row.rent) || 0)
        + (Number(key === "hamali" ? value : row.hamali) || 0);
    }
    ledgerRowCache.current[rowId] = next;
    setLedgerRows((current) => current.map((item) => item.id === rowId ? next : item));
    setLedgerStatus((current) => ({ ...current, [rowId]: "Saving" }));
    if (patch.goods_rows?.some((line) => !line.type.trim() || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)) {
      clearTimeout(saveTimers.current[rowId]);
      setLedgerStatus((current) => ({ ...current, [rowId]: "Unsaved goods row" }));
      return;
    }
    clearTimeout(saveTimers.current[rowId]);
    saveTimers.current[rowId] = window.setTimeout(() => flushLedgerRow(rowId), 650);
  };

  const reloadLedgerRow = async (row) => {
    if (!window.confirm(`Reload ${row.lr_ref} from the server and discard its unsaved changes?`)) return;
    window.clearTimeout(saveTimers.current[row.id]);
    try {
      const response = await api.get(`/sites/${row.site_id}/trips/${row.trip_id}/lrs/${row.id}`);
      const saved = response.data;
      dirtyRows.current[row.id] = {};
      revisions.current[row.id] = (revisions.current[row.id] || 0) + 1;
      if (saved.updated_at) rowVersions.current[row.id] = saved.updated_at;
      const updatedRow = { ...(ledgerRowCache.current[row.id] || row), ...saved };
      ledgerRowCache.current[row.id] = updatedRow;
      setLedgerRows((current) => current.map((item) => item.id === row.id ? updatedRow : item));
      setLedgerStatus((current) => ({ ...current, [row.id]: "Saved" }));
    } catch (requestError) {
      setLedgerStatus((current) => ({ ...current, [row.id]: `Failed to reload: ${errMsg(requestError)}` }));
    }
  };

  const downloadLedger = async () => {
    setLedgerError("");
    try {
      const response = await api.get(`/sites/${siteId}/ledger/export.xlsx`, {
        params: {
          from_date: allDates ? "1900-01-01" : ledgerDate,
          to_date: allDates ? "9999-12-31" : ledgerDate,
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${site?.code || "site"}-ledger.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) { setLedgerError(errMsg(requestError)); }
  };

  const voidReceipt = async (receipt) => {
    if (!window.confirm(`Void receipt ${receipt.lr_ref}? This keeps it in the audit history.`)) return;
    const reason = window.prompt("Why does this receipt need to be voided? This reason is saved in the audit history.");
    if (!reason?.trim()) return;
    try {
      await api.post(`/sites/${receipt.site_id}/trips/${receipt.trip_id}/lrs/${receipt.id}/void`, { reason });
      setSuccess(`${receipt.lr_ref} was voided.`);
      await refreshReceipts(selectedTrip);
      await loadLedger();
    } catch (requestError) { setTripError(errMsg(requestError)); }
  };

  const restoreReceipt = async (receipt) => {
    const reason = window.prompt("Why should this receipt be restored? This reason is saved in the audit history.");
    if (!reason?.trim()) return;
    try {
      await api.post(`/sites/${receipt.site_id}/trips/${receipt.trip_id}/lrs/${receipt.id}/unvoid`, {
        reason: reason.trim(), idempotency_key: keyForRequest(),
      });
      setSuccess(`${receipt.lr_ref} was restored.`);
      await refreshReceipts(selectedTrip);
      await loadLedger();
    } catch (requestError) { setTripError(errMsg(requestError)); }
  };

  const setReceiptSettlement = async (row, received) => {
    setSettlementBusy((current) => ({ ...current, [row.id]: true }));
    setLedgerStatus((current) => ({ ...current, [row.id]: "Saving payment…" }));
    try {
      const response = await api.post(
        `/sites/${row.site_id}/trips/${row.trip_id}/lrs/${row.id}/settlement`,
        { received, idempotency_key: keyForRequest() },
      );
      const saved = {
        ...row,
        paid_total: response.data.paid_total,
        outstanding: response.data.outstanding,
        payment_status: response.data.received ? "paid"
          : Number(response.data.paid_total) > 0 ? "partial" : "unpaid",
        ledger_settlement_created: received,
      };
      ledgerRowCache.current[row.id] = saved;
      setLedgerRows((current) => current.map((item) => item.id === row.id ? saved : item));
      setLedgerStatus((current) => ({ ...current, [row.id]: "Saved" }));
    } catch (requestError) {
      setLedgerStatus((current) => ({ ...current, [row.id]: `Failed to save: ${errMsg(requestError)}` }));
    } finally {
      setSettlementBusy((current) => ({ ...current, [row.id]: false }));
    }
  };

  const title = page === "dashboard" ? "Dashboard" : page === "receipts" ? "Receipts"
    : page === "finance" ? "Booking Finance" : page === "audit" ? "Booking Audit" : "Ledger";
  const tripSelector = useMemo(() => trips, [trips]);
  const addressSuggestions = useMemo(() => ({
    sender: [...new Set(receipts.map((receipt) => receipt.sender_address).filter(Boolean))],
    receiver: [...new Set(receipts.map((receipt) => receipt.receiver_address).filter(Boolean))],
  }), [receipts]);
  const ledgerField = (row, key, value, type, label, className = "") => <input
    aria-label={`${row.lr_ref} ${label}`} className={`${field} ${className}`} type={type}
    value={value ?? ""}
    {...(type === "number" ? { min: 0, step: "0.01", inputMode: "decimal" } : {})}
    disabled={row.voided || (row.trip_status === "closed" && !owner)
      || (key === "rent" || key === "hamali" ? !canEditFinance : !can("lrs:update"))}
    onChange={(event) => editLedgerCell(row.id, key, event.target.value)}
    onBlur={() => flushLedgerRow(row.id)} />;
  const chargeEditorBadge = (marker, name = "") => marker
    ? <span aria-label={`Last charge edit by ${marker === "A" ? "admin" : "manager"}${name ? `: ${name}` : ""}`}
      title={marker === "A"
        ? `Admin${name ? `: ${name}` : ""}`
        : `Manager${name ? `: ${name}` : ""}`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line font-bold">{marker}</span>
    : <span className="text-muted">—</span>;
  const conciseLedgerStatus = (status) => status.startsWith("Failed to save:")
    ? "Save failed" : status.startsWith("Failed to reload:") ? "Reload failed" : status;
  const ledgerGoodsEditors = (row, goodsRows, compact = false) => goodsRows.map((line, index) => {
    const updateLine = (changes) => editLedgerCell(row.id, "goods_rows", goodsRows.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...changes } : item));
    const inputClass = `${field} min-w-0 text-xs px-1.5 py-1.5`;
    return <div key={`${row.id}-goods-${index}`} className={compact
      ? "grid grid-cols-2 gap-2 rounded-lg border border-line p-3"
      : "grid min-w-0 grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(4rem,0.45fr)_1.5rem] gap-1"}>
      <label className="min-w-0 space-y-1">
        {compact && <span className="lbl">Goods type / माल</span>}
        <input className={inputClass} aria-label={`${row.lr_ref} goods type ${index + 1}`} value={line.type}
          placeholder="Goods type" disabled={!can("lrs:update")}
          onChange={(event) => updateLine({ type: event.target.value, type_hindi: romanHindi(event.target.value) })}
          onBlur={() => flushLedgerRow(row.id)} />
        <input className={`${inputClass} font-semibold`} aria-label={`${row.lr_ref} goods Hindi ${index + 1}`}
          lang="hi" dir="auto" value={line.type_hindi} placeholder="हिंदी"
          disabled={!can("lrs:update")} onChange={(event) => updateLine({ type_hindi: event.target.value })}
          onBlur={() => flushLedgerRow(row.id)} />
      </label>
      <label className={`min-w-0 ${compact ? "col-span-2" : ""}`}>
        {compact && <span className="lbl">Goods description</span>}
        <input className={inputClass} aria-label={`${row.lr_ref} goods description ${index + 1}`}
          value={line.description || ""} placeholder="Goods description"
          disabled={!can("lrs:update")} onChange={(event) => updateLine({ description: event.target.value })}
          onBlur={() => flushLedgerRow(row.id)} />
      </label>
      <label className="min-w-0">
        {compact && <span className="lbl">Quantity</span>}
        <input className={`${inputClass} min-h-11 min-w-16 text-center text-base font-semibold`}
          aria-label={`${row.lr_ref} quantity ${index + 1}`} type="number" min="1"
          step="1" inputMode="numeric" value={line.quantity ?? ""} placeholder="Qty"
          disabled={!can("lrs:update")}
          onChange={(event) => updateLine({ quantity: event.target.value === "" ? "" : Number(event.target.value) })}
          onBlur={() => flushLedgerRow(row.id)} />
      </label>
      <button type="button" className="flex min-w-0 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
        style={!compact ? { order: 1 } : undefined}
        aria-label={`Remove ${row.lr_ref} goods row ${index + 1}`}
        disabled={!can("lrs:update") || goodsRows.length === 1}
        onClick={() => editLedgerCell(row.id, "goods_rows", goodsRows.filter((_, itemIndex) => itemIndex !== index))}>
        <X size={17} />
      </button>
    </div>;
  });
  if (siteError && !sites.length) return <ErrorState text={siteError} onRetry={() => api.get("/sites").then((response) => setSites(response.data || []))} />;
  if (!sites.length) return <div className="space-y-3"><PageHead title="Booking" /><Card className="p-6 text-center">
    <p className="text-lg font-semibold">No booking site is assigned to this account.</p>
  </Card></div>;
  if ((page === "finance" || page === "audit") && !owner) return <Navigate to="/booking/dashboard" replace />;
  if (page === "finance") return <BookingFinance user={user} />;
  if (page === "audit") return <BookingAudit user={user} />;

  return (
    <>
      <style>{`
        .booking-print-target { display:none; }
        @page { size:A4 ${printMode === "ledger" ? "landscape" : "portrait"}; margin:12mm; }
        @media print {
          html, body, #root { height:auto !important; overflow:visible !important; background:#fff !important; }
          body * { visibility:hidden !important; }
          .booking-print-target, .booking-print-target * { visibility:visible !important; }
          .booking-print-target[data-active="true"] { display:block !important; position:fixed; inset:0; z-index:99999; width:100%; color:#111; background:#fff; font-family:"Noto Sans Devanagari","Mangal",sans-serif; font-size:12pt; }
          .receipt-print-header { display:grid; grid-template-columns:1fr 2fr 1fr; align-items:center; gap:8px; border-bottom:1px solid #111; padding-bottom:8px; text-align:center; }
          .receipt-print-logo { max-width:70px; max-height:55px; object-fit:contain; }
          .receipt-print-company h1 { margin:0; font-size:23pt; font-weight:700; }
          .receipt-print-company p { margin:2px 0; font-size:14pt; font-weight:600; }
          .receipt-print-company span, .receipt-print-contact { font-size:9pt; }
          .receipt-print-contact { text-align:right; }
          .receipt-print-meta { display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid #777; font-size:10pt; }
          .receipt-print-parties { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:12px 0; }
          .receipt-print-parties div { display:grid; gap:3px; }
          .receipt-print-goods { width:100%; border-collapse:collapse; table-layout:fixed; }
          .receipt-print-goods th, .receipt-print-goods td { border:1px solid #222; padding:8px; text-align:left; vertical-align:top; }
          .receipt-print-goods th:first-child, .receipt-print-goods td:first-child { width:22%; text-align:center; }
          .receipt-print-description { display:block; margin-top:3px; font-size:10pt; }
          .receipt-print-charges { width:55%; margin:12px 0 0 auto; border-collapse:collapse; }
          .receipt-print-charges th, .receipt-print-charges td { border:1px solid #222; padding:6px 8px; text-align:right; }
          .receipt-print-charges th { text-align:left; }
          .receipt-print-total-row { font-weight:700; font-size:13pt; }
          .receipt-print-total { margin:12px 0 0; padding:8px; border:1px solid #111; text-align:right; font-size:15pt; font-weight:700; }
          .receipt-print-footer { margin-top:16px; border-top:1px solid #888; padding-top:6px; font-size:9pt; }
          .booking-print-target table { break-inside:avoid; }
          .booking-print-target tr { break-inside:avoid; }
          .booking-ledger-print { display:${printMode === "ledger" ? "block" : "none"} !important; position:absolute; left:0; top:0; z-index:99999; visibility:visible !important; width:100%; color:#111; background:#fff; font:9pt Arial,sans-serif; }
          .booking-ledger-print * { visibility:visible !important; }
          .booking-ledger-print h1 { margin:0 0 4px; font-size:16pt; }
          .booking-ledger-print p { margin:0 0 10px; }
          .booking-ledger-print table { width:100%; border-collapse:collapse; table-layout:fixed; }
          .booking-ledger-print thead { display:table-header-group; }
          .booking-ledger-print tr { break-inside:avoid; page-break-inside:avoid; }
          .booking-ledger-print th, .booking-ledger-print td { border:1px solid #444; padding:4px; overflow-wrap:anywhere; text-align:left; vertical-align:top; }
          .booking-ledger-print th { background:#e9efed !important; }
        }
      `}</style>
      <div className="booking-workspace space-y-5">
        <PageHead title={title} subtitle={site?.name || "Goods transport"} />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)]">
          {owner && <label><span className="lbl">Site / Garage</span><select className={field} value={siteId}
            onChange={(event) => selectSite(event.target.value)}>{sites.map((item) =>
              <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {!owner && <div className="rounded-lg bg-white px-3 py-2 text-sm"><span className="lbl">Site / Garage</span><strong>{site?.name || "Loading…"}</strong></div>}
          <div className="flex rounded-xl bg-white p-1 shadow-sm" aria-label="Booking navigation">
            {[
              ["dashboard", "Dashboard"], ["receipts", "Receipts"], ["ledger", "Ledger"],
              ...(owner ? [["finance", "Booking Finance"], ["audit", "Booking Audit"]] : []),
            ].map(([target, label]) =>
              <Link key={target} to={`/booking/${target}`} aria-current={page === target ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold ${page === target ? "bg-brand-600 text-white" : "text-ink hover:bg-canvas"}`}>
                {label}
              </Link>)}
          </div>
        </div>
        {success && <div role="status" className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-lg font-semibold text-green-900"><Check />{success}</div>}
        {tripError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{tripError}</div>}

        {page === "dashboard" && <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
            <label className="min-w-52 flex-1"><span className="lbl">Date / तारीख</span>
              <span className="flex items-center gap-2"><CalendarDays size={18} className="text-brand-600" />
                <input className={field} type="date" value={selectedDate}
                  onChange={(event) => {
                    const dateValue = event.target.value;
                    setSelectedDate(dateValue);
                    setTrips(tripsCache.current.get(`${siteId}:${dateValue}`) || []);
                    setTripError("");
                    setTripForm((current) => ({ ...current, date: dateValue }));
                  }} />
              </span>
            </label>
            {can("trips:create") && <button className="btn-p min-h-14 w-full text-lg sm:w-auto" onClick={() => {
              setTripForm({ date: selectedDate, truck_no: "", driver_name: "" }); setTripFormOpen(true);
            }}><Plus size={20} /> Create Trip</button>}
          </Card>
          {tripFormOpen && <Card className="p-4 sm:p-6">
            <h2 className="mb-4 text-xl font-bold">Create trip</h2>
            <form onSubmit={createTrip} className="grid gap-4 sm:grid-cols-2">
              <label><span className="lbl">Date / तारीख *</span><input className={field} required type="date" value={tripForm.date}
                onChange={(event) => setTripForm({ ...tripForm, date: event.target.value })} /></label>
              <label><span className="lbl">Vehicle number (optional)</span><input className={field} value={tripForm.truck_no}
                onChange={(event) => setTripForm({ ...tripForm, truck_no: event.target.value })} /></label>
              <label><span className="lbl">Driver name (optional)</span><input className={field} value={tripForm.driver_name}
                onChange={(event) => setTripForm({ ...tripForm, driver_name: event.target.value })} /></label>
              <div className="flex items-end gap-2"><Btn type="submit" className="min-h-12 flex-1">Create trip</Btn>
                <button type="button" className="btn-s" onClick={() => setTripFormOpen(false)}>Cancel</button></div>
            </form>
          </Card>}
          <div><h2 className="mb-3 text-xl font-bold">Trips for {selectedDate}</h2>
            {tripLoading ? <Loader label="Loading trips…" /> : tripError ? <ErrorState text={tripError} onRetry={() => refreshTrips()} /> :
              trips.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {tripSelector.map((trip) => <button key={trip.id} onClick={() => openTrip(trip)}
                  className="card min-h-36 p-4 text-left hover:border-brand-400 focus-visible:outline-brand-600">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xl font-bold">{trip.trip_ref}</span>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${trip.status === "closed" ? "bg-slate-100 text-slate-700" : "bg-green-100 text-green-800"}`}>
                      {trip.status === "closed" ? "Closed" : "Open"}
                    </span>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm"><Truck size={17} />{trip.truck_no || "Vehicle not entered"}</p>
                  <p className="mt-1 text-sm text-muted">{trip.driver_name || "Driver not entered"}</p>
                  <span className="mt-4 flex items-center justify-between text-sm font-semibold text-brand-700">
                    {trip.operating_date} · {trip.lr_count ?? "Open trip"} receipts <ChevronRight size={18} />
                  </span>
                </button>)}
              </div> : <Card className="p-6 text-center">
                <p className="text-lg font-semibold">No trips on this date.</p>
                {can("trips:create") && <p className="mt-1 text-sm text-muted">Create a trip to start adding receipts.</p>}
              </Card>}
          </div>
        </div>}

        {page === "receipts" && <div className="space-y-4">
          {selectedTrip ? <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="text-sm font-medium text-muted">Selected trip</p><h2 className="text-xl font-bold">{selectedTrip.trip_ref}</h2>
              <p className="mt-1 text-sm">{selectedTrip.operating_date}
                {selectedTrip.truck_no ? ` · ${selectedTrip.truck_no}` : ""}
                {selectedTrip.driver_name ? ` · ${selectedTrip.driver_name}` : ""}</p>
            </div>
            <label className="min-w-52 flex-1 sm:max-w-xs"><span className="lbl">Change trip</span>
              <select className={field} value={selectedTrip.id} onChange={(event) => {
                const trip = trips.find((item) => item.id === event.target.value);
                if (trip) openTrip(trip);
              }}><option value={selectedTrip.id}>{selectedTrip.trip_ref}</option>
                {trips.filter((trip) => trip.id !== selectedTrip.id).map((trip) => <option key={trip.id} value={trip.id}>{trip.trip_ref}</option>)}
              </select></label>
            {can("lrs:create") && selectedTrip.status === "open" &&
              <button className="btn-p min-h-12 w-full sm:w-auto" onClick={() => {
                setEditingReceipt(null); setReceiptFormOpen(true); setTripError("");
              }}><Plus size={19} /> Create New Receipt</button>}
            {selectedTrip.status === "closed" && <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Trip closed · receipts locked</span>}
            {selectedTrip.status === "open" && can("trips:close") &&
              <button className="btn-s" onClick={() => changeTripStatus(false)}>Close Trip</button>}
            {selectedTrip.status === "closed" && owner &&
              <button className="btn-s" onClick={() => changeTripStatus(true)}>Reopen Trip</button>}
          </Card> : <Card className="p-5">
            <p className="text-lg font-semibold">Choose a trip before creating a receipt.</p>
            <Link className="btn-p mt-3" to="/booking/dashboard">Open Dashboard</Link>
          </Card>}
          {receiptFormOpen && selectedTrip && <ReceiptForm key={editingReceipt?.id || "new"} trip={selectedTrip}
            receipt={editingReceipt}
            canEditFinance={canEditFinance || (!editingReceipt && can("lrs:create"))}
            owner={owner}
            addressSuggestions={addressSuggestions}
            onCancel={() => { setReceiptFormOpen(false); setEditingReceipt(null); }}
            onSaved={receiptSaved} />}
          <section>
            <h2 className="mb-3 text-xl font-bold">Receipts {selectedTrip ? `· ${selectedTrip.trip_ref}` : ""}</h2>
            {!selectedTrip ? null : receipts.length ? <div className="space-y-2">
              {receipts.map((receipt) => <Card key={receipt.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 ${receipt.voided ? "opacity-70" : ""}`}>
                <div className="min-w-48 flex-1"><h3 className="font-bold">{receipt.lr_ref}</h3>
                  <p className="mt-1 text-sm">{receipt.sender_name} → {receipt.receiver_name}</p>
                  <p className="mt-1 text-sm text-muted">{getGoodsRows(receipt).map((line) => `${line.type} × ${line.quantity}`).join(" · ")}</p>
                  {receipt.voided && <p className="mt-1 font-semibold text-red-700">VOID · kept in history</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!receipt.voided && <button className="btn-s" onClick={() => queuePrint(receipt)}><Printer size={17} /> Print</button>}
                  {owner && receipt.voided && <button className="btn-s" onClick={() => restoreReceipt(receipt)}>Restore receipt</button>}
                  {!receipt.voided && can("lrs:update") && (selectedTrip.status === "open" || owner) && <>
                    <button className="btn-s" onClick={() => { setEditingReceipt(receipt); setReceiptFormOpen(true); }}>Edit</button>
                    <button className="btn-s text-red-700" onClick={() => voidReceipt(receipt)}>Void</button>
                  </>}
                </div>
              </Card>)}
            </div> : <Card className="p-5 text-center text-muted">No receipts in this trip yet.</Card>}
          </section>
        </div>}

        {page === "ledger" && <div className="space-y-4">
          <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <label><span className="lbl">Date</span><input className={field} type="date" value={ledgerDate}
              disabled={allDates} onChange={(event) => setLedgerDate(event.target.value)} /></label>
            <label><span className="lbl">Trip number</span><select className={field} value={tripSearch}
              onChange={(event) => setTripSearch(event.target.value)}>
              <option value="">All trips</option>
              {[...new Set([...tripOptions, ...(tripSearch ? [tripSearch] : [])])].map((tripRef) =>
                <option key={tripRef} value={tripRef}>{tripRef}</option>)}
            </select></label>
            <label><span className="lbl">Sender / receiver</span><input className={field} list="ledger-party-suggestions" value={partySearch}
              placeholder="Search name" onChange={(event) => setPartySearch(event.target.value)} />
              <datalist id="ledger-party-suggestions">{[...new Set(ledgerRows.flatMap((row) =>
                [row.sender_name, row.receiver_name]).filter(Boolean))].map((name) =>
                <option key={name} value={name} />)}</datalist>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button className="btn-s" onClick={() => setAllDates((value) => !value)}>{allDates ? "Selected date" : "All dates"}</button>
              <button className="btn-s" onClick={() => { setAllDates(false); setLedgerDate(todayISO()); setTripSearch(""); setPartySearch(""); }}>Reset</button>
            </div>
          </Card>
          {ledgerError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{ledgerError}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Receipt ledger</h2><p className="text-sm text-muted">{ledgerRows.length} receipt(s) · {Object.values(ledgerStatus).includes("Saving") ? "Saving…" : "Changes save automatically"}</p></div>
            <div className="flex gap-2">
              <button className="btn-s" onClick={printLedger}><Printer size={17} /> Print Ledger</button>
              <button className="btn-p" onClick={downloadLedger}><Download size={17} /> Download Excel</button>
            </div>
          </div>
          {ledgerBusy ? <Loader label="Loading ledger…" /> : <>
            <div className="space-y-3 lg:hidden">
              {ledgerRows.map((row) => {
                const goodsRows = getGoodsRows(row);
                const status = ledgerStatus[row.id] || "Saved";
                return <Card key={row.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-all text-xl font-bold">{row.lr_ref}{row.voided && <span className="ml-2 text-sm text-red-700">VOID</span>}</h3>
                      <p className="mt-1 break-all text-base font-semibold">Trip: {row.trip_ref}</p>
                      <label className="mt-2 block"><span className="lbl">Date</span>
                        {ledgerField(row, "receipt_date", row.receipt_date || row.operating_date, "date", "date", "min-h-11")}
                      </label>
                    </div>
                    <button className="btn-s shrink-0" disabled={row.voided} onClick={() => queuePrint(row)}
                      aria-label={`Print ${row.lr_ref}`}><Printer size={17} /><span>Print</span></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label><span className="lbl">Sender</span>
                      {ledgerField(row, "sender_name", row.sender_name, "text", "sender", "min-h-11")}
                      {ledgerField(row, "sender_name_hindi", row.sender_name_hindi, "text", "sender Hindi", "mt-1 min-h-11 font-semibold")}
                    </label>
                    <label><span className="lbl">Receiver</span>
                      {ledgerField(row, "receiver_name", row.receiver_name, "text", "receiver", "min-h-11")}
                      {ledgerField(row, "receiver_name_hindi", row.receiver_name_hindi, "text", "receiver Hindi", "mt-1 min-h-11 font-semibold")}
                    </label>
                  </div>
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold">Goods / माल</h4>
                      {can("lrs:update") && <button type="button" className="text-sm font-semibold text-brand-700"
                        onClick={() => editLedgerCell(row.id, "goods_rows", [
                          ...goodsRows, { type: "", type_hindi: "", description: "", quantity: "" },
                        ])}>+ Add goods row</button>}
                    </div>
                    {ledgerGoodsEditors(row, goodsRows, true)}
                  </section>
                  {canFinanceRead ? <div className="grid grid-cols-2 gap-3 rounded-lg bg-canvas p-3">
                    <label><span className="lbl">Bhada (₹)</span>
                      {ledgerField(row, "rent", amountInput(row.rent), "number", "Bhada", "min-h-11")}
                    </label>
                    <label><span className="lbl">Hamali (₹)</span>
                      {ledgerField(row, "hamali", amountInput(row.hamali), "number", "Hamali", "min-h-11")}
                    </label>
                  </div> : <p className="rounded-lg bg-canvas p-3 text-sm text-muted">Charges are not available for this account.</p>}
                  {owner && <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line p-3 font-semibold">
                    <input type="checkbox" className="h-5 w-5 accent-brand-700"
                      aria-label={`${row.lr_ref} payment received`}
                      checked={row.payment_status === "paid"} disabled={row.voided || settlementBusy[row.id]
                        || (row.payment_status === "paid" && !row.ledger_settlement_created)}
                      onChange={(event) => setReceiptSettlement(row, event.target.checked)} />
                    <span>Payment received · {row.payment_status === "paid" ? "Paid" : "Unpaid"}</span>
                  </label>}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <span title={status} className={`text-sm font-semibold ${status.startsWith("Failed") || status.startsWith("Unsaved") ? "text-red-700" : status === "Saved" ? "text-green-700" : "text-amber-800"}`}>
                      {conciseLedgerStatus(status)}
                    </span>
                    <div className="flex items-center gap-2">
                      {status.startsWith("Failed") && <button type="button" className="text-sm font-semibold underline"
                        onClick={() => status.includes("changed elsewhere")
                          ? reloadLedgerRow(row) : flushLedgerRow(row.id)}>
                        {status.includes("changed elsewhere") ? "Reload row" : "Retry save"}
                      </button>}
                      {status.startsWith("Failed") && <details className="text-xs">
                        <summary className="cursor-pointer underline">Details</summary>
                        <p className="max-w-56 break-words">{status}</p>
                      </details>}
                      <span className="text-xs text-muted">Charge editor</span>
                      {chargeEditorBadge(row.charge_editor_marker, row.charge_editor_name)}
                      {owner && row.voided && <button className="btn-s" onClick={() => restoreReceipt(row)}>Restore</button>}
                    </div>
                  </div>
                </Card>;
              })}
              {!ledgerRows.length && <Card className="p-8 text-center text-muted">No receipts found for these filters.</Card>}
            </div>
            <Card className="hidden min-w-0 overflow-hidden lg:block">
              <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed border-collapse text-[11px]">
                  <colgroup>{["6%", "7%", "9%", "6%", "6%", "35%", "6%", "6%", "7%", "2%", "5%", "5%"].map((width, index) =>
                    <col key={index} style={{ width }} />)}</colgroup>
                  <thead><tr>{["Date", "Trip number", "LR number", "Sender", "Receiver", "Goods type · Hindi · description · qty",
                    "Bhada", "Hamali", "Payment received", "Print", "Save", "By"].map((label) =>
                    <th key={label} className="th whitespace-normal !px-1 !py-2 text-[9px] leading-tight">{label}</th>)}</tr></thead>
                  <tbody>{ledgerRows.map((row) => {
                    const goodsRows = getGoodsRows(row);
                    const status = ledgerStatus[row.id] || "Saved";
                    const cell = "td whitespace-normal !px-1 !py-2 align-top text-[11px]";
                    const nameInput = "min-w-0 text-[11px] px-1 py-1";
                    return <tr key={row.id} className="border-b border-line align-top hover:bg-canvas/60">
                      <td className={cell}>{ledgerField(row, "receipt_date", row.receipt_date || row.operating_date, "date", "date", `${nameInput} min-h-9`)}</td>
                      <td className={`${cell} break-all text-xs font-bold leading-tight`}>{row.trip_ref}</td>
                      <td className={`${cell} break-all text-xs font-bold leading-tight`}>{row.lr_ref}{row.voided && <span className="block text-red-700">VOID</span>}</td>
                      <td className={cell}><div className="min-w-0 space-y-1">
                        {ledgerField(row, "sender_name", row.sender_name, "text", "sender", nameInput)}
                        {ledgerField(row, "sender_name_hindi", row.sender_name_hindi, "text", "sender Hindi", `${nameInput} font-semibold`)}
                      </div></td>
                      <td className={cell}><div className="min-w-0 space-y-1">
                        {ledgerField(row, "receiver_name", row.receiver_name, "text", "receiver", nameInput)}
                        {ledgerField(row, "receiver_name_hindi", row.receiver_name_hindi, "text", "receiver Hindi", `${nameInput} font-semibold`)}
                      </div></td>
                      <td className={cell}><div className="min-w-0 space-y-2">
                        {ledgerGoodsEditors(row, goodsRows)}
                        {can("lrs:update") && <button type="button" className="text-xs font-semibold text-brand-700"
                          onClick={() => editLedgerCell(row.id, "goods_rows", [
                            ...goodsRows, { type: "", type_hindi: "", description: "", quantity: "" },
                          ])}>+ Add goods row</button>}
                      </div></td>
                      {canFinanceRead ? <>
                          <td className={cell}>{ledgerField(row, "rent", amountInput(row.rent), "number", "Bhada", "min-h-9 px-1 py-1 text-[11px]")}</td>
                          <td className={cell}>{ledgerField(row, "hamali", amountInput(row.hamali), "number", "Hamali", "min-h-9 px-1 py-1 text-[11px]")}</td>
                      </> : <td className={`${cell} text-muted`} colSpan="2">—</td>}
                      <td className={cell}>{owner
                        ? <label className="flex items-center justify-center gap-1">
                          <input type="checkbox" className="h-4 w-4 accent-brand-700"
                            aria-label={`${row.lr_ref} payment received`}
                            checked={row.payment_status === "paid"} disabled={row.voided || settlementBusy[row.id]
                              || (row.payment_status === "paid" && !row.ledger_settlement_created)}
                            onChange={(event) => setReceiptSettlement(row, event.target.checked)} />
                          <span>{row.payment_status === "paid" ? "Paid" : "Unpaid"}</span>
                        </label>
                        : canFinanceRead ? row.payment_status : "—"}
                        {owner && row.voided && <button type="button" className="mt-1 text-[10px] font-semibold text-brand-700 underline"
                          onClick={() => restoreReceipt(row)}>Restore</button>}
                      </td>
                      <td className={cell}><button className="btn-s min-h-8 min-w-0 px-1 py-1" disabled={row.voided} onClick={() => queuePrint(row)}
                        aria-label={`Print ${row.lr_ref}`}><Printer size={16} /></button></td>
                      <td className={cell}><span title={status} className={status.startsWith("Failed") || status.startsWith("Unsaved")
                        ? "text-red-700" : status === "Saved" ? "text-green-700" : "text-amber-800"}>{conciseLedgerStatus(status)}</span>
                        {status.startsWith("Failed") && <button type="button" className="block underline"
                          onClick={() => status.includes("changed elsewhere")
                            ? reloadLedgerRow(row) : flushLedgerRow(row.id)}>
                          {status.includes("changed elsewhere") ? "Reload row" : "Retry"}
                        </button>}
                        {status.startsWith("Failed") && <details className="text-[10px]">
                          <summary className="cursor-pointer underline">Details</summary>
                          <p className="break-words">{status}</p>
                        </details>}
                      </td>
                      <td className={`${cell} text-center`}>{chargeEditorBadge(row.charge_editor_marker, row.charge_editor_name)}</td>
                    </tr>;
                  })}</tbody>
                </table>
                {!ledgerRows.length && <p className="p-8 text-center text-muted">No receipts found for these filters.</p>}
              </div>
            </Card>
          </>}
          <div className="booking-ledger-print hidden">
            <h1>{user?.branding?.name || user?.tenant_name || site?.name} · Receipt Ledger</h1>
            <p>{[user?.branding?.address, user?.branding?.city, user?.branding?.state,
              user?.branding?.mobile].filter(Boolean).join(" · ")}</p>
            <p>Period: {allDates ? "All dates" : ledgerDate} · Receipts: {ledgerRows.length}</p>
            <table>
              <thead><tr>{["Date", "Trip number", "LR number", "Sender", "Receiver",
                "Goods type · description · quantity", "Bhada", "Hamali", "Payment received", "Charge editor"].map((name) =>
                <th className="border border-black p-1 text-left" key={name}>{name}</th>)}</tr></thead>
              <tbody>{ledgerRows.map((row) => <tr key={row.id}>
                <td className="border border-black p-1">{row.receipt_date || row.operating_date}</td>
                <td className="border border-black p-1">{row.trip_ref}</td>
                <td className="border border-black p-1">{row.lr_ref}</td>
                <td className="border border-black p-1">{row.sender_name}<br />{row.sender_name_hindi}</td>
                <td className="border border-black p-1">{row.receiver_name}<br />{row.receiver_name_hindi}</td>
                <td className="border border-black p-1">{getGoodsRows(row).map((line) =>
                  <div key={`${row.id}-${line.type}-${line.quantity}`}>
                    {line.type}<br />{line.type_hindi}
                    {line.description ? <><br />{line.description}</> : ""} × {line.quantity}
                  </div>)}</td>
                <td className="border border-black p-1">{canFinanceRead ? money(row.rent) : ""}</td>
                <td className="border border-black p-1">{canFinanceRead ? money(row.hamali) : ""}</td>
                <td className="border border-black p-1">{canFinanceRead
                  ? row.voided ? "VOID" : row.payment_status === "paid" ? "Paid" : "Unpaid" : ""}</td>
                <td className="border border-black p-1">{row.charge_editor_marker || ""}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>}
      </div>
      {printReceipt && <ReceiptPrint receipt={printReceipt} trip={selectedTrip} site={site}
        branding={user?.branding} showCharges={canFinanceRead} active />}
    </>
  );
}
