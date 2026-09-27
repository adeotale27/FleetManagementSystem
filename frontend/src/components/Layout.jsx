import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Banknote, FileText, Fuel, Gauge, LogOut, Menu, Plus, Receipt,
  Search, Settings as Cog, ShieldCheck, Truck, User, Users, UsersRound, Wallet, X, ArrowRight, Building2,
} from "lucide-react";
import { api } from "../lib/api";
import EntryModal from "./QuickForms";
import { Badge } from "./ui";

const NAV = [
  { to: "/trips?tab=trips", label: "Industrial Trips", icon: Truck, key: "trips",
    activeWhen: (location) => location.pathname === "/trips" && new URLSearchParams(location.search).get("tab") !== "lrs" },
  { to: "/trips?tab=lrs", label: "Industrial LRs", icon: FileText, key: "trips",
    activeWhen: (location) => location.pathname === "/trips" && new URLSearchParams(location.search).get("tab") === "lrs" },
  { to: "/vehicles", label: "Vehicles", icon: Gauge, key: "vehicles" },
  { to: "/parties", label: "Parties", icon: Users, key: "parties" },
  { to: "/team", label: "Team", icon: UsersRound, key: "team" },
  { to: "/finance", label: "Industrial Finance", icon: Wallet, key: "finance" },
  { to: "/reports", label: "Industrial Reports", icon: BarChart3, key: "reports" },
  { to: "/settings", label: "Office Settings", icon: Cog, key: "settings" },
];

const PLATFORM_NAV = [
  { to: "/platform", label: "Licences", icon: ShieldCheck },
  { to: "/settings", label: "Console", icon: Cog },
];

const SITE_NAV = { to: "/sites", label: "Booking Dashboard", icon: Building2 };
const SITE_MANAGER_NAV = { ...SITE_NAV, label: "Site Bookings" };
const BOOKING_NAV = [
  { to: "/booking-finance", label: "Booking Finance", icon: Wallet },
  { to: "/booking-reports", label: "Booking Reports", icon: BarChart3 },
  { to: "/booking-setup", label: "Booking Setup & Access", icon: Building2 },
];

const QUICK = [
  { kind: "trip", label: "Create Trip", icon: Truck },
  { kind: "lr", label: "Create LR", icon: FileText },
  { kind: "collection", label: "Collection", icon: Banknote },
  { kind: "payment", label: "Payment", icon: Wallet },
  { kind: "expense", label: "Expense", icon: Receipt },
  { kind: "fuel", label: "Diesel", icon: Fuel },
];

const navIsActive = (item, location) => {
  if (item.activeWhen) return item.activeWhen(location);
  return item.to === "/sites"
    ? location.pathname.startsWith("/sites")
    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
};

