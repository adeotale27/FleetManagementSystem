import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Ban, Banknote, Download, Fuel, HandCoins, Plus, Receipt, Wallet } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useFetch, useMaster, opts } from "../lib/hooks";
import { money, money0, dmy, todayISO, monthStart } from "../lib/format";
import { exportCSV, exportPDF } from "../lib/export";
import EntryModal from "../components/QuickForms";
import {
  Autocomplete, Badge, Btn, Card, DataTable, EmptyState, ErrorState, Input, Loader, Modal,
  Money, PageHead, Select, Stat, Tabs, TextArea, toast,
} from "../components/ui";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "receivables", label: "Receivables" },
  { value: "payables", label: "Payables" },
  { value: "collections", label: "Collections" },
  { value: "deewanji", label: "Deewanji" },
  { value: "payments", label: "Payments" },
  { value: "expenses", label: "Expenses" },
  { value: "fuel", label: "Diesel" },
  { value: "tpl", label: "3PL" },
  { value: "cash", label: "Cash & Bank" },
];
const PIE = ["#0B5C4E", "#2C8474", "#E0A33E", "#C1862A", "#1B242F", "#69747F", "#8FBFB4"];

export default function Finance() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "overview";
  const nav = useNavigate();
  const [range, setRange] = useState({ frm: monthStart(), to: todayISO() });
  const [entry, setEntry] = useState(null);
  const [tplOpen, setTplOpen] = useState(false);

  const sum = useFetch("/finance/summary");
  const charts = useFetch(tab === "overview" ? "/finance/charts" : null, { days: 14 });
  const recv = useFetch(["overview", "receivables"].includes(tab) ? "/finance/receivables" : null);
  const pay = useFetch(["overview", "payables"].includes(tab) ? "/finance/payables" : null);
  const colls = useFetch(["collections", "deewanji"].includes(tab) ? "/receipts" : null, range);
  const daily = useFetch(tab === "deewanji" ? "/deewanji/daily" : null, range);
  const hands = useFetch(tab === "deewanji" ? "/handovers" : null, range);
  const pays = useFetch(tab === "payments" ? "/payments" : null, range);
  const exps = useFetch(tab === "expenses" ? "/expenses" : null, range);
  const fuel = useFetch(tab === "fuel" ? "/fuel" : null, range);
  const tpl = useFetch(tab === "tpl" ? "/tpl" : null, range);
  const cash = useFetch(tab === "cash" ? "/finance/cashbook" : null, range);

  const refresh = () => {
    sum.reload();
    [recv, pay, colls, daily, hands, pays, exps, fuel, tpl, cash, charts].forEach((x) => x.data && x.reload());
  };

  const cancelEntry = async (path, id) => {
    if (!window.confirm("Cancel this entry? It will be reversed in all ledgers but kept in history.")) return;
    try { await api.post(`${path}/${id}/cancel`); toast("Entry cancelled and reversed"); refresh(); }
    catch (e) { toast(errMsg(e), "err"); }
  };

  const s = sum.data;
  const DateBar = (
    <Card className="mb-4 flex flex-wrap items-end gap-3 p-3.5">
      <Input label="From" type="date" value={range.frm} onChange={(e) => setRange({ ...range, frm: e.target.value })} data-testid="fin-from" />
      <Input label="To" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} data-testid="fin-to" />
      <Btn variant="s" onClick={() => setRange({ frm: todayISO(), to: todayISO() })}>Today</Btn>
      <Btn variant="s" onClick={() => setRange({ frm: monthStart(), to: todayISO() })}>This Month</Btn>
    </Card>
  );

  return (
    <div>
      <PageHead title="Finance" subtitle="Every rupee, calculated from your entries — nothing typed by hand"
        actions={
          <>
            <Btn variant="s" icon={Banknote} data-testid="fin-collection" onClick={() => setEntry("collection")}>Collection</Btn>
            <Btn variant="s" icon={Wallet} data-testid="fin-payment" onClick={() => setEntry("payment")}>Payment</Btn>
            <Btn variant="s" icon={Receipt} data-testid="fin-expense" onClick={() => setEntry("expense")}>Expense</Btn>
            <Btn variant="s" icon={Fuel} data-testid="fin-fuel" onClick={() => setEntry("fuel")}>Diesel</Btn>
            <Btn icon={HandCoins} data-testid="fin-handover" onClick={() => setEntry("handover")}>Handover</Btn>
          </>
        } />

      <Tabs value={tab} onChange={(v) => setSp({ tab: v })} tabs={TABS} />

      {sum.loading && !s ? <Loader /> : sum.error ? <ErrorState text={sum.error} onRetry={sum.reload} /> : (
        <>
          {tab === "overview" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat testid="fin-to-receive" label="Money To Receive" value={money0(s.to_receive)} tone="text-brand-600"
                  sub={s.overdue ? `${money0(s.overdue)} overdue` : "All within due date"} onClick={() => setSp({ tab: "receivables" })} />
                <Stat testid="fin-to-pay" label="Money To Pay" value={money0(s.to_pay)} tone="text-red-600" onClick={() => setSp({ tab: "payables" })} />
                <Stat label="Received Today" value={money0(s.received_today)} onClick={() => setSp({ tab: "collections" })} />
                <Stat label="Paid Today" value={money0(s.paid_today)} onClick={() => setSp({ tab: "payments" })} />
              </div>
              <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                <Stat label="Cash in Hand" value={money0(s.cash)} tone={s.cash < 0 ? "text-red-600" : ""} onClick={() => setSp({ tab: "cash" })} />
                <Stat label="Bank Balance" value={money0(s.bank)} tone={s.bank < 0 ? "text-red-600" : ""} onClick={() => setSp({ tab: "cash" })} />
                <Stat label="Deewanji Cash" value={money0(s.deewanji_cash)} tone="text-amber-600" onClick={() => setSp({ tab: "deewanji" })} />
                <Stat label="Driver Advances" value={money0(s.driver_advances)} onClick={() => nav("/team")} />
                <Stat label="Team Advances" value={money0(s.employee_advances)} onClick={() => nav("/team?tab=team")} />
              </div>

              {charts.loading && !charts.data ? <Loader label="Building charts…" /> : charts.data && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Money In vs Money Out" sub="Last 14 days">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={charts.data.money_flow}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EB" vertical={false} />
                        <XAxis dataKey="date" fontSize={11} stroke="#69747F" />
                        <YAxis fontSize={11} stroke="#69747F" tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                        <Tooltip formatter={(v) => money(v)} />
                        <Legend iconSize={9} />
                        <Bar dataKey="money_in" name="Money In" fill="#0B5C4E" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="money_out" name="Money Out" fill="#E0A33E" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Collection Trend" sub="Money received per day">
                    {charts.data.collection_trend.length ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={charts.data.collection_trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EB" vertical={false} />
                          <XAxis dataKey="date" fontSize={11} stroke="#69747F" />
                          <YAxis fontSize={11} stroke="#69747F" tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                          <Tooltip formatter={(v) => money(v)} />
                          <Line type="monotone" dataKey="amount" stroke="#0B5C4E" strokeWidth={2.5} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <EmptyState title="No collections yet" text="Record a collection to see the trend." />}
                  </ChartCard>

                  <ChartCard title="Expense Breakdown" sub="Last 14 days">
                    {charts.data.expense_breakdown.length ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={charts.data.expense_breakdown} dataKey="value" nameKey="name"
                            innerRadius={50} outerRadius={85} paddingAngle={2}>
                            {charts.data.expense_breakdown.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => money(v)} />
                          <Legend iconSize={9} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <EmptyState title="No expenses yet" />}
                  </ChartCard>

                  <ChartCard title="Receivable Aging" sub="How old is the pending money">
                    {charts.data.receivable_aging.length ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={charts.data.receivable_aging} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EB" horizontal={false} />
                          <XAxis type="number" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                          <YAxis type="category" dataKey="name" fontSize={11} width={62} />
                          <Tooltip formatter={(v) => money(v)} />
                          <Bar dataKey="value" name="Outstanding" fill="#2C8474" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState title="Nothing pending" />}
                  </ChartCard>
                </div>
              )}
            </>
          )}

          {tab === "receivables" && (
            recv.loading && !recv.data ? <Loader /> : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
                  <Stat label="Total Outstanding" value={money0(recv.data?.total)} tone="text-brand-600" />
                  {["Current", "1-30", "31-60", "61-90", "90+"].map((b) => (
                    <Stat key={b} label={b === "Current" ? "Current" : `${b} days`} value={money0(recv.data?.buckets?.[b] || 0)} />
                  ))}
                </div>
                <Card className="overflow-hidden">
                  <DataTable testid="receivables-table"
                    columns={[
                      { key: "party", label: "Party", strong: true },
                      { key: "mobile", label: "Mobile" },
                      { key: "total", label: "Total Billed", type: "money", right: true },
                      { key: "received", label: "Received", type: "money", right: true },
                      { key: "outstanding", label: "Outstanding", type: "money", right: true },
                      { key: "due_date", label: "Due Date", type: "date" },
                      { key: "age", label: "Days Overdue", right: true },
                      { key: "bucket", label: "Aging" },
                      { key: "status", label: "Status", type: "badge" },
                    ]}
                    rows={recv.data?.rows || []} onRowClick={(r) => nav(`/parties/${r.party_id}`)}
                    empty={<EmptyState title="Nothing to receive" text="All parties have settled their payments." />}
                    mobile={(r) => (
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-semibold">{r.party}</p>
                          <p className="text-[12.5px] text-muted">{r.mobile || "—"} · due {dmy(r.due_date)}</p></div>
                        <div className="text-right"><p className="num font-semibold">{money(r.outstanding)}</p><Badge>{r.status}</Badge></div>
                      </div>
                    )} />
                </Card>
                <ExportBar name="receivables" rows={recv.data?.rows} cols={[
                  { key: "party", label: "Party" }, { key: "mobile", label: "Mobile" },
                  { key: "total", label: "Billed" }, { key: "received", label: "Received" },
                  { key: "outstanding", label: "Outstanding" }, { key: "bucket", label: "Aging" }]} />
              </>
            ))}

          {tab === "payables" && (
            pay.loading && !pay.data ? <Loader /> : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                  <Stat label="Total To Pay" value={money0(pay.data?.total)} tone="text-red-600" />
                  <Stat label="Fuel Pumps" value={money0((pay.data?.rows || []).filter((r) => r.entity_type === "fuel_pump").reduce((a, b) => a + b.outstanding, 0))} />
                  <Stat label="3PL Partners" value={money0((pay.data?.rows || []).filter((r) => r.entity_type === "partner").reduce((a, b) => a + b.outstanding, 0))} />
                </div>
                <Card className="overflow-hidden">
                  <DataTable testid="payables-table"
                    columns={[
                      { key: "name", label: "Name", strong: true },
                      { key: "type", label: "Type" },
                      { key: "total", label: "Total", type: "money", right: true },
                      { key: "paid", label: "Paid", type: "money", right: true },
                      { key: "outstanding", label: "Outstanding", type: "money", right: true },
                      { key: "last_date", label: "Last Entry", type: "date" },
                      { key: "status", label: "Status", type: "badge" },
                    ]}
                    rows={pay.data?.rows || []}
                    empty={<EmptyState title="Nothing to pay" text="No pending fuel pump or partner bills." />} />
                </Card>
              </>
            ))}

          {["collections", "payments", "expenses", "fuel", "cash", "tpl", "deewanji"].includes(tab) && DateBar}

          {tab === "collections" && (
            colls.loading && !colls.data ? <Loader /> : (
              <Card className="overflow-hidden">
                <SectionHead title={`Collections · ${money(sumBy(colls.data, "amount"))}`}
                  action={<Btn variant="s" icon={Plus} onClick={() => setEntry("collection")}>New</Btn>} />
                <DataTable testid="collections-table"
                  columns={[
                    { key: "date", label: "Date", type: "date" },
                    { key: "party_name", label: "Party", strong: true },
                    { key: "lr_no", label: "LR" },
                    { key: "mode", label: "Mode" },
                    { key: "deewanji_name", label: "Collected By", render: (r) => r.deewanji_name || "Office" },
                    { key: "reference", label: "Reference" },
                    { key: "amount", label: "Amount", type: "money", right: true },
                    { key: "act", label: "", render: (r) => !r.cancelled && (
                      <button onClick={(e) => { e.stopPropagation(); cancelEntry("/receipts", r.id); }}
                        className="text-muted hover:text-red-600" title="Cancel & reverse"><Ban size={15} /></button>) },
                  ]}
                  rows={colls.data || []}
                  empty={<EmptyState title="No collections in this period" action={<Btn onClick={() => setEntry("collection")}>Record Collection</Btn>} />}
                  mobile={(r) => (
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{r.party_name}</p>
                        <p className="text-[12.5px] text-muted">{dmy(r.date)} · {r.mode} · {r.deewanji_name || "Office"}</p></div>
                      <p className={`num font-semibold ${r.cancelled ? "text-muted line-through" : "text-brand-600"}`}>{money(r.amount)}</p>
                    </div>
                  )} />
              </Card>
            ))}

          {tab === "deewanji" && (
            daily.loading && !daily.data ? <Loader /> : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Cash With All Deewanji" value={money0(daily.data?.total_held)} tone="text-amber-600" />
                  <Stat label="Collected (period)" value={money0(sumBy(daily.data?.rows, "total"))} />
                  <Stat label="Handed Over (period)" value={money0(sumBy(hands.data, "amount"))} />
                  <Stat label="Deewanji Count" value={(daily.data?.people || []).length} />
                </div>

                {(daily.data?.people || []).length > 0 && (
                  <div className="mb-4 grid gap-3 md:grid-cols-3">
                    {daily.data.people.map((p) => (
                      <Card key={p.id} className="flex items-center justify-between p-4">
                        <div><p className="font-head text-[15px] font-bold">{p.name}</p>
                          <p className="text-[12.5px] text-muted">Cash in hand</p></div>
                        <p className="num font-head text-[18px] font-bold text-amber-600">{money(p.cash_with)}</p>
                      </Card>
                    ))}
                  </div>
                )}

                <Card className="mb-4 overflow-hidden">
                  <SectionHead title="Day-wise Collection" />
                  <DataTable testid="deewanji-daily"
                    columns={[
                      { key: "date", label: "Date", type: "date" },
                      { key: "deewanji_name", label: "Deewanji", strong: true },
                      { key: "cash", label: "Cash", type: "money", right: true },
                      { key: "upi", label: "UPI", type: "money", right: true },
                      { key: "bank", label: "Bank", type: "money", right: true },
                      { key: "total", label: "Total Collection", type: "money", right: true },
                      { key: "handed_over", label: "Handed Over", type: "money", right: true },
                      { key: "cash_with_deewanji", label: "Cash With Him", type: "money", right: true },
                    ]}
                    rows={(daily.data?.rows || []).map((r, i) => ({ ...r, id: `${r.date}-${i}` }))}
                    empty={<EmptyState title="No Deewanji collection in this period"
                      text="Record a collection and choose Collected By → Deewanji." />}
                    mobile={(r) => (
                      <div>
                        <div className="flex justify-between"><span className="font-semibold">{r.deewanji_name}</span>
                          <span className="num font-semibold">{money(r.total)}</span></div>
                        <p className="mt-1 text-[12.5px] text-muted">{dmy(r.date)} · Cash {money(r.cash)} · UPI {money(r.upi)}</p>
                        <p className="text-[12.5px] text-muted">Handed over {money(r.handed_over)} · In hand {money(r.cash_with_deewanji)}</p>
                      </div>
                    )} />
                </Card>

                <Card className="overflow-hidden">
                  <SectionHead title="Handovers"
                    action={<Btn variant="s" icon={Plus} onClick={() => setEntry("handover")}>New Handover</Btn>} />
                  <DataTable testid="handovers-table"
                    columns={[
                      { key: "date", label: "Date", type: "date" },
                      { key: "deewanji_name", label: "From", strong: true },
                      { key: "to", label: "To" },
                      { key: "mode", label: "Mode" },
                      { key: "reference", label: "Reference" },
                      { key: "amount", label: "Amount", type: "money", right: true },
                    ]}
                    rows={hands.data || []}
                    empty={<EmptyState title="No handover recorded" text="Record when Deewanji gives cash to the office." />} />
                </Card>
              </>
            ))}

          {tab === "payments" && (
            pays.loading && !pays.data ? <Loader /> : (
              <Card className="overflow-hidden">
                <SectionHead title={`Payments Out · ${money(sumBy(pays.data, "amount"))}`}
                  action={<Btn variant="s" icon={Plus} onClick={() => setEntry("payment")}>New</Btn>} />
                <DataTable testid="payments-table"
                  columns={[
                    { key: "date", label: "Date", type: "date" },
                    { key: "entity_name", label: "Paid To", strong: true },
                    { key: "entity_type", label: "Type" },
                    { key: "purpose", label: "Purpose" },
                    { key: "mode", label: "Mode" },
                    { key: "amount", label: "Amount", type: "money", right: true },
                    { key: "act", label: "", render: (r) => !r.cancelled && (
                      <button onClick={() => cancelEntry("/payments", r.id)} className="text-muted hover:text-red-600"><Ban size={15} /></button>) },
                  ]}
                  rows={pays.data || []}
                  empty={<EmptyState title="No payments in this period" action={<Btn onClick={() => setEntry("payment")}>Record Payment</Btn>} />} />
              </Card>
            ))}

          {tab === "expenses" && (
            exps.loading && !exps.data ? <Loader /> : (
              <Card className="overflow-hidden">
                <SectionHead title={`Expenses · ${money(sumBy(exps.data, "amount"))}`}
                  action={<Btn variant="s" icon={Plus} onClick={() => setEntry("expense")}>New</Btn>} />
                <DataTable testid="expenses-table"
                  columns={[
                    { key: "date", label: "Date", type: "date" },
                    { key: "category", label: "Category", strong: true },
                    { key: "vehicle_no", label: "Vehicle" },
                    { key: "vendor", label: "Paid To" },
                    { key: "mode", label: "Mode" },
                    { key: "remarks", label: "Remarks" },
                    { key: "amount", label: "Amount", type: "money", right: true },
                    { key: "act", label: "", render: (r) => !r.cancelled && (
                      <button onClick={() => cancelEntry("/expenses", r.id)} className="text-muted hover:text-red-600"><Ban size={15} /></button>) },
                  ]}
                  rows={exps.data || []}
                  empty={<EmptyState title="No expenses in this period" action={<Btn onClick={() => setEntry("expense")}>Record Expense</Btn>} />}
                  mobile={(r) => (
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{r.category}</p>
                        <p className="text-[12.5px] text-muted">{dmy(r.date)} · {r.vehicle_no || r.vendor || r.mode}</p></div>
                      <p className="num font-semibold">{money(r.amount)}</p>
                    </div>
                  )} />
              </Card>
            ))}

          {tab === "fuel" && (
            fuel.loading && !fuel.data ? <Loader /> : (
              <Card className="overflow-hidden">
                <SectionHead title={`Diesel · ${money(sumBy(fuel.data, "amount"))} · ${sumBy(fuel.data, "quantity").toFixed(0)} L`}
                  action={<Btn variant="s" icon={Plus} onClick={() => setEntry("fuel")}>New</Btn>} />
                <DataTable testid="fuel-table"
                  columns={[
                    { key: "date", label: "Date", type: "date" },
                    { key: "vehicle_no", label: "Vehicle", strong: true },
                    { key: "pump_name", label: "Fuel Pump" },
                    { key: "quantity", label: "Litres", right: true },
                    { key: "rate", label: "Rate", type: "money", right: true },
                    { key: "amount", label: "Amount", type: "money", right: true },
                    { key: "mode", label: "Payment" },
                    { key: "act", label: "", render: (r) => !r.cancelled && (
                      <button onClick={() => cancelEntry("/fuel", r.id)} className="text-muted hover:text-red-600"><Ban size={15} /></button>) },
                  ]}
                  rows={fuel.data || []}
                  empty={<EmptyState title="No diesel entries" action={<Btn onClick={() => setEntry("fuel")}>Record Diesel</Btn>} />} />
              </Card>
            ))}

          {tab === "tpl" && (
            tpl.loading && !tpl.data ? <Loader /> : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat label="Customer Amount" value={money0(sumBy(tpl.data, "customer_amount"))} />
                  <Stat label="Partner Amount" value={money0(sumBy(tpl.data, "partner_amount"))} />
                  <Stat label="Expenses" value={money0(sumBy(tpl.data, "expenses"))} />
                  <Stat label="Margin" value={money0(sumBy(tpl.data, "margin"))} tone="text-brand-600" />
                </div>
                <Card className="overflow-hidden">
                  <SectionHead title="3PL Trips"
                    action={<Btn variant="s" icon={Plus} data-testid="add-tpl" onClick={() => setTplOpen(true)}>New 3PL Trip</Btn>} />
                  <DataTable testid="tpl-table"
                    columns={[
                      { key: "date", label: "Date", type: "date" },
                      { key: "party_name", label: "Customer", strong: true },
                      { key: "partner_name", label: "Partner" },
                      { key: "route", label: "Route", render: (r) => `${r.from_name} → ${r.to_name}` },
                      { key: "customer_amount", label: "Receivable", type: "money", right: true },
                      { key: "partner_amount", label: "Payable", type: "money", right: true },
                      { key: "margin", label: "Margin", type: "money", right: true },
                      { key: "act", label: "", render: (r) => !r.cancelled && (
                        <button onClick={() => cancelEntry("/tpl", r.id)} className="text-muted hover:text-red-600"><Ban size={15} /></button>) },
                    ]}
                    rows={tpl.data || []}
                    empty={<EmptyState title="No 3PL trips" text="Add a trip done through a partner company."
                      action={<Btn onClick={() => setTplOpen(true)}>New 3PL Trip</Btn>} />} />
                </Card>
              </>
            ))}

          {tab === "cash" && (
            cash.loading && !cash.data ? <Loader /> : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <Stat label="Cash in Hand" value={money0(cash.data?.position?.cash)} tone={cash.data?.position?.cash < 0 ? "text-red-600" : ""} />
                  <Stat label="Bank Balance" value={money0(cash.data?.position?.bank)} tone={cash.data?.position?.bank < 0 ? "text-red-600" : ""} />
                  <Stat label="Cash With Deewanji" value={money0(cash.data?.position?.deewanji)} tone="text-amber-600" />
                </div>
                <Card className="overflow-hidden">
                  <SectionHead title="Cash & Bank Book" />
                  <DataTable testid="cashbook-table"
                    columns={[
                      { key: "date", label: "Date", type: "date" },
                      { key: "description", label: "Description", strong: true },
                      { key: "account", label: "Account" },
                      { key: "mode", label: "Mode" },
                      { key: "in", label: "Money In", right: true, render: (r) => r.direction === "in" ? <span className="num text-brand-600">{money(r.amount)}</span> : "—" },
                      { key: "out", label: "Money Out", right: true, render: (r) => r.direction === "out" ? <span className="num text-red-600">{money(r.amount)}</span> : "—" },
                    ]}
                    rows={cash.data?.rows || []}
                    empty={<EmptyState title="No cash movement in this period" />}
                    mobile={(r) => (
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-[13.5px] font-semibold">{r.description}</p>
                          <p className="text-[12.5px] text-muted">{dmy(r.date)} · {r.account} · {r.mode || "—"}</p></div>
                        <p className={`num font-semibold ${r.direction === "in" ? "text-brand-600" : "text-red-600"}`}>
                          {r.direction === "in" ? "+" : "-"}{money(r.amount)}</p>
                      </div>
                    )} />
                </Card>
              </>
            ))}
        </>
      )}

      <EntryModal kind={entry || "collection"} open={!!entry} onClose={() => setEntry(null)} onDone={refresh} />
      <TplModal open={tplOpen} onClose={() => setTplOpen(false)} onDone={refresh} />
    </div>
  );
}

