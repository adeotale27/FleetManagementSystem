const BASE = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");

export const assetUrl = (value) => {
  if (!value) return "";
  const url = String(value).trim();
  if (/^(?:https?:|data:)/i.test(url)) return url;
  const origin = BASE || (typeof window !== "undefined" ? window.location.origin : "");
  return origin ? new URL(url, origin).href : url;
};
