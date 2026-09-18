import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api } from "./lib/api";
import { ToastHost, Loader } from "./components/ui";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Trips from "./pages/Trips";
import TripForm from "./pages/TripForm";
import TripDetail from "./pages/TripDetail";
import LRForm from "./pages/LRForm";
import LRView from "./pages/LRView";
import Vehicles from "./pages/Vehicles";
import VehicleDetail from "./pages/VehicleDetail";
import Parties from "./pages/Parties";
import PartyDetail from "./pages/PartyDetail";
import Team from "./pages/Team";
import PersonDetail from "./pages/PersonDetail";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Platform from "./pages/Platform";

export default function App() {
  const [state, setState] = useState("checking");
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("fms_token")) return setState("out");
    api.get("/me")
      .then((r) => { setUser({ ...r.data.user, features: r.data.features, tenant: r.data.tenant }); setState("in"); })
      .catch(() => setState("out"));
  }, []);

  const onLogin = () => {
    api.get("/me")
      .then((r) => { setUser({ ...r.data.user, features: r.data.features, tenant: r.data.tenant }); setState("in"); })
      .catch(() => setState("out"));
  };

  if (state === "checking") return <div className="grid h-screen place-items-center"><Loader label="Starting…" /></div>;

  return (
    <BrowserRouter>
      <ToastHost />
      {state !== "in" ? (
        <Routes>
          <Route path="/login" element={<Login onLogin={onLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Layout user={user}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
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
            {user?.role === "superadmin" && <Route path="/platform" element={<Platform />} />}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </BrowserRouter>
  );
}
