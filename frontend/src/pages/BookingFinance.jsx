import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, errMsg } from "../lib/api";
import { Card, ErrorState, Loader, PageHead } from "../components/ui";
import { money0, monthStart, todayISO } from "../lib/format";
import { DATA_CHANGE_EVENT } from "../lib/realtime";

const field = "fld w-full";

function Breakdown({ title, breakdown }) {
  const rows = breakdown?.rows || [];
  return (
    <Card className="p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">No matching booking LRs.</p> : (
        <ul className="mt-2 divide-y divide-line">
          {rows.slice(0, 10).map((row) => (
            <li key={row.label} className="flex items-start justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <strong className="block break-words">{row.label}</strong>
                <span className="text-xs text-muted">{row.lr_count} LRs · {row.parcels} parcels</span>
              </span>
              <strong className="num shrink-0">{money0(row.collectible_outstanding)}</strong>
            </li>
          ))}
        </ul>
      )}
      {breakdown?.truncated && <p className="mt-2 text-xs text-muted">
        Showing the 10 highest outstanding groups.
      </p>}
    </Card>
  );
}

export default function BookingFinance() {
  const [sites, setSites] = useState([]);
  const [data, setData] = useState(null);
  const [range, setRange] = useState({ from_date: monthStart(), to_date: todayISO(), site_id: "" });
  const [applied, setApplied] = useState(range);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(applied).filter(([, value]) => value));
      const [siteResponse, financeResponse] = await Promise.all([
        api.get("/sites"),
        api.get("/sites/system-dashboard", { params }),
      ]);
      if (currentRequest !== requestId.current) return;
      setSites(siteResponse.data);
      setData(financeResponse.data);
    } catch (e) {
      if (currentRequest === requestId.current) setError(errMsg(e));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    refresh();
    window.addEventListener(DATA_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(DATA_CHANGE_EVENT, refresh);
  }, [refresh]);

  const totals = data?.totals;
  const stats = totals ? [
    ["Bhada recorded", money0(totals.recorded_bhada)],
    ["Hamali recorded", money0(totals.recorded_hamali)],
    ["Collections posted", money0(totals.collected_bhada)],
    ["Collectible outstanding", money0(totals.outstanding_bhada)],
    ["Trip expenses", money0(totals.trip_expenses)],
    ["Pending reconciliation", totals.pending_reconciliation],
  ] : [];
  const siteBars = (data?.sites || []).map((row) => ({
    site: row.site.name,
    collections: Number(row.collected_bhada) || 0,
    outstanding: Number(row.outstanding_bhada) || 0,
  }));

  if (loading && !data) return <Loader label="Loading booking finance…" />;
  if (error && !data) return <ErrorState text={error} onRetry={refresh} />;

  return (
    <div className="space-y-5">
      <PageHead title="Booking Finance"
        subtitle="Site-booking charges, posted collections, expenses, and collectible balances. Industrial finance is separate." />
      {error && <ErrorState text={error} onRetry={refresh} />}
      <Card className="p-4">
        <form onSubmit={(event) => {
          event.preventDefault();
          setApplied({ ...range });
        }}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">From
              <input className={field} type="date" value={range.from_date}
                onChange={(event) => setRange({ ...range, from_date: event.target.value })} />
            </label>
            <label className="text-sm">To
              <input className={field} type="date" value={range.to_date}
                onChange={(event) => setRange({ ...range, to_date: event.target.value })} />
            </label>
            <label className="text-sm">Site
              <select className={field} value={range.site_id}
                onChange={(event) => setRange({ ...range, site_id: event.target.value })}>
                <option value="">All sites</option>
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-s w-full justify-center">Apply filters</button>
            </div>
          </div>
        </form>
        {data && <p className="mt-2 text-xs text-muted">
          Trip/LR operating dates {data.from_date} to {data.to_date}; trip expenses follow their recorded expense dates.
          Date ranges may be up to 366 days.
        </p>}
      </Card>
      {loading && data && <p role="status" className="text-sm text-muted">Updating booking finance…</p>}
      {totals && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stats.map(([label, value]) => <Card key={label} className="dashboard-kpi p-3.5">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="num mt-2 break-words text-lg font-bold text-ink">{value}</p>
          </Card>)}
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Collectible outstanding includes reconciled bhada less successfully posted payments.
          Unreconciled and unpriced LRs are shown separately and are not treated as collectible.
          Hamali is informational and is not counted as rent collected or as a cost.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="font-semibold">Collections and collectible outstanding by site</h2>
            {siteBars.length === 0 ? <p className="mt-3 text-sm text-muted">No site data for this period.</p> : (
              <div className="mt-3 h-[280px]" role="img" aria-label="Booking collections and collectible outstanding by site, in Indian rupees">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={siteBars} margin={{ top: 8, right: 8, bottom: 8, left: 4 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="site" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false}
                      tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />
                    <Tooltip formatter={(value) => money0(value)} />
                    <Bar dataKey="collections" name="Collections posted" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outstanding" name="Collectible outstanding" fill="var(--amber)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card className="p-4">
            <h2 className="font-semibold">Site booking finance</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-line text-xs text-muted">
                  <tr>{["Site", "Bookings", "LRs", "Collected", "Outstanding", "Expenses"].map((label) =>
                    <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data.sites || []).map((row) => <tr key={row.site.id}>
                    <th scope="row" className="px-2 py-2 font-medium">{row.site.name}</th>
                    <td className="px-2 py-2">{row.total_trips}</td>
                    <td className="px-2 py-2">{row.total_lrs}</td>
                    <td className="num px-2 py-2">{money0(row.collected_bhada)}</td>
                    <td className="num px-2 py-2">{money0(row.outstanding_bhada)}</td>
                    <td className="num px-2 py-2">{money0(row.trip_expenses)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </Card>
          <Breakdown title="Collectible outstanding by receiver" breakdown={data.receivables?.by_receiver} />
          <Breakdown title="Collectible outstanding by goods" breakdown={data.receivables?.by_goods} />
        </div>
      </>}
    </div>
  );
}
