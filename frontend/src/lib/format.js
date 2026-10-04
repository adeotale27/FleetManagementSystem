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
