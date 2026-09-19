import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api, errMsg } from "../lib/api";

export default function Login({ onLogin }) {
  const [f, setF] = useState({ username: "", password: "" });
  const [show, setShow] = useState(false);
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
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-[#071018] px-16 py-12 md:flex">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 20%, rgba(29,111,234,.18), transparent 42%), radial-gradient(ellipse at 70% 90%, rgba(11,92,78,.22), transparent 40%)" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-20"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,.08) 40px, rgba(255,255,255,.08) 44px, transparent 44px, transparent 80px)" }} />
        <div className="relative flex w-full max-w-xl flex-col items-center text-center">
          <div className="rounded-[28px] bg-white p-6 shadow-[0_0_60px_rgba(29,111,234,.35)]">
            <img src="/app-icon.png" alt="ProFleet" className="h-28 w-28 object-contain" />
          </div>
          <img src="/profleet-logo.png" alt="" className="mt-6 h-16 w-auto max-w-[280px] object-contain drop-shadow-lg" />
          <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.22em] text-white/50">ProFleet Management</p>
          <h1 className="mt-4 font-head text-[44px] font-extrabold leading-[1.08] text-white">
            Track. Manage.<br />Move. Grow.
          </h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/55">
            Your complete transport operations workspace for trips, LR, vehicles, drivers and collections.
          </p>
          <p className="mt-10 text-[11px] font-semibold tracking-[0.18em] text-white/35">
            LIVE FLEET · TRIPS &amp; LR · FINANCE · COLLECTIONS
          </p>
        </div>
        <p className="absolute bottom-8 left-0 right-0 text-center text-[12px] text-white/25">ProFleet Management</p>
      </div>

      <div className="flex items-center justify-center bg-[#F4F6F8] px-5 py-10 md:px-10">
        <form onSubmit={submit} className="w-full max-w-[440px]" data-testid="login-form">
          <div className="mb-8 flex flex-col items-center md:hidden">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-card">
              <img src="/profleet-logo.png" alt="ProFleet" className="h-16 w-auto object-contain" />
            </div>
            <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">ProFleet Management</p>
          </div>
          <div className="mb-8 hidden items-center gap-3.5 md:flex">
            <img src="/app-icon.png" alt="" className="h-14 w-14 rounded-2xl object-cover shadow-md" />
            <div>
              <p className="font-head text-[20px] font-bold leading-none">ProFleet</p>
              <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">Management</p>
            </div>
          </div>
          <h2 className="font-head text-[32px] font-bold leading-tight text-ink">Welcome back</h2>
          <p className="mt-2 text-[15px] text-muted">Sign in to your ProFleet Management workspace.</p>
          <label className="mt-8 block">
            <span className="lbl">Username</span>
            <input data-testid="login-username" className="fld rounded-2xl py-[15px] text-[16px]" value={f.username}
              autoCapitalize="none" autoComplete="username" placeholder="Enter your username"
              onChange={(e) => setF({ ...f, username: e.target.value })} />
          </label>
          <label className="mt-5 block">
            <span className="lbl">Password</span>
            <div className="relative">
              <input data-testid="login-password" type={show ? "text" : "password"}
                className="fld rounded-2xl py-[15px] pr-12 text-[16px]" value={f.password}
                autoComplete="current-password" placeholder="••••••••"
                onChange={(e) => setF({ ...f, password: e.target.value })} />
              <button type="button" onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-ink" aria-label="Show password">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {err && <p data-testid="login-error" className="mt-4 rounded-2xl bg-red-50 px-3 py-2.5 text-[14px] font-medium text-red-600">{err}</p>}
          <button data-testid="login-submit" disabled={busy}
            className="btn-p mt-8 w-full rounded-2xl py-[15px] text-[16px] font-semibold text-white">
            {busy && <Loader2 size={18} className="animate-spin" />} {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-10 text-center text-[12.5px] text-muted">ProFleet Management · Secure business workspace</p>
        </form>
      </div>
    </div>
  );
}
