import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useFetch(path, params) {
  const key = JSON.stringify(params || {});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(path, { params: JSON.parse(key) });
      setData(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not load data");
    } finally {
      setLoading(false);
    }
  }, [path, key]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

export const useMaster = (res, params) => useFetch(res ? `/masters/${res}` : null, params);

export const opts = (rows, labelKey = "name", valueKey = "id") =>
  (rows || []).map((r) => ({ value: r[valueKey], label: r[labelKey] }));
