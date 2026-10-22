import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";

export default function OrganizationDeletion({ organization, refreshContext }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  if (organization?.role !== "owner") return null;
  async function removeOrganization(event) {
    event.preventDefault();
    if (busy || !acknowledged || confirmation !== organization.name) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${organization.id || organization._id}`, {
        method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Organization deletion could not be requested. Please try again.");
      try { await refreshContext?.(); } catch { /* The next page reloads workspace access. */ }
      navigate("/dashboard?organizationDeleted=1");
    } catch (failure) { setError(failure.message || "Organization deletion could not be requested. Please try again."); setBusy(false); }
  }
  return <section aria-label="Delete organization" className="rounded-xl border border-severity-critical/20 bg-bg-secondary p-5 space-y-3">
    <div><h2 className="font-semibold text-text-primary">Delete this organization</h2><p className="mt-1 text-sm leading-6 text-text-muted">Everyone loses access immediately. Scans are cancelled and automation is disabled. Stored scans, findings, reviews, memberships, and activity are queued for erasure after a 24-hour settling period, when the worker next runs. Larger deletions take multiple passes.</p></div>

    {!expanded ? <button type="button" onClick={() => setExpanded(true)} className="text-sm font-medium text-severity-critical underline underline-offset-4">Delete organization</button> : <form onSubmit={removeOrganization} className="space-y-4 border-t border-text-primary/10 pt-4">
<p className="text-xs leading-5 text-text-muted">Export the data you need first. This cannot be undone. GitHub repositories, existing pull requests, GitHub App installations, provider records, exports, and backups are unaffected. Existing external requests may finish. Your personal account and other organizations remain available.</p>
      <label className="block text-sm text-text-primary">Type {organization.name} to confirm<input aria-label="Confirm organization name to delete" autoComplete="off" required value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} className="mt-2 block w-full max-w-md rounded-md border border-text-primary/15 bg-bg-primary px-3 py-2 text-sm" /></label>
      <label className="flex items-start gap-2 text-sm text-text-secondary"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} className="mt-1" /><span>I understand that all members lose access and organization data cannot be restored.</span></label>
      {error && <p role="alert" className="text-sm text-severity-critical">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy || !acknowledged || confirmation !== organization.name} className="rounded-md border border-severity-critical/30 px-3 py-2 text-sm font-semibold text-severity-critical disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Requesting deletion…" : "Permanently delete organization"}</button><button type="button" disabled={busy} onClick={() => { setExpanded(false); setConfirmation(""); setAcknowledged(false); setError(""); }} className="rounded-md border border-text-primary/15 px-3 py-2 text-sm text-text-secondary">Cancel organization deletion</button></div>
    </form>}
  </section>;
}
