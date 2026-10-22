import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api";
export default function RepositoryAutomation({ organization, owner, repo }) {
  const org = organization?.id || organization?._id;
  const [data, setData] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  const canManage = ["owner", "admin"].includes(organization?.role);
  const endpoint = `${API_BASE_URL}/organizations/${org}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/automation`;
  useEffect(() => {
    if (!org) return; const controller = new AbortController();
    fetch(endpoint, { credentials: "include", signal: controller.signal }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error?.message); return b.data; })
      .then(setData).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [endpoint, org, revision]);
  async function save(event) {
    event.preventDefault(); if (!canManage || busy) return; setBusy(true); setError(""); setSaved(false);
    try {
      const { push, pullRequest, frequency } = data.settings;
      const r = await fetch(endpoint, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ push, pullRequest, frequency }) });
      const b = await r.json(); if (!r.ok) throw new Error(b.error?.message || "Settings could not be saved"); setData(b.data); setSaved(true);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const edit = (key, value) => { setSaved(false); setData(d => ({ ...d, settings: { ...d.settings, [key]: value } })); };
  return <details className="rounded-xl border border-text-primary/10 p-4 my-5 text-sm"><summary className="cursor-pointer font-semibold">Repository automation</summary>
    {error && <div role="alert" className="text-severity-critical py-2"><p>{error}</p><button type="button" className="mt-2 underline" onClick={() => { setError(""); setRevision(value => value + 1); }}>Retry automation</button></div>}
    {saved && <p role="status" className="mt-3 text-severity-low">Automation settings saved.</p>}
    {!canManage && <p className="mt-3 text-xs text-text-muted">Only an owner or admin can change automation settings.</p>}
    {data && <form className="mt-4 space-y-3" onSubmit={save}>
      {!data.webhookReady && <p className="text-severity-medium">GitHub event triggers require the deployment's webhook setup. Scheduled scans can be enabled independently.</p>}
      <label className="block"><input type="checkbox" disabled={!canManage || busy || !data.webhookReady} checked={data.settings.push} onChange={e => edit("push", e.target.checked)} /> Scan default-branch pushes</label>
      <label className="block"><input type="checkbox" disabled={!canManage || busy || !data.webhookReady} checked={data.settings.pullRequest} onChange={e => edit("pullRequest", e.target.checked)} /> Scan opened/updated pull requests</label>
      <label className="block">Schedule<select disabled={!canManage || busy} className="ml-3 bg-bg-subtle p-2 rounded" value={data.settings.frequency} onChange={e => edit("frequency", e.target.value)}>{["off", "weekly", "monthly"].map(v => <option key={v}>{v}</option>)}</select></label>
      {data.settings.nextRunAt && <p className="text-text-muted">Next run: {new Date(data.settings.nextRunAt).toLocaleString()} (processed by the cloud worker)</p>}
      {data.settings.lastError && <p className="text-severity-medium">{data.settings.lastError}</p>}
      {["owner", "admin"].includes(organization?.role) && <button disabled={busy} className="text-accent-security underline underline-offset-4">{busy ? "Saving…" : "Save automation"}</button>}
    </form>}
  </details>;
}