const sumBy = (rows, k) => (rows || []).filter((r) => !r.cancelled).reduce((s, r) => s + Number(r[k] || 0), 0);

const SectionHead = ({ title, action }) => (
  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
    <h3 className="font-head text-[15.5px] font-bold">{title}</h3>
    {action}
  </div>
);

const ChartCard = ({ title, sub, children }) => (
  <Card className="p-4">
    <div className="mb-3"><h3 className="font-head text-[15.5px] font-bold">{title}</h3>
      <p className="text-[12.5px] text-muted">{sub}</p></div>
    {children}
  </Card>
);

const ExportBar = ({ name, rows, cols }) => (
  <div className="mt-3 flex justify-end gap-2">
    <Btn variant="s" icon={Download} onClick={() => exportCSV(name, cols, rows || [])}>CSV</Btn>
    <Btn variant="s" onClick={() => exportPDF(name.toUpperCase(), cols, rows || [])}>PDF</Btn>
  </div>
);

function TplModal({ open, onClose, onDone }) {
  const [f, setF] = useState({ date: todayISO() });
  const [partyText, setPartyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const partners = useMaster(open ? "partners" : null);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const save = async () => {
    setBusy(true); setErr("");
    try {
      await api.post("/tpl", { ...f, party_name: f.party_name || partyText });
      toast("3PL trip saved"); onDone?.(); onClose(); setF({ date: todayISO() }); setPartyText("");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New 3PL Trip" subtitle="Trip done through a partner company"
      footer={<><Btn variant="s" className="flex-1" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1" data-testid="tpl-save" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Btn></>}>
      <div className="space-y-4">
        <Input label="Date" type="date" value={f.date || ""} onChange={set("date")} />
        <Autocomplete label="Customer" value={partyText} testid="tpl-party"
          onChange={(v) => { setPartyText(v); setF((s) => ({ ...s, party_id: null, party_name: v })); }}
          onPick={(p) => { setPartyText(p.name); setF((s) => ({ ...s, party_id: p.id, party_name: p.name })); }}
          fetcher={async (q) => (await api.get("/parties/suggest", { params: { q } })).data}
          hint="New customer is saved to your party list" />
        <Select label="3PL Partner" value={f.partner_id || ""} onChange={set("partner_id")}
          data-testid="tpl-partner" options={opts(partners.data)}
          hint="Add partners from Settings → 3PL Partners" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="From" value={f.from_name || ""} onChange={set("from_name")} />
          <Input label="To" value={f.to_name || ""} onChange={set("to_name")} />
          <Input label="Vehicle No" value={f.vehicle_no || ""} onChange={set("vehicle_no")} />
          <Input label="Driver" value={f.driver_name || ""} onChange={set("driver_name")} />
          <Money label="Customer Amount" value={f.customer_amount || ""} onChange={set("customer_amount")} data-testid="tpl-customer-amount" />
          <Money label="Partner Amount" value={f.partner_amount || ""} onChange={set("partner_amount")} data-testid="tpl-partner-amount" />
          <Money label="Our Expenses" value={f.expenses || ""} onChange={set("expenses")} />
        </div>
        <TextArea label="Remarks" value={f.remarks || ""} onChange={set("remarks")} />
        {err && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-[13.5px] font-medium text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}
