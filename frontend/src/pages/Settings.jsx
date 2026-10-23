import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import OrganizationDeletion from "../components/ui/OrganizationDeletion";
import AccountDeletion from "../components/ui/AccountDeletion";
const emailStatusLabel = { accepted: "accepted by provider", unknown: "status unconfirmed", failed: "failed — share the link securely",
  delayed: "delivery delayed", delivered: "accepted by recipient server", bounced: "bounced — check the address", complained: "reported as spam — do not resend" };
export default function Settings() {
  const { user, selectedOrg, refreshContext } = useOutletContext();
  const navigate = useNavigate();
  const org = selectedOrg?.id || selectedOrg?._id;
  const [members, setMembers] = useState([]), [invitations, setInvitations] = useState([]), [email, setEmail] = useState("");
  const [role, setRole] = useState("developer"), [error, setError] = useState(""), [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [hostedAiEnabled, setHostedAiEnabled] = useState(false);
  const [auditEvents, setAuditEvents] = useState([]), [auditError, setAuditError] = useState("");
  const [auditWarning, setAuditWarning] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [transferConfirmation, setTransferConfirmation] = useState("");
  const [leaveConfirmation, setLeaveConfirmation] = useState("");
  const [success, setSuccess] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [emailDeliveryAvailable, setEmailDeliveryAvailable] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [inviteDelivery, setInviteDelivery] = useState("manual");
  const canManage = ["owner", "admin"].includes(selectedOrg?.role);
  function observeAuditStatus(response) {
    if (response.headers.get("X-SecurePatch-Audit-Recorded") === "false") {
      setAuditWarning("Your change was saved, but its activity record could not be written. Refresh this page before retrying the action.");
    }
  }
  async function request(suffix = "", options = {}) {
    const response = await fetch(`${API_BASE_URL}/organizations/${org}/members${suffix}`, {
      credentials: "include", headers: { "Content-Type": "application/json" }, ...options,
    });
    observeAuditStatus(response);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Member request failed");
    return data.data;
  }
  async function invitationRequest(suffix = "", options = {}) {
    const response = await fetch(`${API_BASE_URL}/organizations/${org}/invitations${suffix}`, {
      credentials: "include", headers: { "Content-Type": "application/json" }, ...options,
    });
    observeAuditStatus(response);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Invitation request failed");
    return data.data;
  }
  async function aiSettingsRequest(options = {}) {
    const response = await fetch(`${API_BASE_URL}/organizations/${org}/ai-settings`, {
      credentials: "include", headers: { "Content-Type": "application/json" }, ...options,
    });
    observeAuditStatus(response);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "AI settings request failed");
    return data.data;
  }
  async function auditRequest() {
    const response = await fetch(`${API_BASE_URL}/organizations/${org}/audit-events?page=1&limit=20`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Recent security activity could not be loaded");
    return data.data;
  }
  async function load() {
    try {
      const [memberResult, invitationResult, aiSettingsResult, auditResult] = await Promise.allSettled([
        request(), canManage ? invitationRequest() : Promise.resolve({ invitations: [] }),
        aiSettingsRequest(), canManage ? auditRequest() : Promise.resolve({ events: [] }),
      ]);
      if (memberResult.status === "rejected") throw memberResult.reason;
      setMembers(memberResult.value.members || []);
      if (invitationResult.status === "fulfilled") {
        setInvitations(invitationResult.value.invitations || []);
        setEmailDeliveryAvailable(invitationResult.value.emailDeliveryAvailable === true);
      } else {
        setError(invitationResult.reason.message || "Invitations could not be loaded");
      }
      if (aiSettingsResult.status === "fulfilled") {
        setHostedAiEnabled(aiSettingsResult.value.hostedAiEnabled === true);
      } else {
        setError(aiSettingsResult.reason.message || "AI settings could not be loaded");
      }
      if (auditResult.status === "fulfilled") {
        setAuditEvents(auditResult.value.events || []);
        setAuditError("");
      } else {
        setAuditError(auditResult.reason.message || "Recent security activity could not be loaded");
      }
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (org) load(); }, [org]);
  async function mutate(action) {
    setBusy(true); setError(""); setSuccess("");
    try { await action(); await load(); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function transferOwnership(event) {
    event.preventDefault();
    if (!org || busy || !transferTarget || transferConfirmation !== selectedOrg.name) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${org}/ownership-transfer`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: transferTarget, confirmation: transferConfirmation }),
      });
      observeAuditStatus(response);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Ownership could not be transferred.");
      const newOwner = members.find(member => member.user.id === transferTarget);
      setSuccess(`Ownership transferred to ${newOwner?.user.name || "the selected member"}. Your role is now admin.`);
      setTransferTarget(""); setTransferConfirmation("");
      await refreshContext?.();
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function downloadOrganizationExport() {
    if (!org || exportBusy) return;
    setExportBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/${org}/export`, { credentials: "include" });
      observeAuditStatus(response);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || "Organization data could not be exported.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      const safeSlug = String(selectedOrg.slug || "organization").replace(/[^a-z0-9-]/gi, "-").slice(0, 100);
      link.download = `securepatch-${safeSlug}-export.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setSuccess("Organization export downloaded. It includes scan and review records, and excludes source snippets and credentials.");
    } catch (e) { setError(e.message || "Organization data could not be exported."); }
    finally { setExportBusy(false); }
  }
  async function leaveOrganization(event) {
    event.preventDefault();
    if (!org || busy || selectedOrg?.role === "owner" || leaveConfirmation !== selectedOrg.name) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await request("/me", { method: "DELETE" });
      try { await refreshContext?.(); } catch { /* The session can recover on the destination page. */ }
      navigate("/");
    } catch (e) { setError(e.message || "You could not leave this organization."); }
    finally { setBusy(false); }
  }
  return <main className="app-page space-y-6">
    <h1 className="text-2xl font-semibold">Workspace settings</h1>
    <nav aria-label="Settings sections" className="settings-sections">
      {org && <><a href="#team">Team</a>{canManage && <a href="#activity">Activity</a>}<a href="#privacy">AI privacy</a><a href="#data">Data</a></>}
      <a href="#account">Account controls</a>
    </nav>
    {!org ? <p>Select an organization.</p> : <>
      <p className="text-text-muted">{selectedOrg.name} · Your role: {selectedOrg.role}</p>
      {error && <p role="alert" className="text-severity-critical">{error}</p>}
      {success && <p role="status" className="rounded-md border border-severity-low/20 bg-severity-low/[0.05] px-3 py-2 text-sm text-severity-low">{success}</p>}
      <section id="team" className="scroll-mt-24 border border-text-primary/10 bg-bg-secondary rounded-xl p-5 space-y-4"><h2 className="font-semibold">Team members</h2>
        {members.map(member => <div key={member.user.id} className="flex flex-wrap gap-3 justify-between border-t border-text-primary/10 py-3">
          <div><p>{member.user.name}</p><p className="text-xs text-text-muted">{member.user.email} · {member.role}</p></div>
          {canManage && member.role !== "owner" && member.user.id !== (user?.id || user?._id) && <div className="flex gap-3">
            {selectedOrg.role === "owner" && <label className="text-xs">Role<select disabled={busy} value={member.role} className="ml-2 rounded-md border border-text-primary/10 bg-bg-elevated px-3 py-2 text-sm" onChange={e => mutate(() => request(`/${member.user.id}/role`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) }))}><option>developer</option><option>admin</option></select></label>}
            <button disabled={busy} className="text-sm text-severity-critical underline" onClick={() => mutate(() => request(`/${member.user.id}`, { method: "DELETE" }))}>Revoke access</button>
          </div>}
        </div>)}
      </section>
      {canManage && <section className="border border-text-primary/10 bg-bg-secondary rounded-xl p-5 space-y-4">
        <div><h2 className="font-semibold">Invite a teammate</h2><p className="mt-1 text-sm text-text-muted">Create a 7-day link and share it securely with the invited person; they must sign in with this exact verified email.</p></div>
        <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); mutate(async () => {
          const data = await invitationRequest("", { method: "POST", body: JSON.stringify({ email, role, ...(sendEmail && emailDeliveryAvailable ? { sendEmail: true } : {}) }) });
          setInviteUrl(data.invitation.url); setInviteDelivery(data.invitation.emailDelivery?.status || "manual"); setEmail("");
        }); }}>
          <label className="text-xs">Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border border-text-primary/10 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-security focus:outline-none" /></label>
          <label className="text-xs">Role<select value={role} onChange={e => setRole(e.target.value)} className="mt-1 block rounded-md border border-text-primary/10 bg-bg-elevated px-3 py-2 text-sm"><option>developer</option>{selectedOrg.role === "owner" && <option>admin</option>}</select></label>
          {emailDeliveryAvailable && <label className="flex items-center gap-2 self-end py-2 text-sm"><input type="checkbox" checked={sendEmail} disabled={busy} onChange={e => setSendEmail(e.target.checked)} />Email this invitation</label>}
          <button disabled={busy} className="self-end rounded-md bg-accent-security px-3 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-security disabled:opacity-60">{sendEmail && emailDeliveryAvailable ? "Create and email invite" : "Create invite link"}</button>
        </form>
        {inviteUrl && <div className="space-y-2" role="status"><p className="text-sm text-accent-security">Invite link created. Only the invited person’s verified email can accept it before it expires.</p><p className="text-xs text-text-secondary">{inviteDelivery === "accepted" ? "Email accepted by the provider; inbox delivery is not confirmed." : inviteDelivery === "failed" || inviteDelivery === "not_configured" ? "Email could not be sent. Share the invitation link securely instead." : inviteDelivery === "unknown" ? "Email status could not be confirmed. Share the link if needed; creating another invite replaces this link." : "Share this link securely with the invited person."}</p><div className="flex flex-wrap gap-2"><input readOnly aria-label="Invitation link" value={inviteUrl} className="min-w-0 flex-1 rounded-md border border-text-primary/10 bg-bg-primary p-2 text-xs text-text-primary" /><button type="button" className="rounded-md border border-text-primary/15 px-3 py-2 text-sm" onClick={async () => { try { setError(""); await navigator.clipboard.writeText(inviteUrl); setInviteCopied(true); window.setTimeout(() => setInviteCopied(false), 2000); } catch { setError("Copy was unavailable; select and copy the invitation link."); } }}>{inviteCopied ? "Copied" : "Copy link"}</button></div></div>}
        {invitations.length > 0 && <div className="space-y-2 border-t border-text-primary/10 pt-3"><h3 className="text-sm font-medium">Open invitations</h3>{invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 text-sm"><div><p>{invitation.email} · {invitation.role}</p><p className="text-xs text-text-muted">Expires {new Date(invitation.expiresAt).toLocaleDateString()} · {invitation.status}{invitation.emailStatus && invitation.emailStatus !== "manual" ? ` · Email ${emailStatusLabel[invitation.emailStatus] || "status unconfirmed"}` : ""}</p></div><button disabled={busy} className="text-xs text-severity-critical underline" onClick={() => mutate(() => invitationRequest(`/${invitation.id}`, { method: "DELETE" }))}>Revoke</button></div>)}</div>}
      </section>}
      {canManage && <section id="activity" aria-label="Recent security activity" className="border border-text-primary/10 bg-bg-secondary rounded-xl p-5 space-y-3">
        <div><h2 className="font-semibold">Recent security activity</h2><p className="mt-1 text-sm text-text-muted">A record of scans, access changes, reviews, AI approvals, and draft pull requests. Sensitive code, invite links, and review reasons are not copied into this log.</p></div>
        {auditWarning && <p role="status" className="rounded-md border border-severity-medium/20 bg-severity-medium/[0.04] px-3 py-2 text-sm text-severity-medium">{auditWarning}</p>}
        {auditError ? <div role="alert" className="text-sm text-severity-medium"><p>{auditError}</p><button className="mt-2 underline" onClick={load}>Retry activity log</button></div>
          : auditEvents.length ? <ol className="divide-y divide-text-primary/10">{auditEvents.map(event => <li key={event._id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"><p className="text-sm text-text-primary">{describeAuditEvent(event)}</p><time className="shrink-0 text-xs text-text-muted" dateTime={event.createdAt}>{formatAuditDate(event.createdAt)}</time></li>)}</ol>
            : <p className="rounded-lg border border-dashed border-text-primary/10 px-4 py-5 text-sm text-text-muted">No security activity has been recorded for this organization yet.</p>}
      </section>}
      <section id="privacy" className="scroll-mt-24 border border-text-primary/10 bg-bg-secondary rounded-xl p-5 space-y-3"><h2 className="font-semibold">Hosted AI privacy</h2>
        <p className="text-sm text-text-muted">Hosted AI is off for new organizations. When enabled, a member must approve each request after reviewing its sanitized evidence preview. NVIDIA receives that evidence and up to four excerpts from the approved shared security index.</p>
        {canManage ? <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-accent-security" checked={hostedAiEnabled} disabled={busy}
          onChange={e => mutate(async () => { await aiSettingsRequest({ method: "PATCH", body: JSON.stringify({ hostedAiEnabled: e.target.checked }) }); })} />
          <span><span className="font-medium text-text-primary">Allow hosted AI for this organization</span><span className="block mt-1 text-xs text-text-muted">Owners and admins can change this at any time. Turning it off blocks new hosted inference requests.</span></span></label>
          : <p className="text-sm">Hosted AI is <strong className={hostedAiEnabled ? "text-accent-security" : "text-severity-medium"}>{hostedAiEnabled ? "enabled" : "disabled"}</strong> for this organization. Ask an owner or admin to change it.</p>}
      </section>
      <section id="data" className="scroll-mt-24 border border-text-primary/10 rounded-xl p-5 text-sm text-text-muted space-y-3"><h2 className="font-semibold text-text-primary">Data and integrations</h2>
        <p>Scans use temporary source workspaces. Findings and review reasons are stored for this organization. AI requests send sanitized excerpts to NVIDIA; use approved material.</p>
        {canManage && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-text-primary/10 pt-3">
          <div><p className="font-medium text-text-primary">Export organization data</p><p className="mt-1 text-xs">Download members, invitations, scan and finding metadata, reviews, activity, and verification records as JSON. Source snippets and credentials are excluded. The file reflects records as they are read.</p></div>
          <button type="button" disabled={busy || exportBusy} onClick={downloadOrganizationExport} className="shrink-0 rounded-md border border-text-primary/15 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-text-primary/[0.05] disabled:cursor-not-allowed disabled:opacity-50">{exportBusy ? "Preparing export…" : "Download JSON export"}</button>
        </div>}
        <p>Repository automation is configured from each repository page. Write permissions are needed only to create draft pull requests.</p>
      </section>
    </>}
    <div id="account" className="scroll-mt-24 space-y-5">
      {selectedOrg?.role === "owner" && <section aria-label="Transfer organization ownership" className="border border-severity-medium/20 bg-bg-secondary rounded-xl p-5 space-y-4">
        <div><h2 className="font-semibold">Transfer ownership</h2><p className="mt-1 text-sm text-text-muted">The selected active member becomes owner. You keep access as an admin. Transfer ownership before leaving this workspace.</p></div>
        <form className="flex flex-wrap items-end gap-3" onSubmit={transferOwnership}>
          <label className="text-xs">New owner<select required value={transferTarget} disabled={busy} onChange={e => setTransferTarget(e.target.value)} className="mt-1 block min-w-52 rounded-md border border-text-primary/10 bg-bg-elevated px-3 py-2 text-sm">
            <option value="">Select an active teammate</option>{members.filter(member => member.role !== "owner" && member.user.id !== (user?.id || user?._id)).map(member => <option key={member.user.id} value={member.user.id}>{member.user.name} · {member.role}</option>)}
          </select></label>
          <label className="text-xs">Type <span className="font-semibold">{selectedOrg.name}</span> to confirm<input required autoComplete="off" value={transferConfirmation} onChange={e => setTransferConfirmation(e.target.value)} aria-label="Confirm organization name" className="mt-1 block w-full rounded-md border border-text-primary/10 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-security focus:outline-none" /></label>
          <button type="submit" disabled={busy || !transferTarget || transferConfirmation !== selectedOrg.name} className="rounded-md border border-severity-medium/30 px-3 py-2 text-sm font-semibold text-severity-medium transition-colors hover:bg-severity-medium/[0.06] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Transferring…" : "Transfer ownership"}</button>
        </form>
      </section>}
      {selectedOrg && selectedOrg.role !== "owner" && <section aria-label="Leave organization" className="border border-severity-critical/15 bg-bg-secondary rounded-xl p-5 space-y-3">
        <div><h2 className="font-semibold">Leave this organization</h2><p className="mt-1 text-sm text-text-muted">Your access to its repositories, scans, and team settings will end. An owner can invite you again later.</p></div>
        <form className="flex flex-wrap items-end gap-3" onSubmit={leaveOrganization}>
          <label className="text-xs">Type <span className="font-semibold">{selectedOrg.name}</span> to confirm<input required autoComplete="off" aria-label="Confirm organization name to leave" value={leaveConfirmation} onChange={e => setLeaveConfirmation(e.target.value)} className="mt-1 block w-full rounded-md border border-text-primary/10 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-security focus:outline-none" /></label>
          <button type="submit" disabled={busy || leaveConfirmation !== selectedOrg.name} className="rounded-md border border-severity-critical/25 px-3 py-2 text-sm font-semibold text-severity-critical transition-colors hover:bg-severity-critical/[0.06] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Leaving…" : "Leave organization"}</button>
        </form>
      </section>}
    <OrganizationDeletion key={org} organization={selectedOrg} refreshContext={refreshContext} />
    <AccountDeletion user={user} />
    </div>
  </main>;
}

function describeAuditEvent(event) {
  const details = event.details || {};
  const target = details.repository || details.account || event.target;
  const descriptions = {
    "organization.created": "created this organization",
    "scan.started": `started a scan of ${target}`,
    "scan.cancelled": `cancelled a scan of ${target}`,
    "finding.reviewed": `marked a finding ${details.status || "reviewed"} in ${target}`,
    "github.installation_connected": `connected GitHub access for ${target}`,
    "github.installation_disconnected": `GitHub access was removed for ${target}`,
    "member.role_changed": `changed a team member's role from ${details.fromRole || "unknown"} to ${details.toRole || "unknown"}`,
    "member.removed": "removed a team member's access",
    "member.left": "left this organization",
    "member.account_deleted": "deleted their personal account and ended their membership",
    "member.ownership_transferred": "transferred organization ownership",
    "invitation.created": `created a ${details.role || "team"} invitation`,
    "invitation.revoked": "revoked a team invitation",
    "invitation.accepted": `accepted a ${details.role || "team"} invitation`,
    "ai.settings_changed": `set hosted AI ${details.hostedAiEnabled ? "on" : "off"}`,
    "ai.request_consented": `approved a hosted ${details.provider || "AI"} ${details.operation || "assistant"} request`,
    "pull_request.draft_created": `created draft pull request #${details.pullRequestNumber || "?"} for ${target}`,
  };
  return `${event.actorLabel || "A team member"} ${descriptions[event.action] || `performed ${event.action} on ${target}`}.`;
}

function formatAuditDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