export default function Layout({ user, children }) {
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [entry, setEntry] = useState(null);
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => { setMenu(false); setSheet(false); }, [loc.pathname, loc.search]);

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
  const isSiteBookingRoute = loc.pathname === "/sites" || loc.pathname.startsWith("/sites/")
    || loc.pathname === "/booking-finance" || loc.pathname === "/booking-reports"
    || loc.pathname === "/booking-setup";
  const showIndustrialTools = user?.role === "owner" && !isSiteBookingRoute;
  const navItems = user?.role === "superadmin" ? PLATFORM_NAV
    : user?.role === "site_manager" ? [SITE_MANAGER_NAV]
      : [SITE_NAV, ...BOOKING_NAV, ...NAV.filter((n) => !n.key || user?.features?.[n.key] !== false)];
  const mobileNav = user?.role === "superadmin" ? PLATFORM_NAV
    : user?.role === "site_manager" ? [SITE_MANAGER_NAV]
      : [SITE_NAV, BOOKING_NAV[0], ...NAV.filter((n) => n.key === "trips" || n.key === "finance")];

  const Side = (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <img src={bizLogo} alt="" className="app-brand-mark h-10 w-10 shrink-0 rounded-xl bg-white object-contain ring-1 ring-white/10" />
        <div className="min-w-0">
          <p className="truncate font-head text-[15.5px] font-bold leading-none text-white">{bizName}</p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-white/45">
            {user?.role === "superadmin" ? "Platform control" : user?.role === "site_manager" ? "Site operations" : "Fleet operations"}
          </p>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">
          {user?.role === "superadmin" ? "Administration" : "Workspace"}
        </p>
        {navItems.map((n) => (
          <Link key={n.to} to={n.to} aria-current={navIsActive(n, loc) ? "page" : undefined}
            data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
            className={`app-nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors ${
              navIsActive(n, loc) ? "is-active text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
            <n.icon size={18} strokeWidth={1.8} /> {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white/[.045] px-2 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {photo
              ? <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/20" />
              : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white">
                  <User size={16} />
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
      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-60 flex-col md:flex">{Side}</aside>

      {menu && (
        <div className="fixed inset-0 z-50 md:hidden" data-testid="mobile-navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
            onClick={() => setMenu(false)} />
          <aside className="app-sidebar absolute inset-y-0 left-0 flex w-[min(84vw,300px)] flex-col row-anim">{Side}</aside>
        </div>
      )}

      <div className="md:pl-60 print:!pl-0">
        <header className="app-header sticky top-0 z-30 border-b border-line">
          <div className="flex items-center gap-2 px-4 py-3 md:px-7">
            <button onClick={() => setMenu(true)} data-testid="menu-btn" aria-label="Open navigation"
              aria-expanded={menu} className="rounded-lg p-2 text-ink hover:bg-brand-50 md:hidden">
              <Menu size={21} />
            </button>
            <img src={bizLogo} alt="" className="h-8 w-8 rounded-lg object-contain md:hidden" />
            {showIndustrialTools && (
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
            {showIndustrialTools && (
              <button onClick={() => setSheet(true)} data-testid="quick-action-btn"
                className="btn-p hidden py-2 md:inline-flex"><Plus size={17} /> New Entry</button>
            )}
          </div>
        </header>

        <main className="app-main page-enter px-4 pb-28 pt-6 md:px-7 md:pb-10">{children}</main>
      </div>

      {/* mobile bottom bar */}
      <div className="app-header fixed bottom-0 left-0 right-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className={`grid ${user?.role === "superadmin" ? "grid-cols-2"
          : user?.role === "site_manager" ? "grid-cols-1"
            : showIndustrialTools ? "grid-cols-5" : "grid-cols-4"}`}>
          {user?.role === "superadmin" || user?.role === "site_manager" ? mobileNav.map((n) => <BottomLink key={n.to} n={n} />) : (
            showIndustrialTools ? <>
              {mobileNav.slice(0, 2).map((n) => <BottomLink key={n.to} n={n} />)}
              <button onClick={() => setSheet(true)} data-testid="mobile-quick-btn" className="flex flex-col items-center py-2">
                <span className="grid h-11 w-11 -mt-4 place-items-center rounded-full bg-brand-500 text-white shadow-lg"><Plus size={22} /></span>
                <span className="mt-0.5 text-[10.5px] font-semibold text-brand-600">New</span>
              </button>
              {mobileNav.slice(2).map((n) => <BottomLink key={n.to} n={n} />)}
            </> : mobileNav.map((n) => <BottomLink key={n.to} n={n} />)
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
              Open Industrial Finance <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      )}

      <EntryModal kind={entry || "collection"} open={!!entry} onClose={() => setEntry(null)}
        onDone={() => window.dispatchEvent(new Event("fms:refresh"))} />
    </div>
  );
}

const BottomLink = ({ n }) => {
  const location = useLocation();
  return (
    <Link to={n.to} aria-current={navIsActive(n, location) ? "page" : undefined}
      data-testid={`mnav-${n.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
      className={`flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-semibold ${
        navIsActive(n, location) ? "text-brand-600" : "text-muted"}`}>
      <n.icon size={19} strokeWidth={1.9} /> {n.label}
    </Link>
  );
};
