import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { exportCSV } from "../lib/export";
import { money0, monthStart, todayISO } from "../lib/format";
import { Btn, Card, ErrorState, Loader, PageHead } from "../components/ui";

const field = "fld w-full";
const PAGE_SIZE = 50;
const COLUMNS = [
  { key: "operating_date", label: "Operating date" },
  { key: "site_name", label: "Site" },
  { key: "trip_ref", label: "Booking" },
  { key: "lr_ref", label: "LR" },
  { key: "receiver_label", label: "Receiver" },
  { key: "goods_type", label: "Goods" },
  { key: "total_quantity", label: "Quantity" },
  { key: "rent", label: "Bhada" },
  { key: "hamali", label: "Hamali" },
  { key: "paid_total", label: "Collected" },
  { key: "outstanding", label: "Outstanding" },
  { key: "payment_status", label: "Payment status" },
];

function safeExportRows(rows) {
  const textFields = new Set(["site_name", "trip_ref", "lr_ref", "receiver_label", "goods_type", "payment_status"]);
  return rows.map((source) => {
    const row = {
      ...source,
      receiver_label: source.receiver_label || source.receiver_name || "",
      ...(source.rent == null ? { outstanding: "" } : {}),
    };
    return Object.fromEntries(Object.entries(row).map(([key, value]) => {
      if (!textFields.has(key) || value == null) return [key, value];
      const text = String(value);
      return [key, /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text];
    }));
  });
}

export default function BookingReports() {
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({
    from_date: monthStart(), to_date: todayISO(), site_id: "", search: "",
  });
  const [applied, setApplied] = useState(filters);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async (nextOffset = 0, append = false) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries({
        ...applied, limit: PAGE_SIZE, offset: nextOffset,
      }).filter(([, value]) => value !== ""));
      const [siteResponse, reportResponse] = await Promise.all([
        api.get("/sites"),
        api.get("/sites/system-reports/lrs", { params }),
      ]);
      if (currentRequest !== requestId.current) return;
      setSites(siteResponse.data);
      const nextRows = reportResponse.data.rows || [];
      setRows((current) => append ? [...current, ...nextRows] : nextRows);
      setTotal(reportResponse.data.total || 0);
      setOffset(nextOffset + nextRows.length);
    } catch (e) {
      if (currentRequest === requestId.current) setError(errMsg(e));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [applied]);

  useEffect(() => { load(); }, [load]);

  const applyFilters = (event) => {
    event.preventDefault();
    setApplied({ ...filters, search: filters.search.trim() });
  };
  const hasMore = offset < total;

  return (
    <div className="space-y-5">
      <PageHead title="Booking Reports"
        subtitle="Search and export paginated site-booking LR records. Industrial shipment reports remain separate."
        actions={<>
          <Btn variant="s" icon={Download} disabled={!rows.length}
            onClick={() => exportCSV("booking-lr-report-loaded-rows", COLUMNS, safeExportRows(rows))}>
            Export loaded LRs
          </Btn>
          <Btn variant="s" icon={Printer} onClick={() => window.print()}>Print</Btn>
        </>} />
      <Card className="p-4">
        <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">From
            <input className={field} type="date" value={filters.from_date}
              onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} />
          </label>
          <label className="text-sm">To
            <input className={field} type="date" value={filters.to_date}
              onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} />
          </label>
          <label className="text-sm">Site
            <select className={field} value={filters.site_id}
              onChange={(event) => setFilters({ ...filters, site_id: event.target.value })}>
              <option value="">All sites</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Search LRs
            <input className={field} maxLength={120} value={filters.search}
              placeholder="LR, receiver, goods, booking"
              onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          </label>
          <div className="flex items-end">
            <Btn type="submit" className="w-full justify-center">Apply filters</Btn>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted">
          {total.toLocaleString("en-IN")} matching LRs · {applied.from_date} to {applied.to_date} · CSV includes the rows currently loaded below.
          Date ranges may be up to 366 days.
        </p>
      </Card>
      {error && <ErrorState text={error} onRetry={() => load()} />}
      {loading && rows.length === 0 ? <Loader label="Loading booking reports…" /> : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-canvas text-xs text-muted">
                <tr>{COLUMNS.map((column) => <th key={column.key} className="px-3 py-3 font-medium">{column.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => <tr key={`${row.site_id}-${row.id}`} className="hover:bg-canvas/70">
                  <td className="px-3 py-3">{row.operating_date}</td>
                  <td className="px-3 py-3">{row.site_name}</td>
                  <td className="px-3 py-3">{row.trip_ref}</td>
                  <td className="px-3 py-3 font-medium">{row.lr_ref}</td>
                  <td className="max-w-48 truncate px-3 py-3" title={row.receiver_label || row.receiver_name}>
                    {row.receiver_label || row.receiver_name || "—"}
                  </td>
                  <td className="max-w-40 truncate px-3 py-3" title={row.goods_type}>{row.goods_type || "—"}</td>
                  <td className="num px-3 py-3">{row.total_quantity ?? 0}</td>
                  <td className="num px-3 py-3">{row.rent == null ? "—" : money0(row.rent)}</td>
                  <td className="num px-3 py-3">{row.hamali == null ? "—" : money0(row.hamali)}</td>
                  <td className="num px-3 py-3">{row.paid_total === undefined ? "—" : money0(row.paid_total)}</td>
                  <td className="num px-3 py-3">{row.rent == null || row.outstanding === undefined
                    ? "—" : money0(row.outstanding)}</td>
                  <td className="px-3 py-3">{row.payment_status || (row.reconciled ? "Reconciled" : "Pending")}</td>
                </tr>)}
                {!loading && rows.length === 0 && <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-muted">
                  No booking LRs match these filters.
                </td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">Showing {rows.length} of {total} matching LRs</span>
            {hasMore && <Btn variant="s" disabled={loading} onClick={() => load(offset, true)}>
              {loading ? "Loading…" : "Load more"}
            </Btn>}
          </div>
        </Card>
      )}
    </div>
  );
}
