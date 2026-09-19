import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "../lib/api";

export default function Login({ onLogin }) {
  const [f, setF] = useState({ username: "", password: "" });
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
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#071018] px-12 py-10 md:flex">
        <div className="absolute -left-20 top-10 h-96 w-96 rounded-full bg-[#1D6FEA]/25 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-[#22C55E]/15 blur-3xl" />
        <div className="relative inline-flex w-fit rounded-3xl bg-white p-5 shadow-xl">
          <img src="/profleet-logo.png" alt="ProFleet" className="h-28 w-auto object-contain" />
        </div>
        <div className="relative max-w-md">
          <h1 className="font-head text-[40px] font-extrabold leading-[1.08] text-white">
            Track. Manage.<br />Move. Grow.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            Office for trips, LR, diesel and collections — built for a transport desk.
          </p>
        </div>
        <p className="relative text-[12.5px] tracking-[0.2em] text-white/35">TRACK · MANAGE · MOVE · GROW</p>
      </div>

      <div className="flex items-center justify-center bg-canvas px-5 py-12">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="mb-8 flex justify-center md:hidden">
            <div className="rounded-3xl bg-white p-4 shadow-card">
              <img src="/profleet-logo.png" alt="ProFleet" className="h-24 w-auto object-contain" />
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <img src="/app-icon.png" alt="" className="h-12 w-12 rounded-2xl object-cover shadow-md" />
            <div>
              <p className="font-head text-[18px] font-bold leading-none">ProFleet</p>
              <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Management</p>
            </div>
          </div>
          <h2 className="mt-8 font-head text-[26px] font-bold text-ink">Welcome back</h2>
          <p className="mt-1 text-[14px] text-muted">Sign in to your office or platform console.</p>
          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="lbl">User name</span>
              <input data-testid="login-username" className="fld rounded-2xl" value={f.username} autoCapitalize="none"
                autoComplete="username" placeholder="Your login"
                onChange={(e) => setF({ ...f, username: e.target.value })} />
            </label>
            <label className="block">
              <span className="lbl">Password</span>
              <input data-testid="login-password" type="password" className="fld rounded-2xl" value={f.password}
                autoComplete="current-password" placeholder="••••••••"
                onChange={(e) => setF({ ...f, password: e.target.value })} />
            </label>
          </div>
          {err && <p data-testid="login-error" className="mt-4 rounded-2xl bg-red-50 px-3 py-2.5 text-[13.5px] font-medium text-red-600">{err}</p>}
          <button data-testid="login-submit" disabled={busy}
            className="btn-p mt-6 w-full rounded-2xl py-3.5 text-[15px] text-white">
            {busy && <Loader2 size={17} className="animate-spin" />} {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
