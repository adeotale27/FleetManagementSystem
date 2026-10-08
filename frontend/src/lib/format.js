export const money = (n, dash = true) => {
  const v = Number(n || 0);
  if (!v && dash) return "—";
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};
export const money0 = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const dmy = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!d) return iso;
  return `${d}-${m}-${y}`;
};
export const dmyDateTime = (value, includeSeconds = false) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  const time = `${part("hour")}:${part("minute")}${includeSeconds ? `:${part("second")}` : ""} ${part("dayPeriod")}`;
  return `${part("day")}-${part("month")}-${part("year")}, ${time} ${part("timeZoneName")}`;
};
export const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
export const monthStart = () => todayISO().slice(0, 8) + "01";
export const addDaysISO = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const nowTime = () => new Date().toTimeString().slice(0, 5);
export const initials = (s = "") =>
  s.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
