import React, { useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { FindingCard } from "../components/ui/FindingCard";
import { ScanStatusBadge } from "../components/ui/ScanStatusBadge";
const panel = "rounded-xl border border-white/10 bg-[#0D0F12] p-5";
const button = "rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40 hover:border-green-400";
export default function ScanPage() {
  const { owner, repo } = useParams();
  const [searchParams] = useSearchParams();
  const { selectedOrg } = useOutletContext();
  const org = selectedOrg?.id || selectedOrg?._id;
  const scope = `${org}/${owner}/${repo}`;
  const current = useRef(scope); current.current = scope;
  const [history, setHistory] = useState([]), [scanId, setScanId] = useState("");
  const [scan, setScan] = useState(null), [findings, setFindings] = useState([]);
  const [page, setPage] = useState(1), [pagination, setPagination] = useState(null);
  const [risk, setRisk] = useState("all"), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [comparison, setComparison] = useState(null);
  const [refresh, setRefresh] = useState(0), [supplyChain, setSupplyChain] = useState(false);
  const endpoint = `${API_BASE_URL}/scans`;
  async function json(path, options = {}) {
    const r = await fetch(`${endpoint}${path}`, { credentials: "include", ...options });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error?.message || b.message || "Scan request failed");
    return b.data;
  }
  useEffect(() => {
    const controller = new AbortController();
    setHistory([]); setScanId(""); setScan(null); setFindings([]); setPagination(null);
    setComparison(null); setError(""); setPage(1); setRisk("all");
    if (org) json(`/organizations/${org}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setHistory(data.scans); setScanId(searchParams.get("scanId") || data.scans[0]?._id || ""); } })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [scope]);
  useEffect(() => {
    if (!scanId) return;
    const controller = new AbortController(); let timer;
    setFindings([]); setComparison(null); setPagination(null);
    async function load() {
      try {
        const [status, result] = await Promise.all([
          json(`/${scanId}`, { signal: controller.signal }),
          json(`/${scanId}/findings?page=${page}&limit=25${risk === "all" ? "" : `&riskCategory=${risk}`}`, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        if (status.owner && (status.owner.toLowerCase() !== owner.toLowerCase() || status.repo.toLowerCase() !== repo.toLowerCase() || String(status.organization) !== String(org))) throw new Error("Scan does not belong to this repository and organization");
        setScan(status); setHistory(items => items.map(item => String(item._id) === String(status._id) ? { ...item, ...status } : item));
        setFindings(result.findings); setPagination(result.pagination); setError("");
        if (["queued", "running"].includes(status.status)) timer = setTimeout(load, 3000);
      } catch (e) { if (e.name !== "AbortError") setError(e.message); }
    }
    load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [scanId, page, risk, scope, refresh]);
  async function start() {
    if (!org || busy) return;
    const startedFor = scope; setBusy(true); setError("");
    try {
      const data = await json(`/organizations/${org}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ includeDependencies: supplyChain }),
      });
      if (current.current !== startedFor) return;
      setPage(1); setScanId(data.scanId); setScan({ ...data, _id: data.scanId });
      setHistory(h => [{ ...data, _id: data.scanId }, ...h]);
    } catch (e) { if (current.current === startedFor) setError(e.message); }
    finally { if (current.current === startedFor) setBusy(false); }
  }
  async function cancel() {
    try { await json(`/${scanId}/cancel`, { method: "POST" }); setRefresh(n => n + 1); }
    catch (e) { setError(e.message); }
  }
  async function compare() {
    const startedFor = scope;
    try { const data = await json(`/${scanId}/comparison`); if (current.current === startedFor) setComparison(data); }
    catch (e) { setError(e.message); }
  }
  const active = ["queued", "running"].includes(scan?.status);
  return <main className="mx-auto max-w-6xl p-5 space-y-5 text-white">
    <Link className="text-green-300 text-sm" to={`/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}>← Repository</Link>
    <header className="flex flex-wrap items-center justify-between gap-4"><div>
      <p className="text-sm text-slate-400">{owner}/{repo}</p><h1 className="text-2xl font-semibold">Security scans</h1>
    </div><div className="flex gap-2"><button className={button} disabled={busy || active || !org} onClick={start}>{busy ? "Queuing…" : "New scan"}</button>
      {active && <button className={button} onClick={cancel}>Cancel scan</button>}</div></header>
    <label className="text-sm text-slate-400 block"><input type="checkbox" checked={supplyChain} onChange={e => setSupplyChain(e.target.checked)} /> Include dependency advisories (package names/versions are sent to OSV). Credential pattern checks run locally.</label>
    {error && <p role="alert" className="rounded-lg border border-red-400/40 p-4 text-red-200">{error} <button className="underline" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
    <label className="block text-sm">Scan history<select aria-label="Scan history" className="ml-3 bg-[#151820] border border-white/20 p-2 rounded max-w-full" value={scanId} onChange={e => { setScanId(e.target.value); setPage(1); setScan(null); }}>
      <option value="">Select a scan</option>{history.map(s => <option key={s._id} value={s._id}>{new Date(s.createdAt).toLocaleString()} · {s.status} · {s.commitSha?.slice(0, 7) || "legacy"}</option>)}</select></label>
    {scan && <section className={`${panel} space-y-4`}>
      <div className="flex flex-wrap gap-4 items-center"><ScanStatusBadge status={scan.status} /><span className="text-sm text-slate-400">{scan.summary?.total || 0} findings</span>
        {scan.commitSha && <a className="text-xs text-green-300 break-all" href={`https://github.com/${owner}/${repo}/commit/${scan.commitSha}`} target="_blank" rel="noreferrer">Commit {scan.commitSha}</a>}</div>
      {active && <p aria-live="polite" className="text-amber-200 text-sm">{scan.status === "queued" ? "Waiting for the worker…" : "Scanning the pinned commit…"}</p>}
      {scan.errorMessage && <p className="text-red-200 text-sm">{scan.errorMessage}</p>}
      {scan.scannerErrors?.length > 0 && <div className="text-amber-200 text-sm"><strong>Incomplete scanner coverage</strong>{scan.scannerErrors.map((e, i) => <p key={i}>{e.scanner}: {e.message}</p>)}</div>}
      <details><summary className="text-sm cursor-pointer">Scanner coverage and provenance</summary><pre className="text-xs whitespace-pre-wrap mt-2 text-slate-400">{JSON.stringify({ coverage: scan.coverage, rulesHash: scan.rulesHash }, null, 2)}</pre></details>
      <div className="flex flex-wrap gap-2"><a className={button} href={`${endpoint}/${scanId}/export?format=json`}>Export JSON</a><a className={button} href={`${endpoint}/${scanId}/export?format=sarif`}>Export SARIF</a>
        <button className={button} disabled={scan.status !== "completed"} onClick={compare}>Compare with previous scan</button></div>
    </section>}
    {comparison && <section className={`${panel} text-sm space-y-3`}>
      <h2 className="font-semibold">Changes since the previous successful scan</h2>
      <p>New: {comparison.new.length} · Persistent: {comparison.persistent.length} · Fixed: {comparison.canInferFixed ? comparison.fixed.length : "not inferred (coverage differs)"}</p>
      <p className="text-slate-400">{comparison.limitation}</p>
      {["new", "persistent", "fixed"].map(kind => <details key={kind}><summary className="capitalize cursor-pointer">{kind}</summary>{comparison[kind].length > 100 && <p className="text-slate-400">Showing 100 of {comparison[kind].length}. Export JSON for complete evidence.</p>}<ul className="list-disc pl-5">{comparison[kind].slice(0, 100).map(f => <li key={f._id}>{f.filePath}:{f.startLine} · {f.title}</li>)}</ul></details>)}
    </section>}
    <section className="space-y-3"><div className="flex justify-between items-center"><h2 className="font-semibold">Findings</h2><label className="text-sm">Risk <select aria-label="Risk filter" className="ml-2 bg-[#151820] p-2 rounded" value={risk} onChange={e => { setRisk(e.target.value); setPage(1); }}>{["all", "critical", "high", "medium", "low"].map(v => <option key={v}>{v}</option>)}</select></label></div>
      {findings.map(f => <FindingCard key={f._id} finding={f} organizationId={org} commitSha={scan?.commitSha} onReviewed={() => setRefresh(n => n + 1)} />)}
      {!findings.length && pagination && <p className="text-slate-400">No findings match this filter. Check scanner coverage before drawing conclusions.</p>}
      {!scanId && <p className="text-slate-400">Select an organization and run a scan to inspect results.</p>}
      {pagination && <nav aria-label="Findings pagination" className="flex items-center justify-between gap-2"><button className={button} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span className="text-sm text-slate-400">Page {page} of {pagination.totalPages} · {pagination.total} matching findings</span><button className={button} disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button></nav>}
    </section>
  </main>;
}
