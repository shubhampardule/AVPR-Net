import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api";
export default function RepositoryAutomation({ organization, owner, repo }) {
  const org = organization?.id || organization?._id;
  const [data, setData] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `${API_BASE_URL}/organizations/${org}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/automation`;
  useEffect(() => {
    if (!org) return; const controller = new AbortController();
    fetch(endpoint, { credentials: "include", signal: controller.signal }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error?.message); return b.data; })
      .then(setData).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [endpoint, org]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { push, pullRequest, frequency } = data.settings;
      const r = await fetch(endpoint, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ push, pullRequest, frequency }) });
      const b = await r.json(); if (!r.ok) throw new Error(b.error?.message || "Settings could not be saved"); setData(b.data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const edit = (key, value) => setData(d => ({ ...d, settings: { ...d.settings, [key]: value } }));
  return <details className="rounded-xl border border-white/10 p-4 my-5 text-sm"><summary className="cursor-pointer font-semibold">Repository automation</summary>
    {error && <p role="alert" className="text-red-200 py-2">{error}</p>}
    {data && <form className="mt-4 space-y-3" onSubmit={save}>
      {!data.webhookReady && <p className="text-amber-200">GitHub event triggers require the deployment's webhook setup. Scheduled scans can be enabled independently.</p>}
      <label className="block"><input type="checkbox" disabled={!data.webhookReady} checked={data.settings.push} onChange={e => edit("push", e.target.checked)} /> Scan default-branch pushes</label>
      <label className="block"><input type="checkbox" disabled={!data.webhookReady} checked={data.settings.pullRequest} onChange={e => edit("pullRequest", e.target.checked)} /> Scan opened/updated pull requests</label>
      <label className="block">Schedule<select className="ml-3 bg-[#263032] p-2 rounded" value={data.settings.frequency} onChange={e => edit("frequency", e.target.value)}>{["off", "weekly", "monthly"].map(v => <option key={v}>{v}</option>)}</select></label>
      {data.settings.nextRunAt && <p className="text-slate-400">Next run: {new Date(data.settings.nextRunAt).toLocaleString()} (processed by the cloud worker)</p>}
      {data.settings.lastError && <p className="text-amber-200">{data.settings.lastError}</p>}
      {["owner", "admin"].includes(organization?.role) && <button disabled={busy} className="text-[#9BC2A9] underline underline-offset-4">{busy ? "Saving…" : "Save automation"}</button>}
    </form>}
  </details>;
}
