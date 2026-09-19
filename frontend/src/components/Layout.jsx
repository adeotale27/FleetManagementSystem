import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Banknote, Fuel, Gauge, LayoutDashboard, LogOut, Menu, Plus, Receipt,
  Search, Settings as Cog, ShieldCheck, Truck, Users, UsersRound, Wallet, X, FileText, ArrowRight,
} from "lucide-react";
import { api } from "../lib/api";
import EntryModal from "./QuickForms";
import { Badge } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/trips", label: "Trips & LR", icon: Truck, key: "trips" },
  { to: "/vehicles", label: "Vehicles", icon: Gauge, key: "vehicles" },
  { to: "/parties", label: "Parties", icon: Users, key: "parties" },
  { to: "/team", label: "Team", icon: UsersRound, key: "team" },
  { to: "/finance", label: "Finance", icon: Wallet, key: "finance" },
  { to: "/reports", label: "Reports", icon: BarChart3, key: "reports" },
  { to: "/settings", label: "Office Settings", icon: Cog, key: "settings" },
];

const PLATFORM_NAV = [
  { to: "/platform", label: "Licences", icon: ShieldCheck },
  { to: "/settings", label: "Console", icon: Cog },
];

const MOBILE_NAV = [NAV[0], NAV[1], NAV[5], NAV[6]];

const QUICK = [
  { kind: "trip", label: "Create Trip", icon: Truck },
  { kind: "lr", label: "Create LR", icon: FileText },
  { kind: "collection", label: "Collection", icon: Banknote },
  { kind: "payment", label: "Payment", icon: Wallet },
  { kind: "expense", label: "Expense", icon: Receipt },
  { kind: "fuel", label: "Diesel", icon: Fuel },
];

