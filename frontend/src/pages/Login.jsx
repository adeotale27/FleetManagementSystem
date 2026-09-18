import React, { useState } from "react";
import { Truck, Loader2 } from "lucide-react";
import { api, errMsg } from "../lib/api";

export default function Login({ onLogin }) {
  const [f, setF] = useState({ username: "owner", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api.post("/auth/login", f);
      localStorage.setItem("fms_token", r.data.token);
      onLogin(r.data.user);
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen bg-ink md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 md:flex">
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3 text-white">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500"><Truck size={22} /></div>
          <span className="font-head text-[19px] font-bold tracking-tight">Fleet Manager</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-head text-[40px] font-extrabold leading-[1.08] text-white">
            Your whole transport business, on one screen.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            Trips, LR, parties, diesel, collections and every rupee — tracked automatically.
            Built for the daily work of a transport office.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {["Trips & LR", "Party Ledger", "Deewanji Collection", "Diesel & Expenses", "Reports"].map((t) => (
              <span key={t} className="rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] font-medium text-white/70">{t}</span>
            ))}
          </div>
        </div>
        <p className="relative text-[12.5px] text-white/35">Records stay safe — cancellations are reversed, never deleted.</p>
      </div>

      <div className="flex items-center justify-center bg-canvas px-5 py-14">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500 text-white"><Truck size={22} /></div>
            <span className="font-head text-[19px] font-bold">Fleet Manager</span>
          </div>
          <h2 className="font-head text-[26px] font-bold text-ink">Sign in</h2>
          <p className="mt-1 text-[14px] text-muted">Enter your details to open the office dashboard.</p>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="lbl">User name</span>
              <input data-testid="login-username" className="fld" value={f.username} autoCapitalize="none"
                onChange={(e) => setF({ ...f, username: e.target.value })} />
            </label>
            <label className="block">
              <span className="lbl">Password</span>
              <input data-testid="login-password" type="password" className="fld" value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••••" />
            </label>
          </div>

          {err && <p data-testid="login-error" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13.5px] font-medium text-red-600">{err}</p>}

          <button data-testid="login-submit" disabled={busy} className="btn-p mt-6 w-full py-3">
            {busy && <Loader2 size={17} className="animate-spin" />} {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-6 text-center text-[12.5px] text-muted">
            Business owner — <span className="font-semibold text-ink">owner / owner123</span>
            <br />
            Platform owner — <span className="font-semibold text-ink">superadmin / super123</span>
          </p>
        </form>
      </div>
    </div>
  );
}
