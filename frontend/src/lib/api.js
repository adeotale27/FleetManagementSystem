import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const api = axios.create({ baseURL: `${BASE}/api` });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("fms_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !String(err.config?.url).includes("/auth/login")) {
      localStorage.removeItem("fms_token");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) =>
  e?.response?.data?.detail || e?.message || "Something went wrong. Please try again.";

export const uploadFile = async (file, kind = "misc") => {
  const fd = new FormData();
  fd.append("file", file);
  const r = await api.post(`/upload?kind=${kind}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  return `${BASE}${r.data.url}`;
};