export default function Layout({ user, children }) {
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [entry, setEntry] = useState(null);
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => { setMenu(false); setSheet(false); }, [loc.pathname]);

  useEffect(() => {
    if (q.length < 2) return setRes([]);
    const t = setTimeout(async () => {
      try { setRes((await api.get("/search", { params: { q } })).data); } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const logout = () => { localStorage.removeItem("fms_token"); window.location.href = "/login"; };

  const quick = (kind) => {
    setSheet(false);
    if (kind === "trip") return nav("/trips/new");
    if (kind === "lr") return nav("/lrs/new");
    setEntry(kind);
  };

  const bizLogo = user?.role === "superadmin" ? "/app-icon.png" : (user?.branding?.logo || "/app-icon.png");
  const bizName = user?.role === "superadmin" ? "ProFleet" : (user?.tenant_name || user?.branding?.name || "ProFleet");
  const photo = user?.photo;
  const navItems = user?.role === "superadmin" ? PLATFORM_NAV : NAV.filter((n) => !n.key || user?.features?.[n.key] !== false);
  const mobileNav = user?.role === "superadmin" ? PLATFORM_NAV : MOBILE_NAV;

  const Side = (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src={bizLogo} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain ring-1 ring-white/10" />
        <div className="min-w-0">
          <p className="truncate font-head text-[15.5px] font-bold leading-none text-white">{bizName}</p>
          <p className="mt-1 text-[11.5px] text-white/40">
            {user?.role === "superadmin" ? "Licence control" : "Transport Office"}
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {navItems.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] font-medium transition-colors ${
                isActive ? "bg-brand-500 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
            <n.icon size={18} /> {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {photo
              ? <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/20" />
              : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-bold text-white">
                  {(user?.name || "U").slice(0, 1).toUpperCase()}
                </div>}
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-white">{user?.name || "Owner"}</p>
              <p className="text-[11.5px] text-white/40">Signed in</p>
            </div>
          </div>
          <button onClick={logout} data-testid="logout-btn" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-ink md:flex">{Side}</aside>

      {menu && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMenu(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-ink row-anim">{Side}</aside>
        </div>
      )}

      <div className="md:pl-60 print:!pl-0">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3 md:px-7">
            <button onClick={() => setMenu(true)} data-testid="menu-btn" className="rounded-lg p-2 text-ink md:hidden">
              <Menu size={21} />
            </button>
            <img src={bizLogo} alt="" className="h-8 w-8 rounded-lg object-contain md:hidden" />
            {user?.role !== "superadmin" && (
            <div className="relative flex-1 md:max-w-md">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input data-testid="global-search" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search vehicle, driver, party, trip, LR…"
                className="fld py-2 pl-9 text-[14px]" />
              {q.length > 1 && (
                <div className="absolute z-40 mt-1.5 max-h-[60vh] w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-xl">
                  {res.length === 0 && <p className="px-3 py-3 text-[13px] text-muted">No match found</p>}
                  {res.map((r, i) => (
                    <button key={i} data-testid={`search-result-${i}`}
                      onClick={() => { nav(r.link); setQ(""); }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-brand-50">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">{r.title}</p>
                        <p className="truncate text-[12.5px] text-muted">{r.subtitle}</p>
                      </div>
                      <Badge>{r.type}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}
            {user?.role === "superadmin" && <div className="flex-1" />}
            {user?.role !== "superadmin" && (
              <button onClick={() => setSheet(true)} data-testid="quick-action-btn"
                className="btn-p hidden py-2 md:inline-flex"><Plus size={17} /> New Entry</button>
            )}
          </div>
        </header>

        <main className="px-4 pb-28 pt-5 md:px-7 md:pb-10">{children}</main>
      </div>

      {/* mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white/97 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className={`grid ${user?.role === "superadmin" ? "grid-cols-2" : "grid-cols-5"}`}>
          {user?.role === "superadmin" ? mobileNav.map((n) => <BottomLink key={n.to} n={n} />) : (
            <>
              {mobileNav.slice(0, 2).map((n) => <BottomLink key={n.to} n={n} />)}
              <button onClick={() => setSheet(true)} data-testid="mobile-quick-btn" className="flex flex-col items-center py-2">
                <span className="grid h-11 w-11 -mt-4 place-items-center rounded-full bg-[#0B5C4E] text-white shadow-lg"><Plus size={22} /></span>
                <span className="mt-0.5 text-[10.5px] font-semibold text-brand-600">New</span>
              </button>
              {mobileNav.slice(2).map((n) => <BottomLink key={n.to} n={n} />)}
            </>
          )}
        </div>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/50 backdrop-blur-sm md:items-center md:justify-center"
          onMouseDown={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="row-anim w-full rounded-t-2xl bg-white p-5 md:max-w-md md:rounded-2xl" data-testid="quick-sheet">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-head text-[18px] font-bold">Quick Actions</h3>
              <button onClick={() => setSheet(false)} className="rounded-lg p-1.5 text-muted hover:bg-canvas"><X size={19} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {QUICK.map((a) => (
                <button key={a.kind} onClick={() => quick(a.kind)} data-testid={`quick-${a.kind}`}
                  className="flex flex-col items-center gap-2 rounded-xl border border-line p-3.5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50">
                  <a.icon size={20} className="text-brand-500" />
                  <span className="text-[12.5px] font-semibold leading-tight text-ink">{a.label}</span>
                </button>
              ))}
            </div>
            <Link to="/finance" onClick={() => setSheet(false)}
              className="mt-4 flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-[14px] font-semibold text-ink">
              Open Finance <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      )}

      <EntryModal kind={entry || "collection"} open={!!entry} onClose={() => setEntry(null)}
        onDone={() => window.dispatchEvent(new Event("fms:refresh"))} />
    </div>
  );
}

const BottomLink = ({ n }) => (
  <NavLink to={n.to} end={n.to === "/"} data-testid={`mnav-${n.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
    className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold ${
      isActive ? "text-brand-600" : "text-muted"}`}>
    <n.icon size={20} /> {n.label}
  </NavLink>
);
