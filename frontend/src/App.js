import React, { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import { ToastHost, Loader, toast } from "./components/ui";
import { startDataSync } from "./lib/realtime";
import Layout from "./components/Layout";

const Login = lazy(() => import("./pages/Login"));
const Trips = lazy(() => import("./pages/Trips"));
const TripForm = lazy(() => import("./pages/TripForm"));
const TripDetail = lazy(() => import("./pages/TripDetail"));
const LRForm = lazy(() => import("./pages/LRForm"));
const LRView = lazy(() => import("./pages/LRView"));
const Vehicles = lazy(() => import("./pages/Vehicles"));
const VehicleDetail = lazy(() => import("./pages/VehicleDetail"));
const Parties = lazy(() => import("./pages/Parties"));
const PartyDetail = lazy(() => import("./pages/PartyDetail"));
const Team = lazy(() => import("./pages/Team"));
const PersonDetail = lazy(() => import("./pages/PersonDetail"));
const Finance = lazy(() => import("./pages/Finance"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Platform = lazy(() => import("./pages/Platform"));
const PlatformSettings = lazy(() => import("./pages/Platform").then((module) => ({
  default: module.PlatformSettings,
})));
const SiteConsole = lazy(() => import("./pages/SiteConsole"));
const SiteTrip = lazy(() => import("./pages/SiteTrip"));
const SiteLRPage = lazy(() => import("./pages/SiteLRPage"));
const BookingFinance = lazy(() => import("./pages/BookingFinance"));
const BookingReports = lazy(() => import("./pages/BookingReports"));

export default function App() {
  const [state, setState] = useState("checking");
  const [user, setUser] = useState(null);

  const applyMe = (r) => {
    setUser({ ...r.data.user, features: r.data.features, tenant: r.data.tenant, branding: r.data.branding });
    setState("in");
  };

  useEffect(() => {
    if (!localStorage.getItem("fms_token")) return setState("out");
    api.get("/me").then(applyMe).catch(() => setState("out"));
    const onBrand = () => api.get("/me").then(applyMe).catch(() => {});
    window.addEventListener("fms:branding", onBrand);
    return () => window.removeEventListener("fms:branding", onBrand);
  }, []);

  const onLogin = () => { api.get("/me").then(applyMe).catch(() => setState("out")); };

  useEffect(() => {
    if (state !== "in" || !user) return undefined;
    return startDataSync(
      user.tenant_id,
      async () => (await api.get("/sync/revision")).data.revision,
      (error) => toast(
        error ? "Live updates are temporarily unavailable; retrying automatically." : "Live updates restored.",
        error ? "err" : "ok",
      ),
    );
  }, [state, user]);

  if (state === "checking") return <div className="grid h-screen place-items-center"><Loader label="Starting…" /></div>;

  return (
    <BrowserRouter>
      <ToastHost />
      {state !== "in" ? (
        <Suspense fallback={<div className="grid h-screen place-items-center"><Loader label="Loading…" /></div>}>
          <Routes>
            <Route path="/login" element={<Login onLogin={onLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      ) : (
        <Layout user={user}>
          <Suspense fallback={<div className="grid min-h-[40vh] place-items-center"><Loader label="Loading…" /></div>}>
            <Routes>
              {user?.role === "superadmin" ? (
                <>
                  <Route path="/platform" element={<Platform />} />
                  <Route path="/settings" element={<PlatformSettings />} />
                  <Route path="*" element={<Navigate to="/platform" replace />} />
                </>
              ) : user?.role === "site_manager" ? (
                <>
                  <Route path="/" element={<Navigate to="/sites" replace />} />
                  <Route path="/sites" element={<SiteConsole user={user} />} />
                  <Route path="/sites/:siteId/trips/:tripId" element={<SiteTrip user={user} />} />
                  <Route path="/sites/:siteId/trips/:tripId/lrs/:lrId" element={<SiteLRPage user={user} />} />
                  <Route path="/booking-setup" element={<Navigate to="/sites" replace />} />
                  <Route path="*" element={<Navigate to="/sites" replace />} />
                </>
              ) : (
                <>
            <Route path="/sites" element={<SiteConsole user={user} />} />
            <Route path="/sites/:siteId/trips/:tripId" element={<SiteTrip user={user} />} />
            <Route path="/sites/:siteId/trips/:tripId/lrs/:lrId" element={<SiteLRPage user={user} />} />
            <Route path="/booking-setup" element={<SiteConsole user={user} adminOnly />} />
            <Route path="/booking-finance" element={user?.role === "owner" ? <BookingFinance /> : <Navigate to="/sites" replace />} />
            <Route path="/booking-reports" element={user?.role === "owner" ? <BookingReports /> : <Navigate to="/sites" replace />} />
            <Route path="/" element={<Navigate to="/sites" replace />} />
            <Route path="/dashboard" element={<Navigate to="/sites" replace />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/trips/new" element={<TripForm />} />
            <Route path="/trips/:id" element={<TripDetail />} />
            <Route path="/lrs/new" element={<LRForm />} />
            <Route path="/lrs/:id" element={<LRView />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/vehicles/:id" element={<VehicleDetail />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/parties/:id" element={<PartyDetail />} />
            <Route path="/team" element={<Team />} />
            <Route path="/drivers/:id" element={<PersonDetail kind="driver" />} />
            <Route path="/team/:id" element={<PersonDetail kind="employee" />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
                </>
              )}
            </Routes>
          </Suspense>
        </Layout>
      )}
    </BrowserRouter>
  );
}
