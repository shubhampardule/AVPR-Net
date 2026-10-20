import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
export default function Settings() {
  const { user, selectedOrg } = useOutletContext();
  const org = selectedOrg?.id || selectedOrg?._id;
  const [members, setMembers] = useState([]), [invitations, setInvitations] = useState([]), [email, setEmail] = useState("");
  const [role, setRole] = useState("developer"), [error, setError] = useState(""), [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = ["owner", "admin"].includes(selectedOrg?.role);
  async function request(suffix = "", options = {}) {
    const response = await fetch(`${API_BASE_URL}/organizations/${org}/members${suffix}`, {
      credentials: "include", headers: { "Content-Type": "application/json" }, ...options,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Member request failed");
    return data.data;
  }
  async function invitationRequest(suffix = "", options = {}) {
    const response = await fetch(`${API_BASE_URL}/organizations/${org}/invitations${suffix}`, {
      credentials: "include", headers: { "Content-Type": "application/json" }, ...options,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Invitation request failed");
    return data.data;
  }
  async function load() {
    try {
      const [memberResult, invitationResult] = await Promise.allSettled([
        request(), canManage ? invitationRequest() : Promise.resolve({ invitations: [] }),
      ]);
      if (memberResult.status === "rejected") throw memberResult.reason;
      setMembers(memberResult.value.members || []);
      if (invitationResult.status === "fulfilled") {
        setInvitations(invitationResult.value.invitations || []);
      } else {
        setError(invitationResult.reason.message || "Invitations could not be loaded");
      }
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (org) load(); }, [org]);
  async function mutate(action) {
    setBusy(true); setError("");
    try { await action(); await load(); } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <main className="max-w-4xl mx-auto p-6 space-y-6 text-white">
    <h1 className="text-2xl font-semibold">Workspace settings</h1>
    {!org ? <p>Select an organization.</p> : <>
      <p className="text-slate-400">{selectedOrg.name} · Your role: {selectedOrg.role}</p>
      {error && <p role="alert" className="text-red-200">{error}</p>}
      <section className="border border-white/10 bg-[#0D0F12] rounded-xl p-5 space-y-4"><h2 className="font-semibold">Team members</h2>
        {members.map(member => <div key={member.user.id} className="flex flex-wrap gap-3 justify-between border-t border-white/10 py-3">
          <div><p>{member.user.name}</p><p className="text-xs text-slate-400">{member.user.email} · {member.role}</p></div>
          {canManage && member.role !== "owner" && member.user.id !== (user?.id || user?._id) && <div className="flex gap-3">
            {selectedOrg.role === "owner" && <label className="text-xs">Role<select disabled={busy} value={member.role} className="ml-2 bg-[#151820] p-2" onChange={e => mutate(() => request(`/${member.user.id}/role`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) }))}><option>developer</option><option>admin</option></select></label>}
            <button disabled={busy} className="text-sm text-red-200 underline" onClick={() => mutate(() => request(`/${member.user.id}`, { method: "DELETE" }))}>Revoke access</button>
          </div>}
        </div>)}
      </section>
      {canManage && <section className="border border-white/10 bg-[#0D0F12] rounded-xl p-5 space-y-4">
        <div><h2 className="font-semibold">Invite a teammate</h2><p className="mt-1 text-sm text-slate-400">Create a 7-day link and share it securely with the invited person; they must sign in with this exact verified email.</p></div>
        <form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); mutate(async () => {
          const data = await invitationRequest("", { method: "POST", body: JSON.stringify({ email, role }) });
          setInviteUrl(data.invitation.url); setEmail("");
        }); }}>
          <label className="text-xs">Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="block bg-[#151820] p-2 mt-1 rounded" /></label>
          <label className="text-xs">Role<select value={role} onChange={e => setRole(e.target.value)} className="block bg-[#151820] p-2 mt-1 rounded"><option>developer</option>{selectedOrg.role === "owner" && <option>admin</option>}</select></label>
          <button disabled={busy} className="self-end rounded bg-green-300 px-3 py-2 text-sm font-medium text-black disabled:opacity-60">Create invite link</button>
        </form>
        {inviteUrl && <div className="space-y-2" role="status"><p className="text-sm text-green-200">Invite link created. Anyone with this link can use it once before it expires.</p><div className="flex flex-wrap gap-2"><input readOnly aria-label="Invitation link" value={inviteUrl} className="min-w-0 flex-1 rounded bg-[#151820] p-2 text-xs text-slate-200" /><button type="button" className="rounded border border-white/15 px-3 py-2 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(inviteUrl); } catch { setError("Copy was unavailable; select and copy the invitation link."); } }}>Copy link</button></div></div>}
        {invitations.length > 0 && <div className="space-y-2 border-t border-white/10 pt-3"><h3 className="text-sm font-medium">Open invitations</h3>{invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 text-sm"><div><p>{invitation.email} · {invitation.role}</p><p className="text-xs text-slate-400">Expires {new Date(invitation.expiresAt).toLocaleDateString()} · {invitation.status}</p></div><button disabled={busy} className="text-xs text-red-200 underline" onClick={() => mutate(() => invitationRequest(`/${invitation.id}`, { method: "DELETE" }))}>Revoke</button></div>)}</div>}
      </section>}
      <section className="border border-white/10 rounded-xl p-5 text-sm text-slate-400 space-y-2"><h2 className="font-semibold text-white">Data and integrations</h2>
        <p>Scans use temporary source workspaces. Findings and review reasons are stored for this organization. AI requests send sanitized excerpts to NVIDIA; use approved material.</p>
        <p>Repository automation is configured from each repository page. Write permissions are needed only to create draft pull requests.</p>
      </section>
    </>}
  </main>;
}
