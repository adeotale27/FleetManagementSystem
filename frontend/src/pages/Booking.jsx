import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Banknote, Ban, CalendarDays, Check, ChevronRight, CircleAlert, CircleCheck, CircleHelp,
  Clock3, Download, FileText, Hash, MapPin, Package, Phone, Plus, Printer, Receipt, Search,
  Truck, UserRound, X,
} from "lucide-react";
import { api, errMsg } from "../lib/api";
import { Btn, Card, ErrorState, Loader, PageHead } from "../components/ui";
import { todayISO } from "../lib/format";
import { DEFAULT_BOOKING_GOODS } from "../lib/bookingGoods";
import BookingAudit from "./BookingAudit";
import BookingFinance from "./BookingFinance";

const field = "fld w-full";
const blankGoods = () => Array.from({ length: 3 }, () => ({
  type: "", type_hindi: "", description: "", description_hindi: "", quantity: "",
}));
const isLedgerLocked = (trip) => Boolean(
  trip?.ledger_completion_started_at || trip?.ledger_completed_at,
);
const keyForRequest = () => window.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isHindi = (value) => /[\u0900-\u097f]/.test(value || "");
const commonGoodsHindi = {
  auto: "ऑटो", truck: "ट्रक", nagpur: "नागपुर", pune: "पुणे", mumbai: "मुंबई",
  gadi: "गाड़ी", gaadi: "गाड़ी", bhada: "भाड़ा", bhaada: "भाड़ा",
  "gadi bhada": "गाड़ी भाड़ा", "gaadi bhada": "गाड़ी भाड़ा",
  "gadi bhaada": "गाड़ी भाड़ा", "gaadi bhaada": "गाड़ी भाड़ा",
  "vehicle rent": "गाड़ी भाड़ा", "vehicle rental": "गाड़ी भाड़ा",
  "truck rent": "ट्रक भाड़ा", "truck bhada": "ट्रक भाड़ा",
  "lorry rent": "ट्रक भाड़ा", "lorry bhada": "ट्रक भाड़ा",
  hamali: "हमाली", "receipt charge": "रसीद शुल्क", "receipt charges": "रसीद शुल्क",
  cement: "सीमेंट", "food grains": "अनाज", rice: "चावल", wheat: "गेहूँ",
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
  if (!input) return input;
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
    if (!part || /^\s+$|[-/]/.test(part) || isHindi(part)) return part;
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

function receiptPaymentStatus(receipt) {
  const status = String(receipt.payment_status || "").toLowerCase();
  if (["paid", "partial", "unpaid", "unpriced"].includes(status)) return status;
  if (receipt.rent == null) return "unpriced";
  if (receipt.amount_paid || Number(receipt.outstanding) <= 0) return "paid";
  if (Number(receipt.paid_total) > 0) return "partial";
  return "unpaid";
}

function paymentStatusLabel(status, language = "en") {
  const labels = language === "hi" ? {
    paid: "पूरा भुगतान",
    partial: "कुछ भुगतान",
    unpaid: "भुगतान बाकी",
    unpriced: "दाम नहीं भरा",
  } : {
    paid: "Paid",
    partial: "Partially paid",
    unpaid: "Pending payment",
    unpriced: "Unpriced",
  };
  return labels[status] || labels.unpriced;
}

function paymentStatusSymbol(status) {
  return ({
    paid: "✓",
    partial: "◐",
    unpaid: "!",
    unpriced: "?",
  })[status] || "?";
}

function ledgerColumnLabel(english, language) {
  if (language !== "hi") return english === "Amount paid" ? "Mark money received" : english;
  return ({
    Date: "तारीख",
    "Receipt no.": "रसीद नंबर",
    Sender: "भेजने वाला",
    Receiver: "प्राप्तकर्ता",
    "Goods & quantity": "सामान और मात्रा",
    Bhada: "भाड़ा",
    Hamali: "हमाली",
    "Receipt fee": "रसीद शुल्क",
    "Entered by": "किसने भरा",
    "Amount paid": "पैसे मिलने पर निशान लगाएँ",
    "Mark money received": "पैसे मिलने पर निशान लगाएँ",
  })[english] || english;
}

function paymentStatusClass(status) {
  return ({
    paid: "bg-green-100 text-green-800",
    partial: "bg-amber-100 text-amber-900",
    unpaid: "bg-red-100 text-red-800",
    unpriced: "bg-gray-200 text-gray-700",
  })[status] || "bg-gray-200 text-gray-700";
}

function IconLabel({ icon: Icon, children, className = "" }) {
  return <span className={`inline-flex items-center gap-1.5 ${className}`}>
    <Icon size={18} aria-hidden="true" />
    {children}
  </span>;
}

function PaymentStatusBadge({ status, voided = false, language = "en" }) {
  const Icon = voided ? Ban : ({
    paid: CircleCheck,
    partial: Clock3,
    unpaid: Clock3,
    unpriced: CircleHelp,
  })[status] || CircleAlert;
  const label = voided
    ? (language === "hi" ? "रद्द" : "Voided")
    : paymentStatusLabel(status, language);
  const symbol = voided ? "×" : paymentStatusSymbol(status);
  const styles = voided ? "bg-gray-200 text-gray-800" : paymentStatusClass(status);
  return <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border border-current px-3 py-1 text-sm font-bold ${styles}`}>
    <Icon size={17} aria-hidden="true" />
    <span aria-hidden="true">{symbol}</span>
    {label}
  </span>;
}

function receiptOutstanding(receipt) {
  if (receipt.outstanding != null) return Math.max(Number(receipt.outstanding) || 0, 0);
  if (receipt.rent == null) return 0;
  const due = (Number(receipt.rent) || 0) + (Number(receipt.receipt_fee ?? 2) || 0);
  return Math.max(due - (Number(receipt.paid_total) || 0), 0);
}

function readReceiptDraft(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { draft: null, error: "" };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !saved.form || !Array.isArray(saved.form.goods_rows)) {
      return { draft: null, error: "A saved receipt draft could not be read. Discard it to continue." };
    }
    const textFields = [
      "receipt_date", "sender_name", "sender_address", "receiver_name",
      "receiver_address", "receiver_phone", "rent", "hamali",
    ];
    if (textFields.some((key) => typeof saved.form[key] !== "string")
      || saved.form.goods_rows.some((line) =>
        ["type", "type_hindi", "description", "description_hindi"]
          .some((key) => typeof line?.[key] !== "string")
        || !["string", "number"].includes(typeof line?.quantity))) {
      return { draft: null, error: "A saved receipt draft could not be read. Discard it to continue." };
    }
    return { draft: {
      ...saved.form,
      goods_rows: saved.form.goods_rows.map((line) => ({
        ...line, quantity: String(line.quantity ?? ""),
      })),
    }, error: "" };
  } catch {
    return { draft: null, error: "A saved receipt draft could not be read. Discard it to continue." };
  }
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
    type_hindi: line.type_hindi || "",
    description: line.description || "",
    description_hindi: line.description_hindi || "",
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
  return lines.length ? lines : [{
    type: receipt.goods_type || "",
    type_hindi: receipt.goods_type_hindi || "",
    description: receipt.goods_description || "",
    description_hindi: receipt.goods_description_hindi || "",
    quantity: receipt.total_quantity,
  }];
}

function hindiText(hindi, english) {
  return isHindi(hindi) ? hindi : romanHindi(english || hindi || "");
}

function hindiDigits(value) {
  return String(value ?? "").replace(/[0-9]/g, (digit) => "०१२३४५६७८९"[Number(digit)]);
}

function hindiLedgerGoodsLine(line) {
  const goods = [
    hindiText(line.type_hindi, line.type),
    line.description && hindiText(line.description_hindi, line.description),
  ].filter(Boolean);
  return [hindiDigits(line.quantity), goods.join("/")].filter(Boolean).join(" - ");
}

function englishLedgerGoodsLine(line) {
  const goods = [line.type, line.description].filter(Boolean);
  return [line.quantity, goods.join("/")].filter(Boolean).join(" - ");
}

function ReceiptPrint({ receipt, trip, site, branding, showCharges, controls, active }) {
  if (!receipt) return null;
  const rows = printGoods(receipt);
  const hindi = controls.receipt_language !== "english";
  const label = (hindiValue, englishValue) => hindi ? hindiValue : englishValue;
  const printText = (hindiValue, englishValue) => hindi
    ? hindiText(hindiValue, englishValue) : (englishValue || "");
  const companyName = hindi ? "नायडू गुड्स ट्रांसपोर्ट" : "Naidu Goods Transport";
  const companyAddress = [branding?.address, branding?.city, branding?.state]
    .filter(Boolean).map((part) => hindi ? romanHindi(part) : part).join(", ");
  const contacts = [branding?.mobile, branding?.alt_mobile].filter(Boolean).join(" · ");
  const cityValue = receipt.city || site?.city || "";
  const city = hindi ? romanHindi(cityValue) : cityValue;
  const senderAddress = controls.sender_address_enabled
    ? printText(receipt.sender_address_hindi, receipt.sender_address) : "";
  const receiverAddress = controls.receiver_address_enabled
    ? printText(receipt.receiver_address_hindi, receipt.receiver_address) : "";
  const total = receipt.total_rent ?? Number(receipt.rent || 0) + Number(receipt.hamali || 0)
    + 2;
  return (
    <article className="booking-print-target" data-active={active ? "true" : "false"} lang={hindi ? "hi" : "en"}>
      <div className="receipt-print-header">
        {branding?.logo && <img src={branding.logo} alt="" className="receipt-print-logo" />}
        <div className="receipt-print-contact">{contacts && <span>{label("संपर्क", "Contact")}: {contacts}</span>}</div>
        <div className="receipt-print-company">
          <h1>{companyName}</h1>
          <p>{label("माल रसीद", "GOODS CONSIGNMENT NOTE")}</p>
          {companyAddress && <span>{companyAddress}</span>}
        </div>
      </div>
      <div className="receipt-print-meta">
        <strong>{label("रसीद नंबर", "Receipt No.")}: <span className="receipt-print-number">{receipt.lr_ref}</span></strong>
        <span>{label("दिनांक", "Date")}: {receipt.receipt_date || receipt.operating_date || trip?.operating_date}</span>
        {receiptCreatedTime(receipt.receipt_created_at || receipt.created_at) &&
          <span>{label("समय", "Time")}: {receiptCreatedTime(receipt.receipt_created_at || receipt.created_at)}</span>}
        {city && <span>{label("शहर", "City")}: {city}</span>}
      </div>
      <section className="receipt-print-parties">
        {(receipt.sender_name_hindi || receipt.sender_name || senderAddress) && <div>
          <strong>{label("भेजने वाला", "Sender")}:</strong>
          {printText(receipt.sender_name_hindi, receipt.sender_name)}
          {senderAddress && <span>{senderAddress}</span>}
          {receipt.sender_phone && <span>{label("मोबाइल", "Phone")}: {receipt.sender_phone}</span>}
        </div>}
        {(receipt.receiver_name_hindi || receipt.receiver_name || receiverAddress) && <div>
          <strong>{label("प्राप्त करने वाला", "Receiver")}:</strong>
          {printText(receipt.receiver_name_hindi, receipt.receiver_name)}
          {receiverAddress && <span>{receiverAddress}</span>}
          {receipt.receiver_phone && <span>{label("मोबाइल", "Phone")}: {receipt.receiver_phone}</span>}
        </div>}
      </section>
      <table className="receipt-print-goods">
        <thead><tr><th>{label("माल का विवरण", "Goods description")}</th></tr></thead>
        <tbody><tr><td>{rows.map((line) => hindi
          ? hindiLedgerGoodsLine(line)
          : englishLedgerGoodsLine(line)).join(", ")}</td></tr></tbody>
      </table>
      {showCharges ? <table className="receipt-print-charges">
        <tbody>
          <tr><th>{label("भाड़ा", "Bhada")}</th><td>{money(receipt.rent)}</td></tr>
          <tr><th>{label("हमाली", "Hamali")}</th><td>{money(receipt.hamali)}</td></tr>
          <tr><th>{label("रसीद शुल्क", "Receipt fee")}</th>
            <td>{money(receipt.receipt_fee ?? 2)}</td></tr>
          <tr className="receipt-print-total-row"><th>{label("कुल", "Total")}</th>
            <td>{money(total)}</td></tr>
        </tbody>
      </table> : receipt.total_rent != null &&
        <p className="receipt-print-total">{label("कुल", "Total")}: {money(total)}</p>}
      <p className="receipt-print-footer">{branding?.footer
        ? (hindi ? romanHindi(branding.footer) : branding.footer)
        : label("माल प्राप्त न होने पर कृपया 24 घंटे के भीतर कार्यालय से संपर्क करें।",
          "Please contact the office within 24 hours if the goods are not received.")}</p>
    </article>
  );
}

function ReceiptForm({
  trip, receipt, canEditFinance, addressSuggestions, convertHindi, receiptFee,
  goodsSuggestions, senderAddressEnabled, receiverAddressEnabled, previousReceipts,
  draftScope, language, onCancel, onSaved,
}) {
  const t = (english, hindi) => language === "hi" ? hindi : english;
  const chargesLocked = Boolean(receipt?.amount_paid || receipt?.booking_ledger_paid);
  const draftKey = `booking_receipt_draft:${encodeURIComponent(trip.site_id)}:${encodeURIComponent(trip.id)}:${encodeURIComponent(draftScope)}`;
  const [draftRecovery, setDraftRecovery] = useState(() => readReceiptDraft(draftKey));
  const [draftStatus, setDraftStatus] = useState("");
  const [form, setForm] = useState(() => receipt ? {
    receipt_date: receipt.receipt_date || receipt.operating_date || trip.operating_date,
    sender_name: receipt.sender_name || "",
    sender_address: receipt.sender_address || "",
    receiver_name: receipt.receiver_name || "",
    receiver_address: receipt.receiver_address || "", receiver_phone: receipt.receiver_phone || "",
    goods_rows: getGoodsRows(receipt).map((line) => ({
      ...line,
      type: [line.type, line.description].filter(Boolean).join(" "),
      type_hindi: [line.type_hindi, line.description_hindi].filter(Boolean).join(" "),
      description: "",
      description_hindi: "",
    })),
    rent: receipt.rent ?? "0", hamali: receipt.hamali ?? "0",
  } : {
    receipt_date: trip.operating_date, sender_name: "", sender_address: "",
    receiver_name: "", receiver_address: "", receiver_phone: "",
    goods_rows: blankGoods(), rent: "0", hamali: "0",
  });
  const [error, setError] = useState("");
  const [receiverMatch, setReceiverMatch] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveKey] = useState(keyForRequest);
  useEffect(() => {
    if (receipt || draftRecovery.draft || draftRecovery.error) return;
    const hasContent = Boolean(
      form.sender_name.trim() || form.sender_address.trim() || form.receiver_name.trim()
      || form.receiver_address.trim() || form.receiver_phone
      || form.goods_rows.some((line) => line.type.trim() || line.quantity)
      || form.rent !== "0" || form.hamali !== "0"
      || form.receipt_date !== trip.operating_date
    );
    try {
      if (hasContent) {
        window.localStorage.setItem(draftKey, JSON.stringify({ version: 1, form }));
        setDraftStatus(t("Draft saved locally on this device.", "अधूरी रसीद इस डिवाइस में सेव है।"));
      } else {
        window.localStorage.removeItem(draftKey);
        setDraftStatus("");
      }
      setDraftRecovery((current) => ({ ...current, error: "" }));
    } catch {
      setDraftStatus(t("Draft could not be saved on this device.", "अधूरी रसीद इस डिवाइस में सेव नहीं हो सकी।"));
    }
  }, [draftKey, draftRecovery.draft, form, language, receipt, trip.operating_date]);
  const patch = (values) => setForm((current) => ({ ...current, ...values }));
  const discardDraft = () => {
    try {
      window.localStorage.removeItem(draftKey);
      setDraftRecovery({ draft: null, error: "" });
      setDraftStatus("");
    } catch {
      setDraftStatus(t("Draft could not be removed from this device.", "अधूरी रसीद इस डिवाइस से हटाई नहीं जा सकी।"));
    }
  };
  const copyPreviousReceipt = (previousReceipt) => {
    const previousGoods = getGoodsRows(previousReceipt)
      .filter((line) => line.type || line.description)
      .map((line) => ({
        ...line,
        type: [line.type, line.description].filter(Boolean).join(" "),
        type_hindi: [line.type_hindi, line.description_hindi].filter(Boolean).join(" "),
        description: "",
        description_hindi: "",
        quantity: String(line.quantity ?? ""),
      }));
    patch({
      sender_name: previousReceipt.sender_name || "",
      sender_address: previousReceipt.sender_address || "",
      receiver_name: previousReceipt.receiver_name || "",
      receiver_address: previousReceipt.receiver_address || "",
      receiver_phone: previousReceipt.receiver_phone || "",
      goods_rows: previousGoods.length ? previousGoods : blankGoods(),
      rent: "0",
      hamali: "0",
    });
  };
  const choosePreviousReceiver = (receiptId) => {
    const previousReceipt = previousReceipts.find((item) => item.id === receiptId);
    if (!previousReceipt) return;
    patch({
      receiver_name: previousReceipt.receiver_name || "",
      receiver_phone: previousReceipt.receiver_phone || "",
    });
  };
  const changeGoods = (index, key, value) => {
    setForm((current) => ({ ...current, goods_rows: current.goods_rows.map((line, row) =>
      row === index ? { ...line, [key]: value } : line) }));
  };
  const save = async (event, printAfter = false, matchChoice = null) => {
    event?.preventDefault();
    if (savingRef.current) return;
    setError("");
    const goods = form.goods_rows.filter((line) => line.type.trim() && Number(line.quantity) > 0);
    if (!form.receiver_name.trim() || !goods.length) {
      setError(t("Enter the receiver and at least one goods row.", "प्राप्तकर्ता का नाम और कम से कम एक सामान भरें।"));
      return;
    }
    if (window.navigator.onLine === false) {
      setError(t("Offline — receipt not saved. Keep this form open and tap Save when you’re back online.",
        "इंटरनेट नहीं है — रसीद सेव नहीं हुई। यह फ़ॉर्म खुला रखें और इंटरनेट आने पर सेव करें।"));
      return;
    }
    if (goods.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0)) {
      setError(t("Goods quantity must be a whole number greater than zero.",
        "सामान की मात्रा शून्य से बड़ी पूरी संख्या होनी चाहिए।"));
      return;
    }
    if (form.receiver_phone && form.receiver_phone.length !== 10) {
      setError(t("Receiver phone must contain exactly 10 digits.",
        "प्राप्तकर्ता का फ़ोन नंबर ठीक 10 अंकों का होना चाहिए।"));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const body = {
      receipt_date: form.receipt_date,
      sender_name: form.sender_name.trim(),
      sender_name_hindi: convertHindi ? romanHindi(form.sender_name) : form.sender_name.trim(),
      receiver_name: form.receiver_name.trim(),
      receiver_name_hindi: convertHindi ? romanHindi(form.receiver_name) : form.receiver_name.trim(),
      city: "Hinganghat", receiver_phone: form.receiver_phone.trim(),
      ...(senderAddressEnabled ? {
        sender_address: form.sender_address.trim(),
        sender_address_hindi: convertHindi ? romanHindi(form.sender_address) : form.sender_address.trim(),
      } : {}),
      ...(receiverAddressEnabled ? {
        receiver_address: form.receiver_address.trim(),
        receiver_address_hindi: convertHindi ? romanHindi(form.receiver_address) : form.receiver_address.trim(),
      } : {}),
      goods_rows: goods.map((line) => ({
        type: line.type.trim(), type_hindi: convertHindi ? romanHindi(line.type) : line.type.trim(),
        description: "",
        description_hindi: "",
        quantity: Number(line.quantity),
      })),
      ...(canEditFinance ? {
        rent: form.rent === "" ? "0" : form.rent || "0",
        hamali: form.hamali === "" ? "0" : form.hamali || "0",
      } : {}),
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
      if (!receipt) discardDraft();
      setReceiverMatch(null);
      await onSaved(response.data, printAfter);
    } catch (requestError) {
      const detail = requestError?.response?.data?.detail;
      if (detail?.code === "receiver_match_confirmation_required") {
        setReceiverMatch(detail);
        setError(detail.message || t("Choose whether this is the same receiver or a different receiver.",
          "बताएँ कि यह वही प्राप्तकर्ता है या कोई दूसरा।"));
      } else if (window.navigator.onLine === false) {
        setError(t("Offline — receipt not saved. Keep this form open and tap Save when you’re back online.",
          "इंटरनेट नहीं है — रसीद सेव नहीं हुई। यह फ़ॉर्म खुला रखें और इंटरनेट आने पर सेव करें।"));
      } else {
        setError(errMsg(requestError));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const rentTotal = Number(form.rent) || 0;
  const hamaliTotal = Number(form.hamali) || 0;
  const fee = receipt ? Number(receipt.receipt_fee) || 0 : receiptFee;
  const total = rentTotal + hamaliTotal + fee;

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">{receipt ? t("Edit receipt", "रसीद बदलें") : t("New receipt", "नई रसीद")}</h2>
          <p className="mt-1 text-sm text-muted">{t("Trip", "यात्रा")} {trip.trip_ref} · {trip.operating_date}</p></div>
        <button type="button" onClick={onCancel} aria-label={t("Close receipt form", "रसीद फ़ॉर्म बंद करें")} className="rounded-lg p-2 hover:bg-canvas"><X size={20} /></button>
      </div>
      {!receipt && draftRecovery.draft && <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="font-semibold">{t("A saved receipt draft is available for this trip.", "इस यात्रा की अधूरी रसीद इस डिवाइस में सेव है।")}</p>
        <p className="mt-1 text-sm text-muted">{t("Drafts are stored locally on this device and are not sent until you save.",
          "यह रसीद इसी डिवाइस में रहेगी। सेव करने पर ही भेजी जाएगी।")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-p" onClick={() => {
            setForm((current) => ({ ...current, ...draftRecovery.draft }));
            setDraftRecovery({ draft: null, error: "" });
            setDraftStatus(t("Draft restored from this device.", "अधूरी रसीद वापस खोल दी गई।"));
          }}>{t("Resume draft", "अधूरी रसीद खोलें")}</button>
          <button type="button" className="btn-s" onClick={discardDraft}>{t("Discard draft", "अधूरी रसीद मिटाएँ")}</button>
        </div>
      </section>}
      {!receipt && !draftRecovery.draft && draftRecovery.error && <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-amber-900">
        <span>{t(draftRecovery.error, "डिवाइस में सेव अधूरी रसीद पढ़ी नहीं जा सकी। आगे बढ़ने के लिए इसे मिटाएँ।")}</span>
        <button type="button" className="underline" onClick={discardDraft}>{t("Discard unreadable draft", "न पढ़ी जा सकने वाली अधूरी रसीद मिटाएँ")}</button>
      </div>}
      {!receipt && (draftStatus || draftRecovery.error) && <p role="status" className="mb-3 text-sm text-muted">
        {draftRecovery.error
          ? t(draftRecovery.error, "डिवाइस में सेव अधूरी रसीद पढ़ी नहीं जा सकी। आगे बढ़ने के लिए इसे मिटाएँ.")
          : draftStatus}
      </p>}
      {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</div>}
      {receiverMatch && <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h3 className="font-bold">{t("Check the receiver before saving", "सेव करने से पहले प्राप्तकर्ता जाँचें")}</h3>
        <p className="mt-1 text-sm">{receiverMatch.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(receiverMatch.matches || []).map((match) => <button key={match.id} type="button" className="btn-s"
            disabled={saving} onClick={() => save(null, false, { action: "same", identityId: match.id })}>
            {t("Same receiver:", "वही प्राप्तकर्ता:")} {match.label || match.name}
          </button>)}
          <button type="button" className="btn-s" disabled={saving}
            onClick={() => save(null, false, { action: "different" })}>
            {t("Different receiver", "दूसरा प्राप्तकर्ता")}
          </button>
        </div>
      </section>}
      <form onSubmit={(event) => save(event)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="lbl">{t("Receipt date", "रसीद की तारीख")}</span><input className={field} type="date" required
            value={form.receipt_date} onChange={(event) => patch({ receipt_date: event.target.value })} /></label>
          <div className="rounded-lg bg-canvas px-3 py-3 text-sm"><span className="lbl">{t("Trip number", "यात्रा नंबर")}</span><strong>{trip.trip_ref}</strong></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label><span className="lbl flex items-center gap-2"><UserRound size={16} aria-hidden="true" />{t("Sender (optional)", "भेजने वाला (ज़रूरी नहीं)")}</span><input className={field} aria-label={t("Sender name in English", "भेजने वाले का नाम")}
            value={form.sender_name} onChange={(event) => patch({ sender_name: event.target.value })} /></label>
          <label><span className="lbl flex items-center gap-2"><UserRound size={16} aria-hidden="true" />{t("Receiver *", "प्राप्तकर्ता *")}</span><input className={field} required aria-label={t("Receiver name in English", "प्राप्तकर्ता का नाम")}
            list={!receipt && previousReceipts.length ? "previous-receiver-options" : undefined}
            value={form.receiver_name} onChange={(event) => patch({ receiver_name: event.target.value })} />
            {!receipt && previousReceipts.length > 0 && <datalist id="previous-receiver-options">
              {[...new Set(previousReceipts.map((item) => item.receiver_name).filter(Boolean))].map((name) =>
                <option key={name} value={name} />)}
            </datalist>}
          </label>
        </div>
        {!receipt && previousReceipts.length > 0 && <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-56 flex-1"><span className="lbl">{t("Use a previous receiver", "पहले का प्राप्तकर्ता चुनें")}</span>
            <select className={field} aria-label={t("Use a previous receiver", "पहले का प्राप्तकर्ता चुनें")} defaultValue=""
              onChange={(event) => choosePreviousReceiver(event.target.value)}>
              <option value="">{t("Choose a saved receiver", "सेव किए प्राप्तकर्ता को चुनें")}</option>
              {previousReceipts.filter((item) => item.receiver_name).map((item) =>
                <option key={item.id} value={item.id}>
                  {item.receiver_name}{item.receiver_phone ? ` · ${item.receiver_phone}` : ""}
                </option>)}
            </select>
          </label>
          <button type="button" className="btn-s min-h-11" onClick={() => copyPreviousReceipt(previousReceipts[0])}>
            <FileText size={16} /> {t("Copy previous receipt", "पिछली रसीद की जानकारी लें")}
          </button>
        </div>}
        {senderAddressEnabled && <label className="block"><span className="lbl flex items-center gap-2"><MapPin size={16} aria-hidden="true" />{t("Sender address (optional)", "भेजने वाले का पता (ज़रूरी नहीं)")}</span><input className={field} aria-label={t("Sender address (optional)", "भेजने वाले का पता (ज़रूरी नहीं)")} list="sender-address-options"
          value={form.sender_address} onChange={(event) => patch({ sender_address: event.target.value })} />
          <datalist id="sender-address-options">{addressSuggestions.sender.map((address) =>
            <option key={address} value={address} />)}</datalist></label>}
        <div className="grid gap-4 md:grid-cols-2">
          {receiverAddressEnabled && <label><span className="lbl flex items-center gap-2"><MapPin size={16} aria-hidden="true" />{t("Receiver address (optional)", "प्राप्तकर्ता का पता (ज़रूरी नहीं)")}</span><input className={field} aria-label={t("Receiver address (optional)", "प्राप्तकर्ता का पता (ज़रूरी नहीं)")} list="receiver-address-options"
            value={form.receiver_address} onChange={(event) => patch({ receiver_address: event.target.value })} />
            <datalist id="receiver-address-options">{addressSuggestions.receiver.map((address) =>
              <option key={address} value={address} />)}</datalist></label>}
          <label className={receiverAddressEnabled ? "" : "md:col-start-1"}>
            <span className="lbl flex items-center gap-2"><Phone size={16} aria-hidden="true" />{t("Receiver phone (10 digits, optional)", "प्राप्तकर्ता का फ़ोन (10 अंक, ज़रूरी नहीं)")}</span>
            <input className={field} type="tel" inputMode="numeric" maxLength={10} pattern="[0-9]{10}"
              value={form.receiver_phone} aria-label={t("Receiver phone (10 digits, optional)", "प्राप्तकर्ता का फ़ोन (10 अंक, ज़रूरी नहीं)")}
              onChange={(event) => patch({ receiver_phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label><span className="lbl flex items-center gap-2"><MapPin size={16} aria-hidden="true" />{t("Receiver city", "प्राप्तकर्ता का शहर")}</span>
            <select className={field} value="Hinganghat" disabled>
              <option value="Hinganghat">Hinganghat</option>
            </select></label>
        </div>
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">{t("Goods", "सामान")}</h3>
            <button type="button" className="btn-s" onClick={() => patch({ goods_rows: [...form.goods_rows, {
              type: "", type_hindi: "", description: "", description_hindi: "", quantity: "",
            }] })}>
              <Plus size={17} /> {t("Add good", "सामान जोड़ें")}
            </button>
          </div>
          <div className="space-y-2">
            {form.goods_rows.map((line, index) => <div key={index}
              className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-start gap-2 rounded-xl border border-line p-2 sm:grid-cols-[2rem_minmax(0,1fr)_10rem_2.25rem]">
              <span className="hidden pt-3 text-center font-semibold sm:block">{index + 1}</span>
              <label className="relative col-start-1 row-start-1 block min-w-0 sm:col-start-2">
                <span className="lbl">{t("Goods and description", "सामान का नाम")} · {index + 1}</span>
                <span className="relative block">
                  <Package size={16} aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted" />
                  <input className={`${field} min-h-12 pl-9`} list="booking-goods-suggestions" value={line.type}
                    placeholder={t("Goods and description", "सामान का नाम")} aria-label={language === "hi"
                      ? `${t("Goods and description", "सामान का नाम")} · ${index + 1}`
                      : `Goods and description row ${index + 1}`}
                    onChange={(event) => changeGoods(index, "type", event.target.value)} />
                </span>
              </label>
              <label className="relative col-start-1 row-start-2 block sm:col-start-3 sm:row-start-1">
                <span className="lbl">{t("Quantity", "मात्रा")}</span>
                <span className="relative block">
                  <Hash size={16} aria-hidden="true"
                    className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 text-muted" />
                  <input className={`${field} min-h-12 pl-8`} type="number" min="1" step="1" inputMode="numeric" placeholder={t("Enter quantity", "मात्रा लिखें")}
                    aria-label={language === "hi" ? `${t("Quantity", "मात्रा")} · ${index + 1}` : `Quantity row ${index + 1}`}
                    value={line.quantity}
                    onChange={(event) => changeGoods(index, "quantity", event.target.value)} />
                </span>
              </label>
              <button type="button" aria-label={`${t("Remove goods row", "सामान हटाएँ")} ${index + 1}`} className="col-start-2 row-start-1 self-end rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-700 sm:col-start-4 sm:row-start-1"
                onClick={() => {
                  setForm((current) => ({
                    ...current,
                    goods_rows: current.goods_rows.length > 1
                      ? current.goods_rows.filter((_, rowIndex) => rowIndex !== index)
                      : blankGoods(),
                  }));
                }}>
                <X size={18} />
              </button>
            </div>)}
          </div>
          <datalist id="booking-goods-suggestions">
            {goodsSuggestions.map((value) => <option key={value} value={value} />)}
          </datalist>
        </section>
        {canEditFinance && <section className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
          {chargesLocked && <p className="text-sm text-amber-800 sm:col-span-2">
            {t("Untick Amount paid before changing Bhada or Hamali.", "भाड़ा या हमाली बदलने से पहले ‘पैसे मिले’ का निशान हटाएँ।")}
          </p>}
          <label><span className="lbl"><IconLabel icon={Banknote}>{t("Bhada (₹)", "भाड़ा (₹)")}</IconLabel></span><input className={field} type="number" min="0"
            step="0.01" inputMode="decimal" aria-label={t("Receipt Bhada", "रसीद का भाड़ा")}
            disabled={chargesLocked}
            value={amountInput(form.rent)} onChange={(event) => patch({ rent: event.target.value })} /></label>
          <label><span className="lbl"><IconLabel icon={Banknote}>{t("Hamali (₹)", "हमाली (₹)")}</IconLabel></span><input className={field} type="number" min="0"
            step="0.01" inputMode="decimal" aria-label={t("Receipt Hamali", "रसीद की हमाली")}
            disabled={chargesLocked}
            value={amountInput(form.hamali)} onChange={(event) => patch({ hamali: event.target.value })} /></label>
        </section>}
        <section className="rounded-xl bg-brand-50 p-4">
          <h3 className="text-lg font-bold"><IconLabel icon={Receipt}>{t("Receipt total", "रसीद का हिसाब")}</IconLabel></h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <p><IconLabel icon={Banknote}>{t("Bhada:", "भाड़ा:")}</IconLabel> <strong>{money(rentTotal)}</strong></p>
            <p><IconLabel icon={Banknote}>{t("Hamali:", "हमाली:")}</IconLabel> <strong>{money(hamaliTotal)}</strong></p>
            <p><IconLabel icon={Receipt}>{t("Receipt fee:", "रसीद शुल्क:")}</IconLabel> <strong>{money(fee)}</strong> {t("(fixed)", "(तय)")}</p>
          </div>
          <p className="mt-2 flex justify-between text-xl font-bold">
            <IconLabel icon={Receipt}>{t("Total amount", "कुल रकम")}</IconLabel><span>{money(total)}</span>
          </p>
        </section>
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_20px_rgba(16,24,40,0.08)] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-0 sm:shadow-none sm:backdrop-blur-none">
          <button type="button" disabled={saving} onClick={onCancel} className="btn-s min-h-12 flex-1 text-base">
            {receipt ? t("Cancel editing", "बदलाव रद्द करें") : t("Cancel receipt", "रसीद रद्द करें")}
          </button>
          <Btn type="submit" disabled={saving} className="min-h-12 flex-1 text-base">
            {saving ? t("Saving…", "सेव हो रहा है…") : receipt ? t("Save changes", "बदलाव सेव करें") : t("Save receipt", "रसीद सेव करें")}
          </Btn>
          <button type="button" disabled={saving} onClick={(event) => save(event, true)} className="btn-s min-h-12 flex-1 text-base">
            <Printer size={18} /> {t("Print paper (saves receipt first)", "प्रिंट निकालें (पहले रसीद सेव होगी)")}
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
  const [language, setLanguage] = useState(() =>
    localStorage.getItem("booking_language") === "hi" ? "hi" : "en");
  const t = (english, hindi) => language === "hi" ? hindi : english;
  useEffect(() => {
    localStorage.setItem("booking_language", language);
  }, [language]);
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState(localStorage.getItem("booking_site_id") || "");
  const [siteError, setSiteError] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [todaySummary, setTodaySummary] = useState({
    key: "", receiptCount: 0, outstanding: 0, loading: false, error: "",
  });
  const [todaySummaryRetry, setTodaySummaryRetry] = useState(0);
  const [tripSearch, setTripSearch] = useState("");
  const [tripStatusFilter, setTripStatusFilter] = useState("all");
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptPaymentFilter, setReceiptPaymentFilter] = useState("all");
  const [receiptStateFilter, setReceiptStateFilter] = useState("all");
  const [tripCloseoutOpen, setTripCloseoutOpen] = useState(false);
  const [tripError, setTripError] = useState("");
  const [tripLoading, setTripLoading] = useState(false);
  const [tripFormOpen, setTripFormOpen] = useState(false);
  const [tripForm, setTripForm] = useState({ date: todayISO(), truck_no: "", driver_name: "" });
  const [tripEditOpen, setTripEditOpen] = useState(false);
  const [tripEditForm, setTripEditForm] = useState({ truck_no: "", driver_name: "" });
  const [tripEditSaving, setTripEditSaving] = useState(false);
  const [tripDeleting, setTripDeleting] = useState(false);
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);
  const [receiptFormVersion, setReceiptFormVersion] = useState(0);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [printReceipt, setPrintReceipt] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [success, setSuccess] = useState("");
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerTrips, setLedgerTrips] = useState([]);
  const [ledgerTripId, setLedgerTripId] = useState("");
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [ledgerLoadedKey, setLedgerLoadedKey] = useState("");
  const [ledgerCompleting, setLedgerCompleting] = useState(false);
  const [paidRowsUpdating, setPaidRowsUpdating] = useState(() => new Set());
  const [ledgerError, setLedgerError] = useState("");
  const [ledgerDate, setLedgerDate] = useState(todayISO());
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerPaymentFilter, setLedgerPaymentFilter] = useState("all");
  const [ledgerStateFilter, setLedgerStateFilter] = useState("all");
  const [ledgerCompletionReviewOpen, setLedgerCompletionReviewOpen] = useState(false);
  const [ledgerStatus, setLedgerStatus] = useState({});
  const dirtyRows = useRef({});
  const saveTimers = useRef({});
  const savingRows = useRef(new Set());
  const queuedRows = useRef(new Set());
  const flushLedgerRowRef = useRef(null);
  const revisions = useRef({});
  const rowVersions = useRef({});
  const ledgerRowCache = useRef({});
  const tripsCache = useRef(new Map());
  const todaySummaryRequest = useRef(0);
  const receiptsCache = useRef(new Map());
  const tripsRequestVersions = useRef(new Map());
  const receiptsRequestVersions = useRef(new Map());
  const activeTripsRequest = useRef("");
  const activeReceiptsRequest = useRef("");
  const ledgerTripsRequest = useRef(0);
  const activeLedgerRequest = useRef(0);
  const restoredTripId = useRef("");
  const previousPage = useRef(page);
  const site = sites.find((item) => item.id === siteId);
  const ledgerTrip = ledgerTrips.find((trip) => trip.id === ledgerTripId);
  const ledgerSummaryKey = `${siteId}:${ledgerDate}:${ledgerTripId}`;
  const ledgerSummaryReady = Boolean(ledgerTripId) && ledgerLoadedKey === ledgerSummaryKey;
  const ledgerTotals = useMemo(() => {
    const totals = ledgerRows.reduce((value, row) => {
      if (row.voided) return value;
      value.bhada += Math.round((Number(row.rent) || 0) * 100);
      value.hamali += Math.round((Number(row.hamali) || 0) * 100);
      value.receiptFee += Math.round((Number(row.receipt_fee ?? 2) || 0) * 100);
      value.paid += Math.round((Number(row.paid_total) || 0) * 100);
      value.outstanding += Math.round(receiptOutstanding(row) * 100);
      if (receiptPaymentStatus(row) === "unpriced") value.unpriced += 1;
      value.count += 1;
      return value;
    }, { bhada: 0, hamali: 0, receiptFee: 0, paid: 0, outstanding: 0, count: 0, unpriced: 0 });
    return {
      bhada: totals.bhada / 100,
      hamali: totals.hamali / 100,
      receiptFee: totals.receiptFee / 100,
      paid: totals.paid / 100,
      outstanding: totals.outstanding / 100,
      count: totals.count,
      unpriced: totals.unpriced,
      total: (totals.bhada + totals.hamali + totals.receiptFee) / 100,
    };
  }, [ledgerRows]);
  const filteredTrips = useMemo(() => {
    const query = tripSearch.trim().toLowerCase();
    return trips.filter((trip) => {
      const matchesQuery = !query || [
        trip.trip_ref, trip.truck_no, trip.driver_name,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesStatus = tripStatusFilter === "all" || trip.status === tripStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [trips, tripSearch, tripStatusFilter]);
  const openTodayTrips = trips.filter((trip) => trip.status === "open");
  const todaySummaryCurrent = todaySummary.key === `${siteId}:${selectedDate}`;
  const filteredReceipts = useMemo(() => {
    const query = receiptSearch.trim().toLowerCase();
    return receipts.filter((receipt) => {
      const goods = getGoodsRows(receipt).flatMap((line) => [
        line.type, line.type_hindi, line.description, line.description_hindi,
      ]).join(" ");
      const matchesQuery = !query || [
        receipt.lr_ref, receipt.sender_name, receipt.receiver_name, receipt.receiver_phone, goods,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesPayment = receiptPaymentFilter === "all"
        || (!receipt.voided && receiptPaymentStatus(receipt) === receiptPaymentFilter);
      const matchesState = receiptStateFilter === "all"
        || (receiptStateFilter === "voided" ? receipt.voided : !receipt.voided);
      return matchesQuery && matchesPayment && matchesState;
    });
  }, [receipts, receiptSearch, receiptPaymentFilter, receiptStateFilter]);
  const filteredLedgerRows = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();
    return ledgerRows.filter((row) => {
      const goods = getGoodsRows(row).flatMap((line) => [
        line.type, line.type_hindi, line.description, line.description_hindi,
      ]).join(" ");
      const matchesQuery = !query || [
        row.lr_ref, row.sender_name, row.receiver_name, row.receiver_phone, goods,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesPayment = ledgerPaymentFilter === "all"
        || (!row.voided && receiptPaymentStatus(row) === ledgerPaymentFilter);
      const matchesState = ledgerStateFilter === "all"
        || (ledgerStateFilter === "voided" ? row.voided : !row.voided);
      return matchesQuery && matchesPayment && matchesState;
    });
  }, [ledgerRows, ledgerSearch, ledgerPaymentFilter, ledgerStateFilter]);
  const tripCloseoutSummary = useMemo(() => receipts.reduce((summary, receipt) => {
    if (receipt.voided) {
      summary.voided += 1;
      return summary;
    }
    summary.count += 1;
    if (receiptPaymentStatus(receipt) === "unpriced") summary.unpriced += 1;
    summary.charges += Number(receipt.total_rent)
      || (Number(receipt.rent) || 0) + (Number(receipt.hamali) || 0)
        + (Number(receipt.receipt_fee ?? 2) || 0);
    summary.paid += Number(receipt.paid_total) || 0;
    summary.outstanding += receiptOutstanding(receipt);
    return summary;
  }, { count: 0, voided: 0, unpriced: 0, charges: 0, paid: 0, outstanding: 0 }), [receipts]);
  const permissions = user?.site_permissions?.[siteId] || [];
  const can = (permission) => owner || permissions.includes(permission);
  const nextReceiptTrip = trips.find((trip) => trip.status === "open"
    && !isLedgerLocked(trip) && can("lrs:create"));
  const canFinanceRead = can("finance:read") || can("finance:update") || can("lrs:create") || can("lrs:update");
  const canEditFinance = can("lrs:update");
  const receiptControls = site?.config?.receipt_controls || {};
  const goodsSuggestions = Array.isArray(site?.config?.goods_suggestions)
    ? site.config.goods_suggestions : DEFAULT_BOOKING_GOODS;
  const convertHindi = receiptControls.hindi_conversion_enabled !== false;
  const receiptFee = Number(receiptControls.receipt_fee ?? 2);
  const receiptLanguage = receiptControls.receipt_language === "english" ? "english" : "hindi";
  const senderAddressEnabled = receiptControls.sender_address_enabled !== false;
  const receiverAddressEnabled = receiptControls.receiver_address_enabled !== false;

  useEffect(() => {
    if (page === "dashboard" && previousPage.current !== "dashboard") {
      setSelectedDate(todayISO());
    }
    previousPage.current = page;
  }, [page]);

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
      const params = {
        from_date: dateValue, to_date: dateValue, limit: 100, offset: 0,
      };
      const response = await api.get(`/sites/${targetSite}/trips`, { params });
      let rows = response.data.rows || [];
      const total = Math.min(Number(response.data.total) || rows.length, 10000);
      const offsets = [];
      for (let offset = rows.length; offset < total; offset += 100) offsets.push(offset);
      if (offsets.length) {
        const pages = await Promise.all(offsets.map((offset) =>
          api.get(`/sites/${targetSite}/trips`, { params: { ...params, offset } })));
        rows = rows.concat(...pages.map((page) => page.data.rows || []));
      }
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
    if (!targetTrip) {
      setReceipts([]);
      setReceiptsLoading(false);
      setReceiptsError("");
      return;
    }
    const cacheKey = `${targetTrip.site_id}:${targetTrip.id}`;
    activeReceiptsRequest.current = cacheKey;
    const requestVersion = (receiptsRequestVersions.current.get(cacheKey) || 0) + 1;
    receiptsRequestVersions.current.set(cacheKey, requestVersion);
    const cachedReceipts = receiptsCache.current.get(cacheKey);
    setReceipts(cachedReceipts || []);
    setReceiptsLoading(true);
    setReceiptsError("");
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
      if (offsets.length) {
        const pages = await Promise.all(offsets.map((offset) =>
          api.get(path, { params: { limit: 100, offset } })));
        rows = rows.concat(...pages.map((page) => page.data.rows || []));
        if (receiptsRequestVersions.current.get(cacheKey) === requestVersion) {
          receiptsCache.current.set(cacheKey, rows);
          if (activeReceiptsRequest.current === cacheKey) setReceipts(rows);
        }
      }
    } catch (requestError) {
      if (receiptsRequestVersions.current.get(cacheKey) === requestVersion
        && activeReceiptsRequest.current === cacheKey) {
        setReceiptsError(errMsg(requestError));
        setTripError(errMsg(requestError));
      }
    } finally {
      if (receiptsRequestVersions.current.get(cacheKey) === requestVersion
        && activeReceiptsRequest.current === cacheKey) setReceiptsLoading(false);
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
    const requestId = ++todaySummaryRequest.current;
    const key = `${siteId}:${selectedDate}`;
    if (page !== "dashboard" || !siteId || !canFinanceRead) {
      setTodaySummary({ key, receiptCount: 0, outstanding: null, loading: false, error: "" });
      return () => {
        if (todaySummaryRequest.current === requestId) todaySummaryRequest.current += 1;
      };
    }
    setTodaySummary({ key, receiptCount: 0, outstanding: 0, loading: true, error: "" });
    const loadSummary = async () => {
      try {
        const path = `/sites/${siteId}/ledger/entries`;
        const params = { from_date: selectedDate, to_date: selectedDate, limit: 1000, offset: 0 };
        const first = await api.get(path, { params });
        let rows = first.data.rows || [];
        const total = Math.min(Number(first.data.total) || rows.length, 10000);
        const offsets = [];
        for (let offset = rows.length; offset < total; offset += 1000) offsets.push(offset);
        if (offsets.length) {
          const pages = await Promise.all(offsets.map((offset) =>
            api.get(path, { params: { ...params, offset } })));
          rows = rows.concat(...pages.map((response) => response.data.rows || []));
        }
        if (requestId !== todaySummaryRequest.current) return;
        const activeRows = rows.filter((row) => !row.voided);
        const outstandingCents = activeRows.reduce((totalCents, row) =>
          totalCents + Math.round(receiptOutstanding(row) * 100), 0);
        setTodaySummary({
          key, receiptCount: activeRows.length, outstanding: outstandingCents / 100,
          loading: false, error: "",
        });
      } catch (requestError) {
        if (requestId === todaySummaryRequest.current) {
          setTodaySummary({ key, receiptCount: 0, outstanding: null, loading: false, error: errMsg(requestError) });
        }
      }
    };
    loadSummary();
    return () => {
      if (todaySummaryRequest.current === requestId) todaySummaryRequest.current += 1;
    };
  }, [page, siteId, selectedDate, canFinanceRead, todaySummaryRetry]);

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
      setReceiptFormOpen(response.data.status === "open" && can("lrs:create"));
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
    setLedgerTripId("");
    setLedgerTrips([]);
    setLedgerRows([]);
    setTrips(tripsCache.current.get(`${value}:${selectedDate}`) || []);
    setTripError("");
    setSelectedTrip(null);
    localStorage.removeItem("booking_trip_id");
    setReceipts([]);
  };
  const openTrip = async (trip) => {
    setSelectedTrip(trip);
    setSelectedDate(trip.operating_date);
    localStorage.setItem("booking_trip_id", trip.id);
    setReceiptFormOpen(trip.status === "open" && can("lrs:create"));
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
      setReceiptFormOpen(trip.status === "open" && can("lrs:create"));
      localStorage.setItem("booking_trip_id", trip.id);
      await refreshTrips(trip.operating_date, siteId);
      navigate("/booking/receipts");
    } catch (requestError) { setTripError(errMsg(requestError)); }
  };
  const openTripEditor = () => {
    if (!selectedTrip) return;
    setTripEditForm({
      truck_no: selectedTrip.truck_no || "",
      driver_name: selectedTrip.driver_name || "",
    });
    setTripEditOpen(true);
    setTripError("");
  };
  const saveTripDetails = async (event) => {
    event.preventDefault();
    if (!selectedTrip || tripEditSaving) return;
    setTripEditSaving(true);
    setTripError("");
    const changes = {};
    if (tripEditForm.truck_no.trim()) changes.truck_no = tripEditForm.truck_no.trim();
    if (tripEditForm.driver_name.trim()) changes.driver_name = tripEditForm.driver_name.trim();
    try {
      const response = await api.patch(
        `/sites/${siteId}/trips/${selectedTrip.id}`,
        changes,
      );
      const updatedTrip = { ...selectedTrip, ...response.data };
      setSelectedTrip(updatedTrip);
      const cacheKey = `${siteId}:${selectedTrip.operating_date}`;
      const updateTrip = (trip) => trip.id === updatedTrip.id ? { ...trip, ...updatedTrip } : trip;
      const cachedTrips = tripsCache.current.get(cacheKey);
      if (cachedTrips) tripsCache.current.set(cacheKey, cachedTrips.map(updateTrip));
      setTrips((current) => current.map(updateTrip));
      setTripEditOpen(false);
      setSuccess(`Trip details saved: ${updatedTrip.trip_ref}.`);
    } catch (requestError) {
      setTripError(errMsg(requestError));
    } finally {
      setTripEditSaving(false);
    }
  };
  const deleteTrip = async () => {
    if (!owner || !selectedTrip || tripDeleting || tripEditSaving) return;
    if (!window.confirm(
      `Delete trip ${selectedTrip.trip_ref}? Empty trips are deleted; trips with receipts can only be archived when every receipt is void. Financial history will be preserved.`,
    )) return;
    setTripDeleting(true);
    setTripError("");
    try {
      const response = await api.delete(`/sites/${siteId}/trips/${selectedTrip.id}`);
      localStorage.removeItem("booking_trip_id");
      setSelectedTrip(null);
      setReceipts([]);
      setEditingReceipt(null);
      setReceiptFormOpen(false);
      setTripEditOpen(false);
      setSuccess(response.data?.archived
        ? `Trip ${selectedTrip.trip_ref} was archived. Its void receipts and financial history were preserved.`
        : `Trip ${selectedTrip.trip_ref} was deleted.`);
      await refreshTrips();
      navigate("/booking/dashboard");
    } catch (requestError) {
      setTripError(errMsg(requestError));
    } finally {
      setTripDeleting(false);
    }
  };
  const changeTripStatus = async (reopen = false) => {
    if (!selectedTrip) return;
    if (!reopen) {
      setTripCloseoutOpen(true);
      return;
    }
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
  const confirmTripClose = async () => {
    if (!selectedTrip) return;
    setTripCloseoutOpen(false);
    try {
      const response = await api.post(`/sites/${siteId}/trips/${selectedTrip.id}/close`, {});
      const updatedTrip = {
        ...selectedTrip, ...response.data,
        lr_count: response.data.lr_count ?? selectedTrip.lr_count,
      };
      setSelectedTrip(updatedTrip);
      const cacheKey = `${siteId}:${selectedDate}`;
      tripsRequestVersions.current.set(cacheKey, (tripsRequestVersions.current.get(cacheKey) || 0) + 1);
      const updateTrip = (item) => item.id === updatedTrip.id
        ? { ...item, ...updatedTrip, lr_count: updatedTrip.lr_count ?? item.lr_count }
        : item;
      const cachedTrips = tripsCache.current.get(cacheKey);
      if (cachedTrips) tripsCache.current.set(cacheKey, cachedTrips.map(updateTrip));
      setTrips((current) => current.map(updateTrip));
      setSuccess(`${response.data.trip_ref} closed.`);
    } catch (requestError) {
      setTripError(errMsg(requestError));
    }
  };
  const receiptSaved = async (receipt, printAfter) => {
    const creating = !editingReceipt;
    setReceiptFormOpen(creating && selectedTrip?.status === "open" && can("lrs:create"));
    setEditingReceipt(null);
    if (creating) {
      setReceiptFormVersion((version) => version + 1);
      window.requestAnimationFrame(() => {
        const form = document.getElementById("receipt-entry-form");
        form?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    }
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

  useEffect(() => {
    if (page !== "ledger" || !siteId) return undefined;
    const requestId = ledgerTripsRequest.current + 1;
    ledgerTripsRequest.current = requestId;
    setLedgerTripId("");
    setLedgerTrips([]);
    setLedgerRows([]);
    setLedgerError("");
    api.get(`/sites/${siteId}/trips`, {
      params: { from_date: ledgerDate, to_date: ledgerDate, limit: 100, offset: 0 },
    }).then((response) => {
      if (requestId !== ledgerTripsRequest.current) return;
      const rows = response.data.rows || [];
      setLedgerTrips(rows);
      setLedgerTripId(rows[0]?.id || "");
    }).catch((requestError) => {
      if (requestId === ledgerTripsRequest.current) setLedgerError(errMsg(requestError));
    });
    return () => {
      if (ledgerTripsRequest.current === requestId) ledgerTripsRequest.current += 1;
    };
  }, [page, siteId, ledgerDate]);

  const loadLedger = useCallback(async () => {
    const requestId = activeLedgerRequest.current + 1;
    activeLedgerRequest.current = requestId;
    if (!siteId || !ledgerTripId) {
      setLedgerRows([]);
      setLedgerBusy(false);
      setLedgerLoadedKey("");
      return;
    }
    setLedgerBusy(true);
    setLedgerError("");
    setLedgerLoadedKey("");
    try {
      const params = {
        limit: 1000, offset: 0,
        from_date: ledgerDate,
        to_date: ledgerDate,
        trip_id: ledgerTripId,
      };
      const first = await api.get(`/sites/${siteId}/ledger/entries`, { params });
      let rows = first.data.rows || [];
      const applyRows = (nextRows) => {
        nextRows.forEach((row) => {
          ledgerRowCache.current[row.id] = row;
          if (row.updated_at) rowVersions.current[row.id] = row.updated_at;
        });
        setLedgerRows(nextRows.map((row) => ({ ...row, ...(dirtyRows.current[row.id] || {}) })));
      };
      applyRows(rows);
      const total = Math.min(Number(first.data.total) || rows.length, 10000);
      const offsets = [];
      for (let offset = rows.length; offset < total; offset += 1000) offsets.push(offset);
      if (offsets.length) {
        const pages = await Promise.all(offsets.map((offset) =>
          api.get(`/sites/${siteId}/ledger/entries`, { params: { ...params, offset } })));
        rows = rows.concat(...pages.map((page) => page.data.rows || []));
        if (requestId === activeLedgerRequest.current) applyRows(rows);
        else rows.forEach((row) => { ledgerRowCache.current[row.id] = row; });
      }
      if (requestId === activeLedgerRequest.current) {
        setLedgerLoadedKey(`${siteId}:${ledgerDate}:${ledgerTripId}`);
      }
    } catch (requestError) {
      if (requestId === activeLedgerRequest.current) setLedgerError(errMsg(requestError));
    } finally {
      if (requestId === activeLedgerRequest.current) setLedgerBusy(false);
    }
  }, [siteId, ledgerDate, ledgerTripId]);

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
    if (window.navigator.onLine === false) {
      setLedgerStatus((current) => ({ ...current, [rowId]: "Waiting to sync · keep this page open" }));
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

  flushLedgerRowRef.current = flushLedgerRow;
  useEffect(() => {
    const retryPendingLedgerRows = () => {
      if (window.navigator.onLine === false) return;
      Object.keys(dirtyRows.current).forEach((rowId) => {
        if (Object.keys(dirtyRows.current[rowId] || {}).length) {
          void flushLedgerRowRef.current?.(rowId);
        }
      });
    };
    window.addEventListener("online", retryPendingLedgerRows);
    return () => window.removeEventListener("online", retryPendingLedgerRows);
  }, []);

  const editLedgerCell = (rowId, key, value) => {
    if (isLedgerLocked(ledgerTrip)) return;
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
    setLedgerStatus((current) => ({
      ...current,
      [rowId]: window.navigator.onLine === false ? "Waiting to sync · keep this page open" : "Saving",
    }));
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
    if (!ledgerTripId) return;
    setLedgerError("");
    try {
      const response = await api.get(`/sites/${siteId}/ledger/export.xlsx`, {
        params: {
          from_date: ledgerDate,
          to_date: ledgerDate,
          trip_id: ledgerTripId,
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

  const setLedgerRowPaid = async (row, received) => {
    if (!owner || isLedgerLocked(ledgerTrip) || paidRowsUpdating.has(row.id)) return;
    const previousRow = row;
    const optimisticRow = {
      ...row,
      amount_paid: received,
      ...(received ? {
        paid_total: (Number(row.rent || 0) + Number(row.receipt_fee ?? 2)).toFixed(2),
        outstanding: "0.00",
        payment_status: "paid",
      } : {}),
    };
    ledgerRowCache.current[row.id] = optimisticRow;
    setLedgerRows((current) => current.map((item) => item.id === row.id ? optimisticRow : item));
    setPaidRowsUpdating((current) => new Set(current).add(row.id));
    setLedgerError("");
    try {
      const result = await api.post(`/sites/${siteId}/trips/${ledgerTripId}/lrs/${row.id}/settlement`, {
        received,
        idempotency_key: keyForRequest(),
      });
      const savedRow = {
        ...optimisticRow,
        amount_paid: result.data.received,
        paid_total: result.data.paid_total,
        outstanding: result.data.outstanding,
        payment_status: Number(result.data.outstanding) <= 0 ? "paid"
          : Number(result.data.paid_total) > 0 ? "partial" : "unpaid",
      };
      ledgerRowCache.current[row.id] = savedRow;
      setLedgerRows((current) => current.map((item) => item.id === row.id ? savedRow : item));
      setLedgerStatus((current) => ({
        ...current,
        [row.id]: result.data.received ? "Paid status saved" : "Paid status reversed",
      }));
    } catch (requestError) {
      ledgerRowCache.current[row.id] = previousRow;
      setLedgerRows((current) => current.map((item) => item.id === row.id ? previousRow : item));
      setLedgerError(`${row.lr_ref}: Paid status was not saved. ${errMsg(requestError)}`);
    } finally {
      setPaidRowsUpdating((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  };

  const completeTripLedger = async () => {
    if (!owner || !ledgerTripId || !ledgerSummaryReady || ledgerBusy || ledgerTrip?.ledger_completed_at) return;
    if (Object.keys(dirtyRows.current).some((id) => Object.keys(dirtyRows.current[id] || {}).length)
      || savingRows.current.size) {
      setLedgerError("Save or discard pending ledger edits before completing this trip.");
      return;
    }
    setLedgerCompletionReviewOpen(true);
  };
  const submitTripLedgerCompletion = async () => {
    if (!owner || !ledgerTripId || !ledgerSummaryReady || ledgerBusy
      || ledgerTrip?.ledger_completed_at || ledgerCompleting) return;
    setLedgerCompletionReviewOpen(false);
    setLedgerCompleting(true);
    setLedgerError("");
    try {
      const response = await api.post(`/sites/${siteId}/trips/${ledgerTripId}/ledger/complete`);
      const updatedTrip = { ...ledgerTrip, ...response.data };
      setLedgerTrips((current) => current.map((trip) => trip.id === ledgerTripId
        ? { ...trip, ...updatedTrip } : trip));
      await loadLedger();
    } catch (requestError) {
      setLedgerError(errMsg(requestError));
    } finally {
      setLedgerCompleting(false);
    }
  };

  const undoTripLedgerCompletion = async () => {
    if (!owner || !ledgerTripId || !ledgerTrip?.ledger_completed_at || ledgerCompleting) return;
    if (Object.keys(dirtyRows.current).some((id) => Object.keys(dirtyRows.current[id] || {}).length)
      || savingRows.current.size) {
      setLedgerError("Save or discard pending ledger edits before undoing completion.");
      return;
    }
    if (!window.confirm(
      "Undo ledger completion and unlock this trip? Existing payments and Amount paid ticks will remain unchanged.",
    )) return;
    setLedgerCompleting(true);
    setLedgerError("");
    try {
      const response = await api.post(
        `/sites/${siteId}/trips/${ledgerTripId}/ledger/uncomplete`,
      );
      const updatedTrip = {
        ...ledgerTrip,
        ...response.data,
        ledger_completed_at: null,
        ledger_completed_by: "",
        ledger_completion_started_at: null,
        ledger_completion_started_by: "",
        ledger_completion_date: null,
      };
      setLedgerTrips((current) => current.map((trip) => trip.id === ledgerTripId
        ? { ...trip, ...updatedTrip } : trip));
      await loadLedger();
    } catch (requestError) {
      setLedgerError(errMsg(requestError));
    } finally {
      setLedgerCompleting(false);
    }
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

  const title = page === "dashboard" ? t("Dashboard", "डैशबोर्ड")
    : page === "receipts" ? t("Receipts", "रसीदें")
      : page === "finance" ? t("Booking Finance", "बुकिंग वित्त")
        : page === "audit" ? t("Booking Audit", "बुकिंग जाँच") : t("Ledger", "खाता");
  const addressSuggestions = useMemo(() => ({
    sender: [...new Set(receipts.map((receipt) => receipt.sender_address).filter(Boolean))],
    receiver: [...new Set(receipts.map((receipt) => receipt.receiver_address).filter(Boolean))],
  }), [receipts]);
  const ledgerField = (row, key, value, type, label, className = "") => <input
    aria-label={`${row.lr_ref} ${language === "hi"
      ? ledgerColumnLabel(label.replace(/^mobile /i, ""), language) : label}`}
    className={`${field} ${className}`} type={type}
    value={value ?? ""}
    {...(type === "number" ? { min: 0, step: "0.01", inputMode: "decimal" } : {})}
    title={(key === "rent" || key === "hamali") && row.amount_paid
      ? t("Untick Amount paid before changing Bhada or Hamali.",
        "भाड़ा या हमाली बदलने से पहले ‘पैसे मिले’ का निशान हटाएँ।") : undefined}
    disabled={isLedgerLocked(ledgerTrip) || row.voided || (row.trip_status === "closed" && !owner)
      || (key === "rent" || key === "hamali"
        ? !canEditFinance || row.amount_paid : !can("lrs:update"))}
    onChange={(event) => editLedgerCell(row.id, key, event.target.value)}
    onBlur={() => flushLedgerRow(row.id)} />;
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
        .booking-print-portal { display:none; }
        .booking-print-target { display:none; }
        .booking-workspace .lbl { text-transform:none; letter-spacing:normal; font-size:0.875rem; line-height:1.25rem; }
        @page { size:A4 ${printMode === "ledger" ? "landscape" : "portrait"}; margin:8mm; }
        @media print {
          html, body { height:auto !important; margin:0 !important; overflow:visible !important; background:#fff !important; }
          body > :not(.booking-print-portal) { display:none !important; }
          body > .booking-print-portal { display:block !important; position:static !important; width:100% !important; }
          .booking-print-portal, .booking-print-portal * { visibility:visible !important; }
          .booking-print-target[data-active="true"] { display:block !important; position:static !important; width:100%; color:#111; background:#fff; font-family:"Noto Sans Devanagari","Mangal",sans-serif; font-size:10pt; }
          .receipt-print-header { position:relative; display:flex; min-height:200px; align-items:center; justify-content:center; border-bottom:1px solid #111; padding:0 126px 8px 290px; text-align:center; }
          .receipt-print-logo { position:absolute; top:50%; left:0; width:270px; height:190px; max-width:270px; max-height:190px; transform:translateY(-50%); object-fit:contain; object-position:left center; }
          .receipt-print-company { width:100%; text-align:center; }
          .receipt-print-company h1 { margin:0; font-size:23pt; font-weight:700; }
          .receipt-print-company p { margin:2px 0; font-size:14pt; font-weight:600; }
          .receipt-print-company span, .receipt-print-contact { font-size:9pt; }
          .receipt-print-contact { position:absolute; top:0; right:0; text-align:right; }
          .receipt-print-meta { display:flex; justify-content:space-between; gap:12px; padding:6px 0; border-bottom:1px solid #777; font-size:9pt; }
          .receipt-print-parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:8px 0; }
          .receipt-print-parties div { display:grid; gap:3px; }
          .receipt-print-goods { width:100%; border-collapse:collapse; table-layout:fixed; }
          .receipt-print-goods th, .receipt-print-goods td { border:1px solid #222; padding:5px; text-align:left; vertical-align:top; }
          .receipt-print-goods th:first-child, .receipt-print-goods td:first-child { width:100%; text-align:left; }
          .receipt-print-description { display:block; margin-top:3px; font-size:10pt; }
          .receipt-print-charges { width:55%; margin:8px 0 0 auto; border-collapse:collapse; }
          .receipt-print-charges th, .receipt-print-charges td { border:1px solid #222; padding:4px 6px; text-align:right; }
          .receipt-print-charges th { text-align:left; }
          .receipt-print-total-row { font-weight:700; font-size:13pt; }
          .receipt-print-total { margin:8px 0 0; padding:6px; border:1px solid #111; text-align:right; font-size:13pt; font-weight:700; }
          .receipt-print-footer { margin-top:10px; border-top:1px solid #888; padding-top:6px; font-size:9pt; }
          .booking-print-target table { break-inside:avoid; page-break-inside:avoid; }
          .booking-print-target tr { break-inside:avoid; page-break-inside:avoid; }
          .booking-ledger-print { display:none; }
          .booking-print-portal[data-mode="ledger"] .booking-ledger-print { display:block !important; width:100%; color:#111; background:#fff; font:9pt "Noto Sans Devanagari","Mangal",sans-serif; }
          .booking-ledger-print h1 { margin:0 0 4px; font-size:16pt; }
          .booking-ledger-print p { margin:0 0 10px; }
          .booking-ledger-print table { width:100%; border-collapse:collapse; table-layout:fixed; }
          .booking-ledger-print thead { display:table-header-group; }
          .booking-ledger-print tr { break-inside:avoid; page-break-inside:avoid; }
          .booking-ledger-print th, .booking-ledger-print td { border:1px solid #444; padding:4px; overflow-wrap:anywhere; text-align:left; vertical-align:top; }
          .booking-ledger-print th { background:#e9efed !important; }
          .booking-ledger-print h1 { margin:0 0 4px; font-size:16pt; }
          .booking-ledger-print p { margin:0 0 10px; }
          .booking-ledger-print table { width:100%; border-collapse:collapse; table-layout:fixed; }
          .booking-ledger-print thead { display:table-header-group; }
          .booking-ledger-print tr { break-inside:avoid; page-break-inside:avoid; }
          .booking-ledger-print th, .booking-ledger-print td { border:1px solid #444; padding:4px; overflow-wrap:anywhere; text-align:left; vertical-align:top; }
          .booking-ledger-print th { background:#e9efed !important; }
        }
      `}</style>
      <div className="booking-workspace space-y-5" lang={language === "hi" ? "hi-IN" : "en"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageHead title={title} subtitle={site?.name || t("Goods transport", "माल ढुलाई")} />
          <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-white p-1"
            role="group" aria-label={t("Display language", "दिखाने की भाषा")}>
            <button type="button" aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
              className={`min-h-11 rounded-lg px-4 font-semibold ${language === "en" ? "bg-brand-700 text-white" : "text-ink hover:bg-canvas"}`}>
              English
            </button>
            <button type="button" aria-pressed={language === "hi"}
              onClick={() => setLanguage("hi")}
              className={`min-h-11 rounded-lg px-4 font-semibold ${language === "hi" ? "bg-brand-700 text-white" : "text-ink hover:bg-canvas"}`}>
              हिंदी
            </button>
          </div>
        </div>
        <div>
          {owner && <label className="block max-w-md"><span className="lbl">{t("Site / Garage", "साइट / गैराज")}</span><select className={field} value={siteId}
            onChange={(event) => selectSite(event.target.value)}>{sites.map((item) =>
              <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {!owner && <div className="inline-flex rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <span className="mr-2 text-muted">{t("Site / Garage", "साइट / गैराज")}</span><strong>{site?.name || t("Loading…", "लोड हो रहा है…")}</strong>
          </div>}
        </div>
        {success && <div role="status" className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-lg font-semibold text-green-900"><Check />{success}</div>}
        {tripError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{tripError}</div>}

        {page === "dashboard" && <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
            <label className="min-w-52 flex-1"><span className="lbl">{t("Date", "तारीख")}</span>
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
            {can("trips:create") && <button disabled={tripLoading}
              className={`${nextReceiptTrip ? "btn-s min-h-12 text-base" : "btn-p min-h-14 text-lg"} w-full sm:w-auto`} onClick={() => {
              setTripForm({ date: selectedDate, truck_no: "", driver_name: "" }); setTripFormOpen(true);
            }}><Plus size={20} /> {tripLoading ? t("Loading trips…", "यात्राएँ लोड हो रही हैं…") : t("Create Trip", "यात्रा बनाएँ")}</button>}
          </Card>
          <Card role="region" aria-label={t("Today's work summary", "आज के काम का सारांश")}
            className="space-y-4 border-2 border-brand-700 bg-brand-50 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold">{selectedDate === todayISO()
                  ? t("Today's summary", "आज का सारांश")
                  : t("Daily summary", "दिन का सारांश")}</h2>
                <p className="mt-1 text-sm text-muted">{selectedDate}</p>
              </div>
              {todaySummary.error && <button type="button" className="btn-s min-h-11"
                onClick={() => setTodaySummaryRetry((current) => current + 1)}>
                {t("Retry summary", "सारांश फिर से देखें")}
              </button>}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <p className="rounded-lg border border-line bg-white p-3 text-base">
                <IconLabel icon={Truck}>{t("Trips to finish", "बाकी यात्राएँ")}</IconLabel>
                <strong className="mt-1 block text-2xl font-extrabold">
                  {tripLoading ? "…" : tripError ? "—" : openTodayTrips.length}
                </strong>
              </p>
              <p className="rounded-lg border border-line bg-white p-3 text-base">
                <IconLabel icon={Receipt}>{t("Receipts created", "बनी हुई रसीदें")}</IconLabel>
                <strong className="mt-1 block text-2xl font-extrabold">
                  {!canFinanceRead || !todaySummaryCurrent || todaySummary.loading ? "…"
                    : todaySummary.error ? "—" : todaySummary.receiptCount}
                </strong>
              </p>
              <p className="rounded-lg border border-amber-800 bg-amber-50 p-3 text-base">
                <IconLabel icon={Clock3}>{t("Still to collect", "अभी लेना बाकी")}</IconLabel>
                <strong className="mt-1 block text-2xl font-extrabold">
                  {!canFinanceRead ? "—" : !todaySummaryCurrent || todaySummary.loading ? "…"
                    : todaySummary.error || todaySummary.outstanding == null
                      ? "—" : money(todaySummary.outstanding)}
                </strong>
              </p>
            </div>
            {todaySummary.error && <p role="alert" className="text-sm font-semibold text-red-800">
              {t("Could not load today's receipt and money totals.", "आज की रसीदों और रकम का हिसाब नहीं मिल सका।")}
            </p>}
            {!canFinanceRead && <p className="text-sm text-muted">
              {t("You do not have permission to view receipt and payment totals.", "आपको रसीद और भुगतान का हिसाब देखने की अनुमति नहीं है।")}
            </p>}
            <div className="border-t border-brand-200 pt-3">
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{t("Next step", "अब यह करें")}</p>
              {tripLoading ? (
                <p role="status" className="rounded-lg border border-brand-300 bg-white p-3 text-base font-semibold">
                  {t("Checking today's trips…", "आज की यात्राएँ देखी जा रही हैं…")}
                </p>
              ) : nextReceiptTrip ? (
                <button type="button" className="btn-p min-h-14 w-full justify-center text-lg sm:w-auto"
                  onClick={() => openTrip(nextReceiptTrip)}>
                  <Plus size={20} /> {t("Add receipt", "रसीद जोड़ें")}
                </button>
              ) : can("trips:create") ? (
                <p className="rounded-lg border border-brand-300 bg-white p-3 text-base font-semibold">
                  {t("Next, use the Create Trip button above.", "अब ऊपर ‘यात्रा बनाएँ’ बटन दबाएँ।")}
                </p>
              ) : (
                <button type="button" className="btn-p min-h-14 w-full justify-center text-lg sm:w-auto"
                  onClick={() => {
                    setLedgerDate(selectedDate);
                    setLedgerTripId("");
                    navigate("/booking/ledger");
                  }}>
                  <ChevronRight size={20} /> {t("Review ledger", "खाता देखें")}
                </button>
              )}
            </div>
          </Card>
          {tripFormOpen && <Card className="p-4 sm:p-6">
            <h2 className="mb-4 text-xl font-bold">{t("Create trip", "यात्रा बनाएँ")}</h2>
            <form onSubmit={createTrip} className="grid gap-4 sm:grid-cols-2">
              <label><span className="lbl">{t("Date *", "तारीख *")}</span><input className={field} required type="date" value={tripForm.date}
                onChange={(event) => setTripForm({ ...tripForm, date: event.target.value })} /></label>
              <label><span className="lbl">{t("Vehicle number (optional)", "गाड़ी नंबर (ज़रूरी नहीं)")}</span><input className={field} value={tripForm.truck_no}
                onChange={(event) => setTripForm({ ...tripForm, truck_no: event.target.value })} /></label>
              <label><span className="lbl">{t("Driver name (optional)", "ड्राइवर का नाम (ज़रूरी नहीं)")}</span><input className={field} value={tripForm.driver_name}
                onChange={(event) => setTripForm({ ...tripForm, driver_name: event.target.value })} /></label>
              <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                <button type="button" className="btn-s min-h-12" onClick={() => setTripFormOpen(false)}>{t("Cancel", "रद्द करें")}</button>
                <Btn type="submit" className="min-h-12 flex-1">{t("Create trip", "यात्रा बनाएँ")}</Btn>
              </div>
            </form>
          </Card>}
          <Card className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label><span className="lbl">{t("Find trips", "यात्रा खोजें")}</span><span className="relative block">
              <Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className={`${field} pl-10`} type="search" aria-label="Search trips"
                placeholder={t("Trip number, vehicle or driver", "यात्रा नंबर, गाड़ी या ड्राइवर")} value={tripSearch}
                onChange={(event) => setTripSearch(event.target.value)} />
            </span></label>
            <label><span className="lbl">{t("Trip status", "यात्रा की स्थिति")}</span><select className={field}
              aria-label="Filter trips by status" value={tripStatusFilter}
              onChange={(event) => setTripStatusFilter(event.target.value)}>
              <option value="all">{t("All statuses", "सभी स्थितियाँ")}</option>
              <option value="open">{t("Open", "चालू")}</option>
              <option value="closed">{t("Closed", "बंद")}</option>
            </select></label>
          </Card>
          <div><h2 className="mb-3 text-xl font-bold">{t("Trips for", "इस तारीख की यात्राएँ")} {selectedDate}</h2>
            {tripLoading ? <Loader label="Loading trips…" /> : tripError ? <ErrorState text={tripError} onRetry={() => refreshTrips()} /> :
              filteredTrips.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredTrips.map((trip) => <button key={trip.id} onClick={() => openTrip(trip)}
                  className="card min-h-36 p-4 text-left hover:border-brand-400 focus-visible:outline-brand-600">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xl font-bold">{trip.trip_ref}</span>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${trip.status === "closed" ? "bg-slate-100 text-slate-700" : "bg-green-100 text-green-800"}`}>
                      {trip.status === "closed" ? t("Closed", "बंद") : t("Open", "चालू")}
                    </span>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm"><Truck size={17} />{trip.truck_no || t("Vehicle not entered", "गाड़ी नंबर नहीं भरा")}</p>
                  <p className="mt-1 text-sm text-muted">{trip.driver_name || t("Driver not entered", "ड्राइवर का नाम नहीं भरा")}</p>
                  <span className="mt-4 flex items-center justify-between text-sm font-semibold text-brand-700">
                    {trip.operating_date} · {trip.lr_count ?? t("Open trip", "चालू यात्रा")} {t("receipts", "रसीदें")} <ChevronRight size={18} />
                  </span>
                </button>)}
              </div> : <Card className="p-6 text-center">
                <p className="text-lg font-semibold">{trips.length ? t("No trips match these filters.", "कोई यात्रा इस खोज से मेल नहीं खाती।")
                  : t("No trips on this date.", "इस तारीख को कोई यात्रा नहीं है।")}</p>
                {!trips.length && can("trips:create") && <p className="mt-1 text-sm text-muted">{t("Create a trip to start adding receipts.", "रसीदें जोड़ने के लिए यात्रा बनाएँ।")}</p>}
              </Card>}
          </div>
        </div>}

        {page === "receipts" && <div className="space-y-4">
          {selectedTrip ? <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="text-sm font-medium text-muted">{t("Selected trip", "चुनी हुई यात्रा")}</p><h2 className="text-xl font-bold">{selectedTrip.trip_ref}</h2>
              <p className="mt-1 text-sm">{selectedTrip.operating_date}
                {selectedTrip.truck_no ? ` · ${selectedTrip.truck_no}` : ""}
                {selectedTrip.driver_name ? ` · ${selectedTrip.driver_name}` : ""}</p>
            </div>
            {selectedTrip.status === "closed" && <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{t("Trip closed · receipts locked", "यात्रा बंद · रसीदें लॉक हैं")}</span>}
            {can("trips:update") && !isLedgerLocked(selectedTrip) && !selectedTrip.reconciled &&
              <button type="button" className="btn-s min-h-11" onClick={openTripEditor}>{t("Edit trip details", "यात्रा की जानकारी बदलें")}</button>}
            {selectedTrip.status === "open" && owner &&
              <button className="btn-s" disabled={receiptsLoading || Boolean(receiptsError)}
                onClick={() => changeTripStatus(false)}>
                {receiptsLoading ? t("Loading receipts…", "रसीदें लोड हो रही हैं…") : t("Close Trip", "यात्रा बंद करें")}
              </button>}
            {selectedTrip.status === "closed" && owner &&
              <button className="btn-s" onClick={() => changeTripStatus(true)}>{t("Reopen Trip", "यात्रा फिर खोलें")}</button>}
            {selectedTrip.status === "open" && owner && receiptsError &&
              <div className="w-full text-sm text-red-700 sm:basis-full">
                <p>Could not load the full receipt summary: {receiptsError}</p>
                <button type="button" className="btn-s mt-2" onClick={() => refreshReceipts(selectedTrip)}>
                  Retry receipt summary
                </button>
              </div>}
          </Card> : <Card className="p-5">
            <p className="text-lg font-semibold">{t("Choose a trip before creating a receipt.", "रसीद बनाने से पहले यात्रा चुनें।")}</p>
            <Link className="btn-p mt-3" to="/booking/dashboard">{t("Open Dashboard", "डैशबोर्ड खोलें")}</Link>
          </Card>}
          {tripCloseoutOpen && selectedTrip && <Card role="dialog" aria-modal="true"
            aria-labelledby="trip-closeout-title" className="border-2 border-brand-300 p-4 text-lg sm:p-6">
            <h2 id="trip-closeout-title" className="text-2xl font-bold">{t("Check trip money before closing", "यात्रा बंद करने से पहले पैसों का हिसाब देखें")}</h2>
            <p className="mt-1 text-base text-muted">
              {t("Trip", "यात्रा")} {selectedTrip.trip_ref}. {t("Closing stops new receipts. Check these amounts first.",
                "यात्रा बंद होने पर नई रसीद नहीं बनेगी। पहले ये रकम जाँचें।")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <p className="rounded-lg border border-line bg-canvas p-3 text-base">
                <IconLabel icon={Receipt}>{t("Receipts", "रसीदें")}</IconLabel><strong className="block text-2xl font-extrabold">{tripCloseoutSummary.count}</strong>
              </p>
              <p className="rounded-lg border border-line bg-canvas p-3 text-base">
                <IconLabel icon={Receipt}>{t("Total amount", "कुल रकम")}</IconLabel><strong className="block text-2xl font-extrabold">{money(tripCloseoutSummary.charges)}</strong>
              </p>
              <p className="rounded-lg border border-green-700 bg-green-50 p-3 text-base">
                <IconLabel icon={Banknote}>✓ {t("Already received", "मिल चुके")}</IconLabel><strong className="block text-2xl font-extrabold">{money(tripCloseoutSummary.paid)}</strong>
              </p>
              <p className="rounded-lg border border-amber-800 bg-amber-50 p-3 text-base">
                <IconLabel icon={Clock3}>! {t("Still to collect", "अभी लेना बाकी")}</IconLabel><strong className="block text-2xl font-extrabold">{money(tripCloseoutSummary.outstanding)}</strong>
                <span className="mt-1 block text-xs">{t("Bhada + receipt fee", "भाड़ा + रसीद शुल्क")}</span>
              </p>
            </div>
            {tripCloseoutSummary.voided > 0 && <p className="mt-3 text-sm text-muted">
              {t(`${tripCloseoutSummary.voided} voided ${tripCloseoutSummary.voided === 1 ? "receipt is" : "receipts are"} excluded.`,
                `${tripCloseoutSummary.voided} रद्द रसीदें शामिल नहीं हैं।`)}
            </p>}
            {tripCloseoutSummary.unpriced > 0 && <p className="mt-2 text-sm text-amber-900">
              {tripCloseoutSummary.unpriced} {t("receipt(s) have no Bhada price; check charges before using the outstanding balance.",
                "रसीदों में भाड़ा नहीं भरा है; बाकी रकम पर भरोसा करने से पहले हिसाब जाँचें।")}
            </p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-s min-h-12 px-5 text-base"
                onClick={() => setTripCloseoutOpen(false)}>{t("Keep trip open", "यात्रा खुली रखें")}</button>
              <button type="button" className="btn-p min-h-12 px-5 text-base"
                disabled={receiptsLoading || Boolean(receiptsError)} onClick={confirmTripClose}>
                ✓ {t("Close trip", "यात्रा बंद करें")}
              </button>
            </div>
          </Card>}
          {tripEditOpen && selectedTrip && <Card className="p-4 sm:p-6">
            <h3 className="mb-4 text-lg font-bold">Edit trip details · {selectedTrip.trip_ref}</h3>
            <form onSubmit={saveTripDetails} className="grid gap-4 sm:grid-cols-2">
              <label><span className="lbl">Vehicle number</span>
                <input className={field} aria-label="Edit trip vehicle number" maxLength={32}
                  value={tripEditForm.truck_no}
                  onChange={(event) => setTripEditForm((current) => ({ ...current, truck_no: event.target.value }))} />
              </label>
              <label><span className="lbl">Driver name</span>
                <input className={field} aria-label="Edit trip driver name" maxLength={100}
                  value={tripEditForm.driver_name}
                  onChange={(event) => setTripEditForm((current) => ({ ...current, driver_name: event.target.value }))} />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" className="btn-s min-h-11" disabled={tripEditSaving}
                  onClick={() => setTripEditOpen(false)}>Cancel</button>
                <button type="submit" className="btn-p min-h-11 flex-1" disabled={tripEditSaving}>
                  {tripEditSaving ? "Saving trip…" : "Save trip details"}
                </button>
                {owner && <button type="button" className="btn-s min-h-11 border-red-300 text-red-700"
                  disabled={tripEditSaving || tripDeleting} onClick={deleteTrip}>
                  {tripDeleting ? "Deleting trip…" : "Delete trip"}
                </button>}
              </div>
            </form>
          </Card>}
          {receiptFormOpen && selectedTrip && (selectedTrip.status === "open" || owner)
            && !isLedgerLocked(selectedTrip) && <>
            <div id="receipt-entry-form">
              <ReceiptForm key={editingReceipt?.id || `new-${receiptFormVersion}`} trip={selectedTrip}
                receipt={editingReceipt}
                draftScope={user?.id || user?.email || user?.username || user?.name || "local"}
                canEditFinance={canEditFinance || (!editingReceipt && can("lrs:create"))}
                addressSuggestions={addressSuggestions}
                convertHindi={convertHindi}
                receiptFee={receiptFee}
                goodsSuggestions={goodsSuggestions}
                previousReceipts={receipts.filter((receipt) => !receipt.voided)}
                senderAddressEnabled={senderAddressEnabled}
                receiverAddressEnabled={receiverAddressEnabled}
                language={language}
                onCancel={() => { setReceiptFormOpen(false); setEditingReceipt(null); }}
                onSaved={receiptSaved} />
            </div>
          </>}
          {!receiptFormOpen && selectedTrip?.status === "open" && !isLedgerLocked(selectedTrip) && can("lrs:create") &&
            <button className="btn-p min-h-12 w-full sm:w-auto" onClick={() => {
              setEditingReceipt(null); setReceiptFormOpen(true); setTripError("");
            }}><Plus size={18} /> {t("New receipt", "नई रसीद")}</button>}
          <section>
            <h2 className="mb-3 text-xl font-bold">{t("Receipts", "रसीदें")} {selectedTrip ? `· ${selectedTrip.trip_ref}` : ""}</h2>
            {selectedTrip && <Card className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
              <label><span className="lbl">{t("Find receipts", "रसीद खोजें")}</span><span className="relative block">
                <Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className={`${field} pl-10`} type="search" aria-label={t("Search receipts", "रसीद खोजें")}
                  placeholder={t("Receipt, receiver, phone or goods", "रसीद, प्राप्तकर्ता, फ़ोन या सामान")} value={receiptSearch}
                  onChange={(event) => setReceiptSearch(event.target.value)} />
              </span></label>
              {canFinanceRead && <label><span className="lbl">{t("Payment status", "भुगतान की स्थिति")}</span><select className={field}
                aria-label={t("Filter receipts by payment status", "भुगतान की स्थिति से छाँटें")} value={receiptPaymentFilter}
                onChange={(event) => setReceiptPaymentFilter(event.target.value)}>
                <option value="all">{t("All payment statuses", "भुगतान की सभी स्थितियाँ")}</option>
                <option value="unpaid">{paymentStatusLabel("unpaid", language)}</option>
                <option value="partial">{paymentStatusLabel("partial", language)}</option>
                <option value="paid">{paymentStatusLabel("paid", language)}</option>
                <option value="unpriced">{paymentStatusLabel("unpriced", language)}</option>
              </select></label>}
              <label><span className="lbl">{t("Receipt status", "रसीद की स्थिति")}</span><select className={field}
                aria-label={t("Filter receipts by receipt status", "रसीद की स्थिति से छाँटें")} value={receiptStateFilter}
                onChange={(event) => setReceiptStateFilter(event.target.value)}>
                <option value="all">{t("Active and voided", "चालू और रद्द")}</option>
                <option value="active">{t("Active only", "सिर्फ़ चालू")}</option>
                <option value="voided">{t("Voided only", "सिर्फ़ रद्द")}</option>
              </select></label>
            </Card>}
            {!selectedTrip ? null : filteredReceipts.length ? <div className="space-y-2">
              {filteredReceipts.map((receipt) =>               <Card key={receipt.id} className={`flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 ${receipt.voided ? "opacity-70" : ""}`}>
                <div className="min-w-48 flex-1"><h3 className="font-bold">{receipt.lr_ref}</h3>
                  <p className="mt-1 text-sm">{receipt.sender_name} → {receipt.receiver_name}</p>
                  {receipt.receiver_phone && <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                    <Phone size={14} aria-hidden="true" />{receipt.receiver_phone}
                  </p>}
                  <p className="mt-1 text-sm text-muted">{getGoodsRows(receipt).map((line) =>
                    [line.type, line.description, `× ${line.quantity}`].filter(Boolean).join(" - ")).join(" · ")}</p>
                  {receipt.voided && <p className="mt-1 font-semibold text-red-700">
                    <IconLabel icon={Ban}>× VOID · kept in history</IconLabel>
                  </p>}
                  {canFinanceRead && !receipt.voided && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <PaymentStatusBadge status={receiptPaymentStatus(receipt)} language={language} />
                      {receipt.rent != null || receipt.total_rent != null ? <>
                        <span><IconLabel icon={Receipt}>{t("Total amount:", "कुल रकम:")}</IconLabel> <strong>{money(receipt.total_rent
                          ?? ((Number(receipt.rent) || 0) + (Number(receipt.hamali) || 0)
                            + (Number(receipt.receipt_fee ?? 2) || 0)))}</strong></span>
                        <span><IconLabel icon={Banknote}>{t("Already received:", "मिल चुके:")}</IconLabel> <strong>{money(receipt.paid_total)}</strong></span>
                        <span><IconLabel icon={Clock3}>{t("Still to collect:", "अभी लेना बाकी:")}</IconLabel> <strong>{money(receiptOutstanding(receipt))}</strong></span>
                      </> : null}
                  </div>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {!receipt.voided && <button className="btn-s" onClick={() => queuePrint(receipt)}><Printer size={17} /> {t("Print", "प्रिंट")}</button>}
                  {owner && receipt.voided && !isLedgerLocked(selectedTrip) && <button className="btn-s" onClick={() => restoreReceipt(receipt)}>{t("Restore receipt", "रसीद वापस लाएँ")}</button>}
                  {!isLedgerLocked(selectedTrip) && !receipt.voided && can("lrs:update") && (selectedTrip.status === "open" || owner) && <>
                    <button className="btn-s min-h-11" onClick={() => { setEditingReceipt(receipt); setReceiptFormOpen(true); }}>{t("Edit", "बदलें")}</button>
                    <button className="btn-s text-red-700" onClick={() => voidReceipt(receipt)}>{t("Void", "रद्द करें")}</button>
                  </>}
                </div>
              </Card>)}
            </div> : <Card className="p-5 text-center text-muted">
              {receipts.length ? t("No receipts match these filters.", "कोई रसीद इस खोज से मेल नहीं खाती।")
                : t("No receipts in this trip yet.", "इस यात्रा में अभी कोई रसीद नहीं है।")}
            </Card>}
          </section>
        </div>}

        {page === "ledger" && <div className="space-y-3">
          <div className="sticky top-0 z-20 grid gap-3 border border-gray-400 bg-white p-3 shadow-sm sm:grid-cols-2 lg:static lg:shadow-none">
            <label><span className="lbl">{t("Date", "तारीख")}</span><input className={field} type="date" value={ledgerDate}
              onChange={(event) => {
                setLedgerTripId("");
                setLedgerTrips([]);
                setLedgerRows([]);
                setLedgerDate(event.target.value);
              }} /></label>
            <label><span className="lbl">{t("Select trip", "यात्रा चुनें")}</span><select className={field} value={ledgerTripId}
              onChange={(event) => setLedgerTripId(event.target.value)} disabled={!ledgerTrips.length}>
              <option value="">{t("Select trip", "यात्रा चुनें")}</option>
              {ledgerTrips.map((trip) =>
                <option key={trip.id} value={trip.id}>{trip.trip_ref}</option>)}
            </select></label>
          </div>
          {canFinanceRead && ledgerTripId && (ledgerSummaryReady ? <section aria-label={t("Selected trip payment summary", "चुनी हुई यात्रा का भुगतान सारांश")}
            className="grid grid-cols-2 gap-2 rounded-xl border-2 border-brand-700 bg-brand-50 p-3 text-base sm:grid-cols-4 sm:p-4">
            <p><IconLabel icon={Receipt}>{t("Receipts", "रसीदें")}</IconLabel><strong className="block text-2xl font-extrabold">{ledgerTotals.count}</strong></p>
            <p><IconLabel icon={Receipt}>{t("Total amount", "कुल रकम")}</IconLabel><strong className="block text-2xl font-extrabold">{money(ledgerTotals.total)}</strong></p>
            <p className="rounded-lg border border-green-700 bg-green-50 p-2"><IconLabel icon={Banknote}>✓ {t("Already received", "मिल चुके")}</IconLabel><strong className="block text-2xl font-extrabold">{money(ledgerTotals.paid)}</strong></p>
            <p className="rounded-lg border border-amber-800 bg-amber-50 p-2"><IconLabel icon={Clock3}>! {t("Still to collect", "अभी लेना बाकी")}</IconLabel><strong className="block text-2xl font-extrabold">{money(ledgerTotals.outstanding)}</strong>
              <span className="block text-xs">{t("Bhada + receipt fee", "भाड़ा + रसीद शुल्क")}</span>
            </p>
          </section> : <p role="status" aria-live="polite" className="rounded-xl border-2 border-brand-700 bg-brand-50 p-4 text-base font-semibold">
            {ledgerError ? t("Trip totals unavailable. Retry loading the ledger.", "यात्रा का हिसाब नहीं मिला। खाता फिर से लोड करें।")
              : t("Loading complete trip totals…", "यात्रा का पूरा हिसाब लोड हो रहा है…")}
          </p>)}
          {canFinanceRead && ledgerSummaryReady && ledgerTotals.unpriced > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {ledgerTotals.unpriced} {t("receipt(s) have no Bhada price; review charges before completing the ledger.",
              "रसीदों में भाड़ा नहीं भरा है; खाता पूरा करने से पहले रकम जाँचें।")}
          </p>}
          {ledgerTripId && <div className="grid gap-3 rounded-lg border border-gray-400 bg-white p-3 sm:grid-cols-3">
            <label className="sm:col-span-1"><span className="lbl">{t("Find receipts in this trip", "इस यात्रा की रसीदें खोजें")}</span>
              <span className="relative block">
                <Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className={`${field} pl-10`} type="search" aria-label={t("Search trip ledger", "यात्रा का खाता खोजें")}
                  placeholder={t("Receipt, receiver, phone or goods", "रसीद, प्राप्तकर्ता, फ़ोन या सामान")} value={ledgerSearch}
                  onChange={(event) => setLedgerSearch(event.target.value)} />
              </span>
            </label>
            {canFinanceRead && <label><span className="lbl">{t("Payment status", "भुगतान की स्थिति")}</span><select className={field}
              aria-label={t("Filter ledger by payment status", "भुगतान की स्थिति से छाँटें")} value={ledgerPaymentFilter}
              onChange={(event) => setLedgerPaymentFilter(event.target.value)}>
              <option value="all">{t("All payment statuses", "भुगतान की सभी स्थितियाँ")}</option>
              <option value="unpaid">{paymentStatusLabel("unpaid", language)}</option>
              <option value="partial">{paymentStatusLabel("partial", language)}</option>
              <option value="paid">{paymentStatusLabel("paid", language)}</option>
              <option value="unpriced">{paymentStatusLabel("unpriced", language)}</option>
            </select></label>}
            <label><span className="lbl">{t("Receipt status", "रसीद की स्थिति")}</span><select className={field}
              aria-label={t("Filter ledger by receipt status", "रसीद की स्थिति से छाँटें")} value={ledgerStateFilter}
              onChange={(event) => setLedgerStateFilter(event.target.value)}>
              <option value="all">{t("Active and voided", "चालू और रद्द")}</option>
              <option value="active">{t("Active only", "सिर्फ़ चालू")}</option>
              <option value="voided">{t("Voided only", "सिर्फ़ रद्द")}</option>
            </select></label>
          </div>}
          {ledgerError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border border-red-700 bg-red-50 p-3 text-base text-red-900">
            <span>{ledgerError}</span>
            {!ledgerSummaryReady && !ledgerBusy && <button type="button" className="btn-s min-h-11"
              onClick={loadLedger}>{t("Retry loading ledger", "खाता फिर से लोड करें")}</button>}
          </div>}
          <div className="flex flex-col gap-3 border border-gray-400 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Selected trip", "चुनी हुई यात्रा")}</p>
              <h2 className="text-lg font-bold">{ledgerTrip?.trip_ref || "—"}</h2>
              <p className="text-sm">{ledgerDate}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button className="btn-s min-h-11" disabled={!ledgerTripId} onClick={printLedger}><Printer size={16} /> {t("Print", "प्रिंट")}</button>
              <button className="btn-p min-h-11" disabled={!ledgerTripId} onClick={downloadLedger}><Download size={16} /> Excel</button>
              {owner && ledgerTripId && !ledgerTrip?.ledger_completed_at && <button
                className="btn-p col-span-2 min-h-12 px-4 text-base sm:col-span-1"
                disabled={ledgerCompleting || ledgerBusy || !ledgerSummaryReady || !ledgerRows.length}
                onClick={completeTripLedger}>
                {ledgerCompleting ? t("Completing ledger…", "खाता पूरा हो रहा है…") : ledgerTrip?.ledger_completion_started_at
                  ? t("Resume ledger completion", "खाता पूरा करना जारी रखें") : t("Complete trip ledger", "यात्रा का खाता पूरा करें")}
                </button>}
              {owner && ledgerTripId && ledgerTrip?.ledger_completed_at && <button
                className="btn-s col-span-2 min-h-11 sm:col-span-1"
                disabled={ledgerCompleting || ledgerBusy}
                onClick={undoTripLedgerCompletion}>
                {ledgerCompleting ? t("Updating ledger…", "खाता बदला जा रहा है…") : t("Undo ledger completion", "खाता पूरा करना वापस लें")}
              </button>}
            </div>
          </div>
          {isLedgerLocked(ledgerTrip) && <p className="border border-gray-500 bg-gray-100 p-2 text-sm">
            {ledgerTrip.ledger_completed_at ? t("Ledger completed and locked", "खाता पूरा हुआ और लॉक है")
              : t("Ledger completion in progress and locked", "खाता पूरा हो रहा है और लॉक है")} · {t("Admin", "प्रशासक")}: {ledgerTrip.ledger_completed_by || ledgerTrip.ledger_completion_started_by || "—"}
            {" · "}{ledgerTrip.ledger_completed_at || ledgerTrip.ledger_completion_started_at}
          </p>}
          {ledgerCompletionReviewOpen && ledgerTrip && <Card role="dialog" aria-modal="true"
            aria-labelledby="ledger-completion-title" className="border-2 border-brand-300 p-4 sm:p-6">
            <h2 id="ledger-completion-title" className="text-2xl font-bold">{t("Check trip money before finishing", "खाता पूरा करने से पहले यात्रा का हिसाब देखें")}</h2>
            <p className="mt-1 text-base text-muted">
              {t("Trip", "यात्रा")} {ledgerTrip.trip_ref}. {t("Finishing marks the remaining amount as received and locks changes.",
                "खाता पूरा करने पर बाकी रकम मिली हुई मानी जाएगी और बदलाव लॉक हो जाएँगे।")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <p className="rounded-lg border border-line bg-canvas p-3 text-base">
                <IconLabel icon={Receipt}>{t("Receipts", "रसीदें")}</IconLabel><strong className="block text-2xl font-extrabold">{ledgerTotals.count}</strong>
              </p>
              <p className="rounded-lg border border-line bg-canvas p-3 text-base">
                <IconLabel icon={Receipt}>{t("Total amount", "कुल रकम")}</IconLabel><strong className="block text-2xl font-extrabold">{money(ledgerTotals.total)}</strong>
              </p>
              <p className="rounded-lg border border-green-700 bg-green-50 p-3 text-base">
                <IconLabel icon={Banknote}>✓ {t("Already received", "मिल चुके")}</IconLabel><strong className="block text-2xl font-extrabold">{money(ledgerTotals.paid)}</strong>
              </p>
              <p className="rounded-lg border border-amber-800 bg-amber-50 p-3 text-base">
                <IconLabel icon={Clock3}>! {t("Still to collect", "अभी लेना बाकी")}</IconLabel><strong className="block text-2xl font-extrabold">{money(ledgerTotals.outstanding)}</strong>
                <span className="mt-1 block text-xs">{t("Bhada + receipt fee", "भाड़ा + रसीद शुल्क")}</span>
              </p>
            </div>
            {ledgerTotals.unpriced > 0 && <p className="mt-3 text-sm text-amber-900">
              {ledgerTotals.unpriced} {t("receipt(s) have no Bhada price. Confirm charges before completing.",
                "रसीदों में भाड़ा नहीं भरा है। पूरा करने से पहले रकम जाँचें।")}
            </p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-s min-h-12 px-5 text-base"
                onClick={() => setLedgerCompletionReviewOpen(false)}>{t("Review later", "बाद में जाँचें")}</button>
              <button type="button" className="btn-p min-h-12 px-5 text-base"
                disabled={ledgerCompleting || ledgerBusy} onClick={submitTripLedgerCompletion}>
                ✓ {t("Finish trip", "यात्रा पूरी करें")}
              </button>
            </div>
          </Card>}
          {ledgerBusy ? <Loader label="Loading ledger…" /> : ledgerTripId ? (
            <div className="overflow-auto border border-gray-500 bg-white">
              <table aria-label="Selected ledger totals" className="hidden min-w-[1050px] border-collapse text-sm lg:table">
                <thead className="bg-gray-200">
                  <tr>{["Date", "Receipt no.", "Sender", "Receiver", "Goods & quantity", "Bhada", "Hamali", "Receipt fee", "Entered by", ...(owner ? ["Amount paid"] : [])].map((label) =>
                    <th key={label} className="border border-gray-500 px-2 py-2 text-left font-bold">{ledgerColumnLabel(label, language)}</th>)}</tr>
                </thead>
                <tbody>{filteredLedgerRows.map((row) => {
                  const goodsRows = getGoodsRows(row);
                  const status = ledgerStatus[row.id] || "Saved";
                  const paymentStatus = receiptPaymentStatus(row);
                  const cell = "border border-gray-400 px-2 py-1 align-middle";
                  const hindiGoods = goodsRows.map(hindiLedgerGoodsLine).join(", ");
                  return <tr key={row.id} className={row.voided ? "bg-gray-100 text-gray-500" : ""}>
                    <td className={cell}>{row.receipt_date || row.operating_date}</td>
                    <td className={cell}>{row.lr_ref}{row.voided ? " · VOID" : ""}
                      {canFinanceRead && <div className="mt-1"><PaymentStatusBadge status={paymentStatus} voided={row.voided} language={language} /></div>}
                      {canFinanceRead && row.rent != null && <span className="mt-1 block text-xs">
                        <IconLabel icon={Banknote}>Received {money(row.paid_total)}</IconLabel>
                        {" · "}
                        <IconLabel icon={Clock3}>Still to collect {money(receiptOutstanding(row))}</IconLabel>
                      </span>}
                      <span role="status" aria-live="polite" className={`mt-1 block text-xs ${
                        status.startsWith("Failed") || status.startsWith("Unsaved") ? "text-red-700"
                          : status.startsWith("Waiting") ? "text-amber-800" : "text-muted"
                      }`}>{status}</span>
                    </td>
                    <td className={cell} lang="hi">{hindiText(row.sender_name_hindi, row.sender_name)}</td>
                    <td className={cell} lang="hi">{hindiText(row.receiver_name_hindi, row.receiver_name)}</td>
                    <td className={cell} lang="hi">{hindiGoods}</td>
                    <td className={`${cell} min-w-28`}>
                      {canFinanceRead ? ledgerField(row, "rent", amountInput(row.rent), "number", "Bhada", "min-h-8 border border-gray-400 bg-white px-2 py-1")
                        : "—"}
                    </td>
                    <td className={`${cell} min-w-28`}>
                      {canFinanceRead ? ledgerField(row, "hamali", amountInput(row.hamali), "number", "Hamali", "min-h-8 border border-gray-400 bg-white px-2 py-1")
                        : "—"}
                    </td>
                    <td className={cell}>{money(row.receipt_fee ?? 2)}</td>
                    <td className={cell}>{row.entry_by || "—"}</td>
                    {owner && <td className={cell}>
                      <input type="checkbox" aria-label={`${row.lr_ref} ${t("Mark money received", "पैसे मिलने पर निशान लगाएँ")}`}
                          checked={Boolean(row.amount_paid)}
                          disabled={row.voided || isLedgerLocked(ledgerTrip) || paidRowsUpdating.has(row.id)}
                          onChange={(event) => setLedgerRowPaid(row, event.target.checked)} />
                    </td>}
                  </tr>;
                })}</tbody>
                {canFinanceRead && <tfoot><tr className="bg-gray-50">
                  <td className="border border-gray-400 px-2 py-2 text-xs text-muted" colSpan={5}>
                    {t("Totals exclude voided receipts.", "रद्द रसीदें कुल में शामिल नहीं हैं।")}
                  </td>
                  <td className="border border-gray-400 px-2 py-2">{t("Bhada total:", "कुल भाड़ा:")} <strong>{money(ledgerTotals.bhada)}</strong></td>
                  <td className="border border-gray-400 px-2 py-2">{t("Hamali total:", "कुल हमाली:")} <strong>{money(ledgerTotals.hamali)}</strong></td>
                  <td className="border border-gray-400 px-2 py-2">{t("Receipt fee total:", "कुल रसीद शुल्क:")} <strong>{money(ledgerTotals.receiptFee)}</strong></td>
                  <td className="border border-gray-400 px-2 py-2 font-bold">{t("Grand total:", "कुल रकम:")} {money(ledgerTotals.total)}</td>
                  {owner && <td className="border border-gray-400 px-2 py-2" />}
                </tr></tfoot>}
              </table>
              {!ledgerRows.length && <p className="border-t border-gray-400 p-4 text-center">{t("No receipts in this trip.", "इस यात्रा में कोई रसीद नहीं है।")}</p>}
              {ledgerRows.length > 0 && !filteredLedgerRows.length && <p className="border-t border-gray-400 p-4 text-center">
                {t("No receipts match these filters.", "कोई रसीद इन फ़िल्टर से मेल नहीं खाती।")}
              </p>}
              <div className="space-y-3 p-2 lg:hidden">
                {filteredLedgerRows.map((row) => {
                  const goods = getGoodsRows(row).map(hindiLedgerGoodsLine).join(", ");
                  const rowStatus = ledgerStatus[row.id] || "Saved";
                  const paymentStatus = receiptPaymentStatus(row);
                  return <article key={`mobile-${row.id}`} aria-label={`${row.lr_ref} mobile ledger receipt`}
                    className={`rounded-xl border border-line bg-white p-3 ${row.voided ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-all font-bold">{row.lr_ref}{row.voided ? " · VOID" : ""}</h3>
                        <p className="mt-1 text-sm text-muted">{row.receipt_date || row.operating_date}</p>
                        {canFinanceRead && <div className="mt-2">
                          <PaymentStatusBadge status={paymentStatus} voided={row.voided} language={language} />
                        </div>}
                      </div>
                      {owner && <label className="flex min-h-12 shrink-0 items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2 text-base font-semibold">
                        <IconLabel icon={CircleCheck}>{t("Mark money received", "पैसे मिलने पर निशान लगाएँ")}</IconLabel>
                        <input type="checkbox" aria-label={`${row.lr_ref} ${t("Mark money received", "पैसे मिलने पर निशान लगाएँ")}`}
                          className="h-6 w-6 accent-green-700"
                          checked={Boolean(row.amount_paid)}
                          disabled={row.voided || isLedgerLocked(ledgerTrip) || paidRowsUpdating.has(row.id)}
                          onChange={(event) => setLedgerRowPaid(row, event.target.checked)} />
                      </label>}
                    </div>
                    <p className="mt-3 text-base" lang="hi">
                      {hindiText(row.sender_name_hindi, row.sender_name)} → {hindiText(row.receiver_name_hindi, row.receiver_name)}
                    </p>
                    <p className="mt-2 text-base font-semibold" lang="hi">{goods || t("Goods not entered", "सामान नहीं भरा")}</p>
                    {canFinanceRead ? <div className="mt-3 grid grid-cols-2 gap-2">
                      <label><span className="lbl"><IconLabel icon={Banknote}>{t("Bhada (₹)", "भाड़ा (₹)")}</IconLabel></span>
                        {ledgerField(row, "rent", amountInput(row.rent), "number", "mobile Bhada", "min-h-11 border border-line bg-white px-2")}
                      </label>
                      <label><span className="lbl"><IconLabel icon={Banknote}>{t("Hamali (₹)", "हमाली (₹)")}</IconLabel></span>
                        {ledgerField(row, "hamali", amountInput(row.hamali), "number", "mobile Hamali", "min-h-11 border border-line bg-white px-2")}
                      </label>
                      <p className="rounded-lg bg-canvas p-2 text-sm"><IconLabel icon={Receipt}>{t("Receipt fee", "रसीद शुल्क")}</IconLabel><strong className="block">{money(row.receipt_fee ?? 2)}</strong></p>
                      <p className="rounded-lg bg-canvas p-2 text-sm">{t("Entered by", "किसने भरा")} <strong className="block">{row.entry_by || "—"}</strong></p>
                      {row.rent != null && <>
                        <p className="rounded-lg border border-green-700 bg-green-50 p-3 text-base">
                          <IconLabel icon={Banknote}>✓ {t("Already received", "मिल चुके")}</IconLabel><strong className="block text-xl">{money(row.paid_total)}</strong>
                        </p>
                        <p className="rounded-lg border border-amber-800 bg-amber-50 p-3 text-base">
                          <IconLabel icon={Clock3}>! {t("Still to collect", "अभी लेना बाकी")}</IconLabel><strong className="block text-xl">{money(receiptOutstanding(row))}</strong>
                        </p>
                      </>}
                    </div> : <p className="mt-2 text-xs text-muted">{t("Entered by", "किसने भरा")} {row.entry_by || "—"}</p>}
                    <p role="status" aria-live="polite" className={`mt-2 text-xs ${
                      rowStatus.startsWith("Failed") || rowStatus.startsWith("Unsaved") ? "text-red-700"
                        : rowStatus.startsWith("Waiting") ? "text-amber-800" : "text-muted"
                    }`}>{rowStatus}</p>
                  </article>;
                })}
                {canFinanceRead && ledgerRows.length > 0 && <section aria-label="Mobile selected ledger totals"
                  className="grid grid-cols-2 gap-2 rounded-xl border-2 border-brand-700 bg-brand-50 p-3 text-base">
                  <p>{t("Bhada total", "कुल भाड़ा")} <strong className="block">{money(ledgerTotals.bhada)}</strong></p>
                  <p>{t("Hamali total", "कुल हमाली")} <strong className="block">{money(ledgerTotals.hamali)}</strong></p>
                  <p>{t("Receipt fee total", "कुल रसीद शुल्क")} <strong className="block">{money(ledgerTotals.receiptFee)}</strong></p>
                  <p className="font-bold">{t("Total amount", "कुल रकम")} <strong className="block text-xl">{money(ledgerTotals.total)}</strong></p>
                  <p className="col-span-2 text-xs text-muted">{t("Totals exclude voided receipts.", "रद्द रसीदें कुल में शामिल नहीं हैं।")}</p>
                </section>}
              </div>
              {ledgerRows.map((row) => {
                const status = ledgerStatus[row.id] || "Saved";
                return status.startsWith("Failed") ? <div key={`${row.id}-status`} className="border-t border-red-400 bg-red-50 p-2 text-sm">
                  <span>{row.lr_ref}: {status}</span>
                  <button type="button" className="ml-3 underline"
                    onClick={() => status.includes("changed elsewhere")
                      ? reloadLedgerRow(row) : flushLedgerRow(row.id)}>
                    {status.includes("changed elsewhere") ? "Reload" : "Retry"}
                  </button>
                </div> : null;
              })}
            </div>
          ) : <p className="border border-gray-400 bg-white p-4 text-center">No trips for this date.</p>}
        </div>}
      </div>
      {(printReceipt || printMode === "ledger") && createPortal(
        <div className="booking-print-portal" data-mode={printMode}>
          {printMode === "ledger" && <div className="booking-ledger-print">
            <h1>{romanHindi(user?.branding?.name || user?.tenant_name || site?.name)} · रसीद बही</h1>
            <p>{[user?.branding?.address, user?.branding?.city, user?.branding?.state,
              user?.branding?.mobile].filter(Boolean).map(romanHindi).join(" · ")}</p>
            <p>ट्रिप: {ledgerTrip?.trip_ref || ""} · दिनांक: {ledgerDate}</p>
            <table>
              <thead><tr>{["दिनांक", "रसीद क्रमांक", "भेजने वाला", "प्राप्तकर्ता",
                "माल एवं मात्रा", "भाड़ा", "हमाली", "रसीद शुल्क", "प्रविष्टि करने वाला",
                ...(owner ? ["Amount paid"] : [])].map((name) =>
                <th className="border border-black p-1 text-left" key={name}>{name}</th>)}</tr></thead>
              <tbody>{ledgerRows.map((row) => <tr key={row.id}>
                <td className="border border-black p-1">{row.receipt_date || row.operating_date}</td>
                <td className="border border-black p-1">{row.lr_ref}</td>
                <td className="border border-black p-1">{hindiText(row.sender_name_hindi, row.sender_name)}</td>
                <td className="border border-black p-1">{hindiText(row.receiver_name_hindi, row.receiver_name)}</td>
                <td className="border border-black p-1">{getGoodsRows(row).map(hindiLedgerGoodsLine).join(", ")}</td>
                <td className="border border-black p-1">{canFinanceRead ? money(row.rent) : ""}</td>
                <td className="border border-black p-1">{canFinanceRead ? money(row.hamali) : ""}</td>
                <td className="border border-black p-1">{money(row.receipt_fee ?? 2)}</td>
                <td className="border border-black p-1">{row.entry_by || "—"}</td>
                {owner && <td className="border border-black p-1">{row.amount_paid ? "✓" : ""}</td>}
              </tr>)}</tbody>
              {canFinanceRead && <tfoot><tr>
                <td className="border border-black p-1 font-bold" colSpan={5}>कुल (रद्द रसीद छोड़कर)</td>
                <td className="border border-black p-1 font-bold">{money(ledgerTotals.bhada)}</td>
                <td className="border border-black p-1 font-bold">{money(ledgerTotals.hamali)}</td>
                <td className="border border-black p-1 font-bold">{money(ledgerTotals.receiptFee)}</td>
                <td className="border border-black p-1" />
                {owner && <td className="border border-black p-1" />}
              </tr></tfoot>}
            </table>
            {canFinanceRead && <p className="mt-2 text-right font-bold">
              कुल योग (भाड़ा + हमाली + रसीद शुल्क): {money(ledgerTotals.total)}
            </p>}
          </div>}
          {printReceipt && <ReceiptPrint receipt={printReceipt} trip={selectedTrip} site={site}
            branding={user?.branding} showCharges={canFinanceRead}
            controls={{
              receipt_language: receiptLanguage,
              sender_address_enabled: senderAddressEnabled,
              receiver_address_enabled: receiverAddressEnabled,
            }}
            active />}
        </div>,
        document.body,
      )}
    </>
  );
}
