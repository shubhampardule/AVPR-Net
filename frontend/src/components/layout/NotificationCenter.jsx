import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, LoaderCircle, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "../../config/api";

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function NotificationCenter({ organizationId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scanResults, setScanResults] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [error, setError] = useState("");
  const root = useRef(null);
  const preferenceBusyRef = useRef(false);

  const load = useCallback(async (signal) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/notifications?limit=10`, { credentials: "include", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Notifications could not be loaded.");
      setItems(Array.isArray(body.data?.notifications) ? body.data.notifications : []);
      setUnreadCount(Number.isSafeInteger(body.data?.unreadCount) ? body.data.unreadCount : 0);
      if (!preferenceBusyRef.current) setScanResults(body.data?.preferences?.scanResults !== false);
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Notifications could not be loaded.");
    } finally {
      if (signal?.aborted !== true) setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    setOpen(false); setItems([]); setUnreadCount(0); setError("");
    if (!organizationId) return undefined;
    const controller = new AbortController();
    load(controller.signal);
    const refresh = () => load(controller.signal);
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [organizationId, load]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => { if (root.current && !root.current.contains(event.target)) setOpen(false); };
    const closeOnEscape = event => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  async function markRead(notificationId) {
    if (!organizationId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/notifications/${notificationId}/read`,
        { method: "PATCH", credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "This notification could not be marked read.");
      const readAt = body.data?.notification?.readAt || new Date().toISOString();
      setItems(current => current.map(item => String(item._id) === String(notificationId) ? { ...item, readAt } : item));
      setUnreadCount(count => Math.max(0, count - 1));
      setError("");
    } catch (requestError) { setError(requestError.message); }
  }

  async function markAllRead() {
    if (!organizationId || busy || unreadCount === 0) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/notifications/read-all`,
        { method: "PATCH", credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Notifications could not be marked read.");
      const readAt = new Date().toISOString();
      setItems(current => current.map(item => item.readAt ? item : { ...item, readAt }));
      setUnreadCount(0); setError("");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function changePreference(enabled) {
    if (!organizationId || preferenceBusy) return;
    const previous = scanResults;
    preferenceBusyRef.current = true;
    setScanResults(enabled);
    setPreferenceBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${organizationId}/notification-preferences`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanResults: enabled }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Your scan notification preference could not be saved.");
      setScanResults(body.data?.preferences?.scanResults === true); setError("");
    } catch (requestError) { setScanResults(previous); setError(requestError.message); }
    finally { preferenceBusyRef.current = false; setPreferenceBusy(false); }
  }

  return <div ref={root} className="fixed right-[6.5rem] top-3 z-[60] lg:right-[5.5rem]">
    <button type="button" disabled={!organizationId} onClick={() => { setOpen(value => !value); if (!open) load(); }}
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open}
      className="relative flex h-10 w-10 items-center justify-center rounded-md border border-text-primary/10 bg-bg-elevated text-text-primary transition-colors hover:bg-text-primary/[0.08] disabled:cursor-not-allowed disabled:opacity-50">
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-severity-medium px-1 text-center text-[11px] font-bold leading-4 text-on-accent">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section role="dialog" aria-label="Notifications" className="absolute right-[-5.75rem] top-11 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-text-primary/10 bg-bg-secondary text-text-primary shadow-2xl sm:right-0">
      <header className="flex items-center justify-between border-b border-text-primary/10 px-4 py-3">
        <div><h2 className="text-sm font-semibold">Notifications</h2><p className="mt-0.5 text-[11px] text-text-muted">For this workspace · in-app only</p></div>
        <button type="button" disabled={busy || unreadCount === 0} onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-text-primary underline underline-offset-2 disabled:opacity-40"><CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />Mark all read</button>
      </header>
      <div className="max-h-[min(60vh,28rem)] overflow-y-auto">
        {loading && items.length === 0 && <p role="status" className="flex items-center gap-2 px-4 py-5 text-xs text-text-muted"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading notifications…</p>}
        {error && <div role="alert" className="m-3 rounded-md border border-severity-medium/20 bg-severity-medium/[0.05] p-3 text-xs text-severity-medium"><p>{error}</p><button type="button" onClick={() => load()} className="mt-2 inline-flex items-center gap-1 underline"><RefreshCw className="h-3 w-3" aria-hidden="true" />Retry</button></div>}
        {!loading && !error && items.length === 0 && <p className="px-4 py-6 text-center text-xs leading-5 text-text-muted">No scan notifications yet. New scan results will appear here.</p>}
        {items.map(item => <Link key={item._id} to={item.href} onClick={() => { if (!item.readAt) markRead(item._id); setOpen(false); }}
          className={`block border-b border-text-primary/[0.07] px-4 py-3 transition-colors hover:bg-text-primary/[0.04] ${item.readAt ? "" : "bg-bg-elevated/[0.035]"}`}>
          <div className="flex items-start gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-severity-medium"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-text-secondary">{item.body}</p>
              <p className="mt-1.5 truncate text-[11px] text-text-muted">{item.repository} · {formatTime(item.createdAt)}</p></div></div>
        </Link>)}
      </div>
      <footer className="border-t border-text-primary/10 px-4 py-3">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-text-secondary"><span>Notify me about scan results</span>
          <input type="checkbox" aria-label="Notify me about scan results" className="accent-accent-security" checked={scanResults} disabled={preferenceBusy} onChange={event => changePreference(event.target.checked)} />
        </label>
        <p className="mt-2 text-[11px] text-text-muted">Stored for 90 days. Email alerts are not configured.</p>
      </footer>
    </section>}
  </div>;
}
