import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Banknote, CalendarClock, Fuel, IdCard, Receipt, Truck, Users,
  Wallet, ArrowUpRight, ArrowDownRight, HandCoins, FileText,
} from "lucide-react";
import { useFetch } from "../lib/hooks";
import { money, money0, dmy } from "../lib/format";
import { Badge, Card, DataTable, EmptyState, ErrorState, Loader, PageHead, Stat } from "../components/ui";

export default function Dashboard() {
  const { data: d, loading, error, reload } = useFetch("/dashboard");
  const nav = useNavigate();

  useEffect(() => {
    const h = () => reload();
    window.addEventListener("fms:refresh", h);
    return () => window.removeEventListener("fms:refresh", h);
  }, [reload]);

  if (loading && !d) return <Loader label="Loading your business…" />;
  if (error) return <ErrorState text={error} onRetry={reload} />;

  const m = d.money, a = d.alerts, c = d.collections;
  const alerts = [
    { n: a.pending_payments, label: "Pending Payments", to: "/finance?tab=receivables", icon: Receipt, bad: false },
    { n: a.overdue, label: "Overdue Payments", to: "/finance?tab=receivables", icon: AlertTriangle, bad: true },
    { n: a.vehicle_docs, label: "Vehicle Documents Expiring", to: "/vehicles?tab=documents", icon: FileText, bad: true },
    { n: a.driver_licence, label: "Driver Licence Expiring", to: "/team", icon: IdCard, bad: true },
    { n: money0(a.driver_advances), label: "Driver Advances Outstanding", to: "/team", icon: HandCoins, bad: false },
    { n: money0(a.employee_advances), label: "Team Advances Outstanding", to: "/team?tab=team", icon: HandCoins, bad: false },
  ];

  return (
    <div>
      <PageHead title="Business Dashboard"
        subtitle={`Today · ${dmy(new Date().toISOString())} — everything below is calculated from your entries`} />

      <Section title="Trips today">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat testid="stat-trips-today" label="Today's Trips" value={d.trips.today} icon={CalendarClock} onClick={() => nav("/trips")} />
          <Stat testid="stat-active-trips" label="Active Trips" value={d.trips.active} icon={Truck} onClick={() => nav("/trips?status=In Transit")} />
          <Stat testid="stat-completed" label="Completed Today" value={d.trips.completed_today} icon={Truck} onClick={() => nav("/trips?status=Completed")} />
          <Stat testid="stat-veh-available" label="Available Vehicles" value={d.vehicles.available} icon={Truck} onClick={() => nav("/vehicles")} />
          <Stat testid="stat-veh-ontrip" label="Vehicles on Trip" value={d.vehicles.on_trip} icon={Truck} onClick={() => nav("/vehicles")} />
        </div>
      </Section>

      <Section title="Money">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat testid="stat-to-receive" label="Money to Receive" value={money0(m.to_receive)} icon={ArrowDownRight}
            tone="text-brand-600" onClick={() => nav("/finance?tab=receivables")} sub="Tap to see parties" />
          <Stat testid="stat-received-today" label="Received Today" value={money0(m.received_today)} icon={Banknote}
            onClick={() => nav("/finance?tab=collections")} />
          <Stat testid="stat-to-pay" label="Money to Pay" value={money0(m.to_pay)} icon={ArrowUpRight}
            tone="text-red-600" onClick={() => nav("/finance?tab=payables")} />
          <Stat testid="stat-paid-today" label="Paid Today" value={money0(m.paid_today)} icon={Wallet}
            onClick={() => nav("/finance?tab=payments")} />
          <Stat testid="stat-expenses-today" label="Today's Expenses" value={money0(m.expenses_today)} icon={Receipt}
            onClick={() => nav("/finance?tab=expenses")} />
        </div>
      </Section>

      <Section title="Collections & cash">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat testid="stat-collection-today" label="Today's Collection" value={money0(c.today)} icon={Banknote}
            onClick={() => nav("/finance?tab=collections")} />
          <Stat label="Deewanji Collection" value={money0(c.deewanji_today)} icon={Users}
            onClick={() => nav("/finance?tab=deewanji")} />
          <Stat testid="stat-deewanji-cash" label="Cash With Deewanji" value={money0(c.cash_with_deewanji)} icon={HandCoins}
            tone="text-amber-600" onClick={() => nav("/finance?tab=deewanji")} />
          <Stat label="Cash in Hand" value={money0(m.cash)} icon={Wallet} onClick={() => nav("/finance?tab=cash")} />
          <Stat label="Bank Balance" value={money0(m.bank)} icon={Wallet} onClick={() => nav("/finance?tab=cash")} />
        </div>
      </Section>

      <Section title="People & LR">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Total Drivers" value={d.people.drivers} icon={Users} onClick={() => nav("/team")} />
          <Stat label="Team Members" value={d.people.team} icon={Users} onClick={() => nav("/team?tab=team")} />
          <Stat label="Total LRs" value={d.total_lrs} icon={FileText} onClick={() => nav("/trips?tab=lrs")} />
          <Stat label="Unpaid LRs" value={d.pending_lrs} icon={FileText} onClick={() => nav("/trips?tab=lrs")} />
          <Stat label="Diesel Today" value={money0(m.fuel_today)} icon={Fuel} onClick={() => nav("/finance?tab=fuel")} />
        </div>
      </Section>

      <Section title="Needs your attention">
        <div className="grid gap-3 md:grid-cols-3">
          {alerts.map((al) => (
            <button key={al.label} onClick={() => nav(al.to)} data-testid={`alert-${al.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className="card flex items-center gap-3 p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-brand-400">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${al.bad ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"}`}>
                <al.icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="num font-head text-[18px] font-bold leading-none">{al.n}</p>
                <p className="mt-1 truncate text-[12.5px] text-muted">{al.label}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Today's Trips" action={() => nav("/trips")}>
          <DataTable testid="dash-trips"
            columns={[
              { key: "trip_no", label: "Trip", strong: true },
              { key: "route", label: "Route", render: (r) => `${r.from_name} → ${r.to_name}` },
              { key: "vehicle_no", label: "Vehicle" },
              { key: "driver_name", label: "Driver" },
              { key: "trip_amount", label: "Amount", type: "money", right: true },
              { key: "status", label: "Status", type: "badge" },
            ]}
            rows={d.lists.trips_today} onRowClick={(r) => nav(`/trips/${r.id}`)}
            empty={<EmptyState title="No trips today" text="Create a trip to get started." />}
            mobile={(r) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{r.trip_no}</span><Badge>{r.status}</Badge>
                </div>
                <p className="mt-1 text-[13.5px] text-muted">{r.from_name} → {r.to_name}</p>
                <p className="mt-1 text-[13px] text-muted">{r.vehicle_no} · {r.driver_name || "No driver"} · <span className="num">{money(r.trip_amount)}</span></p>
              </div>
            )} />
        </Panel>

        <Panel title="Pending Receivables" action={() => nav("/finance?tab=receivables")}>
          <DataTable testid="dash-receivables"
            columns={[
              { key: "party", label: "Party", strong: true },
              { key: "mobile", label: "Mobile" },
              { key: "outstanding", label: "Outstanding", type: "money", right: true },
              { key: "status", label: "Status", type: "badge" },
            ]}
            rows={d.lists.pending_receivables} onRowClick={(r) => nav(`/parties/${r.party_id}`)}
            empty={<EmptyState title="Nothing pending" text="All party payments are settled." />}
            mobile={(r) => (
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-semibold">{r.party}</p><p className="text-[12.5px] text-muted">{r.mobile || "—"}</p></div>
                <div className="text-right"><p className="num font-semibold">{money(r.outstanding)}</p><Badge>{r.status}</Badge></div>
              </div>
            )} />
        </Panel>

        <Panel title="Recent Collections" action={() => nav("/finance?tab=collections")}>
          <DataTable testid="dash-collections"
            columns={[
              { key: "date", label: "Date", type: "date" },
              { key: "party_name", label: "Party", strong: true },
              { key: "mode", label: "Mode" },
              { key: "amount", label: "Amount", type: "money", right: true },
            ]}
            rows={d.lists.recent_collections}
            empty={<EmptyState title="No collections yet" text="Record a collection from Quick Actions." />} />
        </Panel>

        <Panel title="Recent Expenses & Payments" action={() => nav("/finance?tab=expenses")}>
          <DataTable testid="dash-expenses"
            columns={[
              { key: "date", label: "Date", type: "date" },
              { key: "label", label: "Detail", strong: true, render: (r) => r.category || `Paid to ${r.entity_name || "-"}` },
              { key: "mode", label: "Mode" },
              { key: "amount", label: "Amount", type: "money", right: true },
            ]}
            rows={[...d.lists.recent_expenses, ...d.lists.recent_payments].slice(0, 8)}
            empty={<EmptyState title="No expenses yet" text="Record an expense from Quick Actions." />} />
        </Panel>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div className="mb-6">
    <p className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-muted">{title}</p>
    {children}
  </div>
);

const Panel = ({ title, action, children }) => (
  <Card className="overflow-hidden">
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h3 className="font-head text-[15.5px] font-bold text-ink">{title}</h3>
      {action && <button onClick={action} className="text-[13px] font-semibold text-brand-600 hover:underline">View all</button>}
    </div>
    {children}
  </Card>
);
