import React, { useState } from "react";
import { API_BASE_URL } from "../../config/api";

export default function AccountDeletion({ user }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function removeAccount(event) {
    event.preventDefault();
    if (busy || !acknowledged || !user?.email || confirmation !== user.email) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, { method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Your account could not be deleted. Please try again.");
      // Remove only this application's stored workspace selections.
      for (const key of Object.keys(sessionStorage)) if (key.startsWith("securepatch-org:")) sessionStorage.removeItem(key);
      window.location.assign("/login?account=deleted");
    } catch (failure) { setError(failure.message || "Your account could not be deleted. Please try again."); setBusy(false); }
  }
  return <section aria-label="Delete personal account" className="rounded-xl border border-severity-critical/20 bg-bg-secondary p-5 space-y-3">
    <div><h2 className="font-semibold text-text-primary">Your personal account</h2><p className="mt-1 text-sm text-text-muted">Deleting your account removes your profile and sign-in provider links, ends your memberships, and invalidates access from existing sessions. Transfer every organization you own first.</p></div>

    {!expanded ? <button type="button" disabled={!user?.email} onClick={() => setExpanded(true)} className="text-sm font-medium text-severity-critical underline underline-offset-4 disabled:opacity-50">Delete my account</button> : <form onSubmit={removeAccount} className="space-y-4 border-t border-text-primary/10 pt-4">
<p className="text-xs leading-5 text-text-muted">Organization scans, findings, review history, and activity records remain with pseudonymous attribution. This does not delete GitHub repositories, uninstall the GitHub App, or recall data already sent to providers. Organization deletion is a separate owner action. Backup erasure is not provided by this form.</p>
      <label className="block text-sm text-text-primary">Type your account email to confirm<input aria-label="Confirm account email to delete" type="email" autoComplete="off" required value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} className="mt-2 block w-full max-w-md rounded-md border border-text-primary/15 bg-bg-primary px-3 py-2 text-sm" /></label>
      <label className="flex items-start gap-2 text-sm text-text-secondary"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} className="mt-1" /><span>I understand that my profile and memberships cannot be restored.</span></label>
      {error && <p role="alert" className="text-sm text-severity-critical">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy || !acknowledged || confirmation !== user?.email || !user?.email} className="rounded-md border border-severity-critical/30 px-3 py-2 text-sm font-semibold text-severity-critical disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Deleting account…" : "Permanently delete my account"}</button><button type="button" disabled={busy} onClick={() => { setExpanded(false); setConfirmation(""); setAcknowledged(false); setError(""); }} className="rounded-md border border-text-primary/15 px-3 py-2 text-sm text-text-secondary">Cancel account deletion</button></div>
    </form>}
  </section>;
}
