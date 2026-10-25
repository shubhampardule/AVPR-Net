import React, { useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { FindingCard } from "../components/ui/FindingCard";
import { ScanStatusBadge } from "../components/ui/ScanStatusBadge";
const panel = "rounded-xl border border-text-primary/10 bg-bg-secondary p-5";
const button = "rounded-lg border border-text-primary/20 px-3 py-2 text-sm disabled:opacity-40 hover:border-accent-security";
const scannerLabels = { semgrep: "Semgrep rules", bandit: "Python security checks", secrets: "Credential pattern checks", dependency: "npm dependency advisories (opt-in)", trivy: "Trivy (not enabled)" };
function timestamp(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export default function ScanPage() {
  const { owner, repo } = useParams();
  const [searchParams] = useSearchParams();
  const { selectedOrg } = useOutletContext();
  const org = selectedOrg?.id || selectedOrg?._id;
  const scope = `${org}/${owner}/${repo}`;
  const current = useRef(scope); current.current = scope;
  const [history, setHistory] = useState([]), [historyLoading, setHistoryLoading] = useState(true), [scanId, setScanId] = useState("");
  const [scan, setScan] = useState(null), [findings, setFindings] = useState([]);
  const [page, setPage] = useState(1), [pagination, setPagination] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [risk, setRisk] = useState("all"), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false), [cancelling, setCancelling] = useState(false);
  const selectedScan = useRef(""); selectedScan.current = `${scope}/${scanId}`;
  const comparisonRequest = useRef(0);
  const [refresh, setRefresh] = useState(0), [historyRevision, setHistoryRevision] = useState(0), [supplyChain, setSupplyChain] = useState(false);
  const endpoint = `${API_BASE_URL}/scans`;
  async function json(path, options = {}) {
    const r = await fetch(`${endpoint}${path}`, { credentials: "include", ...options });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error?.message || b.message || "Scan request failed");
    return b.data;
  }
  useEffect(() => {
    comparisonRequest.current++;
    setComparing(false); setCancelling(false); setComparison(null);
  }, [scope, scanId]);
  useEffect(() => {
    const controller = new AbortController();
    setHistory([]); setScanId(""); setScan(null); setFindings([]); setPagination(null);
    setComparison(null); setError(""); setPage(1); setRisk("all");
    setHistoryLoading(Boolean(org));
    if (org) json(`/organizations/${org}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setHistory(data.scans); setScanId(searchParams.get("scanId") || data.scans[0]?._id || ""); } })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    else setHistoryLoading(false);
    return () => controller.abort();
  }, [scope, historyRevision]);
  useEffect(() => {
    if (!scanId) { setDetailsLoading(false); return; }
    const controller = new AbortController(); let timer;
    setError(""); setDetailsLoading(true);
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
        setDetailsLoading(false);
        if (["queued", "running"].includes(status.status)) timer = setTimeout(load, 3000);
      } catch (e) { if (e.name !== "AbortError") { setError(e.message); setDetailsLoading(false); } }
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
      setFindings([]); setPagination(null); setComparison(null);
      setHistory(h => [{ ...data, _id: data.scanId }, ...h]);
    } catch (e) { if (current.current === startedFor) setError(e.message); }
    finally { if (current.current === startedFor) setBusy(false); }
  }
  async function cancel() {
    if (!scanId || cancelling) return;
    const startedFor = selectedScan.current;
    setCancelling(true); setError("");
    try { await json(`/${scanId}/cancel`, { method: "POST" }); if (selectedScan.current === startedFor) setRefresh(n => n + 1); }
    catch (e) { if (selectedScan.current === startedFor) setError(e.message); }
    finally { if (selectedScan.current === startedFor) setCancelling(false); }
  }
  async function compare() {
    if (!scanId || comparing) return;
    const startedFor = selectedScan.current, revision = ++comparisonRequest.current;
    const isCurrent = () => selectedScan.current === startedFor && comparisonRequest.current === revision;
    setComparing(true); setError("");
    try { const data = await json(`/${scanId}/comparison`); if (isCurrent()) setComparison(data); }
    catch (e) { if (isCurrent()) setError(e.message); }
    finally { if (isCurrent()) setComparing(false); }
  }
  const active = ["queued", "running"].includes(scan?.status);
  const scanOutcome = scan?.status === "completed"
    ? (scan.scannerErrors?.length ? "Finished with partial scanner coverage" : "Finished")
    : scan?.status === "failed" ? "Did not finish" : null;
  return <main className="app-page space-y-6">
    <Link className="text-accent-security text-sm" to={`/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}>← Repository</Link>
    <header className="flex flex-wrap items-center justify-between gap-4"><div>
      <p className="text-sm text-text-muted">{owner}/{repo}</p><h1 className="text-2xl font-semibold">Security scans</h1>
    </div><div className="flex gap-2"><button className={button} disabled={busy || active || !org} onClick={start}>{busy ? "Queuing…" : "New scan"}</button>
      {active && <button className={button} disabled={cancelling} onClick={cancel}>{cancelling ? "Cancelling…" : "Cancel scan"}</button>}</div></header>
    <label className="text-sm text-text-muted block"><input type="checkbox" checked={supplyChain} onChange={e => setSupplyChain(e.target.checked)} /> Include dependency advisories (package names/versions are sent to OSV). Credential pattern checks run locally.</label>
    {error && <p role="alert" className="rounded-lg border border-severity-critical/40 p-4 text-severity-critical">{error} <button className="ml-2 underline" onClick={() => scanId ? setRefresh(n => n + 1) : setHistoryRevision(n => n + 1)}>Retry</button>{scan && <span className="mt-2 block text-xs text-severity-medium">Existing scan details remain from the last successful load.</span>}</p>}
    <label className="block text-sm">Scan history<select aria-label="Scan history" disabled={historyLoading} className="ml-3 bg-bg-subtle border border-text-primary/20 p-2 rounded max-w-full disabled:opacity-60" value={scanId} onChange={e => { setScanId(e.target.value); setPage(1); setScan(null); setFindings([]); setPagination(null); setComparison(null); }}>
      <option value="">Select a scan</option>{history.map(s => <option key={s._id} value={s._id}>{new Date(s.createdAt).toLocaleString()} · {s.status} · {s.commitSha?.slice(0, 7) || "legacy"}</option>)}</select></label>
    {historyLoading && <p role="status" className="text-sm text-text-muted">Loading scan history…</p>}
    {!historyLoading && !error && history.length === 0 && <div className={`${panel} text-sm text-text-secondary`}><p className="font-medium text-text-primary">No scans yet for {owner}/{repo}.</p><p className="mt-1 text-text-muted">Start a scan to record its branch, commit, scanner coverage, and findings here.</p><button className={`${button} mt-4`} disabled={busy || !org} onClick={start}>{busy ? "Queuing…" : "Run first scan"}</button></div>}
    {scan && <section className={`${panel} space-y-4`}>
      <div className="flex flex-wrap gap-4 items-center"><ScanStatusBadge status={scan.status} /><span className={`text-sm ${scan.status === "failed" ? "text-severity-critical" : "text-text-secondary"}`}>{scanOutcome || (scan.status === "queued" ? "Queued" : "Running")}</span><span className="text-sm text-text-muted">{scan.summary?.total ?? 0} findings</span>
        {scan.commitSha && <a className="text-xs text-accent-security break-all" href={`https://github.com/${owner}/${repo}/commit/${scan.commitSha}`} target="_blank" rel="noreferrer">View scanned commit {scan.commitSha.slice(0, 12)}</a>}</div>
      <div className="grid gap-3 border-t border-text-primary/10 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-text-muted">Repository</p><p className="mt-1">{scan.owner || owner}/{scan.repo || repo}</p></div>
        <div><p className="text-xs text-text-muted">Branch</p><p className="mt-1 font-mono">{scan.branch || "Not recorded for this scan"}</p></div>
        <div><p className="text-xs text-text-muted">Started</p><p className="mt-1">{timestamp(scan.startedAt || scan.createdAt)}</p></div>
        <div><p className="text-xs text-text-muted">Finished</p><p className="mt-1">{timestamp(scan.completedAt)}</p></div>
      </div>
      <div className="rounded-lg border border-text-primary/[0.07] bg-black/10 p-4">
        <h2 className="text-sm font-medium">What was checked</h2>
        <p className="mt-1 text-xs leading-5 text-text-muted">{scan.includeDependencies ? "Dependency advisories were requested; package names and versions were sent to OSV. Credential pattern checks run locally." : "Credential pattern checks run locally. Dependency advisories were not included in this scan."}</p>
        {scan.scannersUsed?.length > 0 ? <ul className="mt-3 flex flex-wrap gap-2">{scan.scannersUsed.map(name => <li key={name} className="rounded-full border border-text-primary/10 px-2.5 py-1 text-xs text-text-secondary">{scannerLabels[name] || name}</li>)}</ul> : <p className="mt-3 text-xs text-severity-medium">Scanner run details were not recorded for this scan.</p>}
        {scan.coverage?.length > 0 && <ul className="mt-3 space-y-1 text-xs text-text-muted">{scan.coverage.map(item => <li key={item.scanner}>{scannerLabels[item.scanner] || item.scanner}: {item.scanned ?? "?"} files checked{item.skipped == null ? "" : `, ${item.skipped} skipped`}{item.packages == null ? "" : `, ${item.packages} packages checked`}</li>)}</ul>}
      </div>
      {active && <p aria-live="polite" className="text-severity-medium text-sm">{scan.status === "queued" ? "Waiting for the worker…" : "Scanning the pinned commit…"}</p>}
      {scan.errorMessage && <div className="rounded-lg border border-severity-critical/20 bg-severity-critical/5 p-3 text-sm text-severity-critical"><p>{scan.errorMessage}</p>{scan.status === "failed" && <button className="mt-2 underline" onClick={start}>Start a new scan</button>}</div>}
      {scan.scannerErrors?.length > 0 && <div className="text-severity-medium text-sm"><strong>Incomplete scanner coverage</strong>{scan.scannerErrors.map((e, i) => <p key={i}>{e.scanner}: {e.message}</p>)}</div>}
      <details><summary className="text-sm cursor-pointer">Technical scan record</summary><pre className="text-xs whitespace-pre-wrap mt-2 text-text-muted">{JSON.stringify({ scanId: scan._id, rulesHash: scan.rulesHash, scannerPolicyHash: scan.scannerPolicyHash, normalizerHash: scan.normalizerHash }, null, 2)}</pre></details>
      <div className="flex flex-wrap gap-2"><a className={button} href={`${endpoint}/${scanId}/export?format=json`}>Export JSON</a><a className={button} href={`${endpoint}/${scanId}/export?format=sarif`}>Export SARIF</a>
        <button className={button} disabled={scan.status !== "completed" || comparing} onClick={compare}>{comparing ? "Loading comparison…" : "Compare with previous scan"}</button></div>
    </section>}
    {comparison && <section className={`${panel} text-sm space-y-3`} aria-live="polite">
      <h2 className="font-semibold">Scan comparison</h2>
      <p className="text-text-secondary">{comparison.canCompare
        ? `Changes since the previous successful scan · New: ${comparison.new.length} · Persistent: ${comparison.persistent.length} · Fixed: ${comparison.fixed.length}`
        : "Change labels are unavailable for these scans."}</p>
      <p className="text-text-muted">{comparison.limitation}</p>
      {comparison.canCompare && ["new", "persistent", "fixed"].map(kind => <details key={kind}><summary className="capitalize cursor-pointer">{kind}</summary>{comparison[kind].length > 100 && <p className="text-text-muted">Showing 100 of {comparison[kind].length}. Export JSON for complete evidence.</p>}<ul className="list-disc pl-5">{comparison[kind].slice(0, 100).map(f => <li key={f._id}>{f.filePath}:{f.startLine} · {f.title}</li>)}</ul></details>)}
    </section>}
    <section className="space-y-3"><div className="flex justify-between items-center"><h2 className="font-semibold">Findings</h2><label className="text-sm">Risk <select aria-label="Risk filter" className="ml-2 bg-bg-subtle p-2 rounded" value={risk} onChange={e => { setRisk(e.target.value); setPage(1); setFindings([]); setPagination(null); }}>{["all", "critical", "high", "medium", "low"].map(v => <option key={v}>{v}</option>)}</select></label></div>
      {detailsLoading && !findings.length && <p role="status" className="text-sm text-text-muted">{scan ? "Loading findings for this view…" : "Loading scan details…"}</p>}
      {findings.map(f => <FindingCard key={f._id} finding={f} organizationId={org} commitSha={scan?.commitSha} onReviewed={() => setRefresh(n => n + 1)} />)}
      {!detailsLoading && !findings.length && pagination && <p className="text-text-muted">No findings match this filter. Review scanner coverage above before drawing conclusions.</p>}
      {!scanId && history.length > 0 && <p className="text-text-muted">Select a scan to inspect its findings.</p>}
      {pagination && <nav aria-label="Findings pagination" className="flex items-center justify-between gap-2"><button className={button} disabled={page <= 1} onClick={() => { setFindings([]); setPagination(null); setPage(p => p - 1); }}>Previous</button><span className="text-sm text-text-muted">Page {page} of {pagination.totalPages} · {pagination.total} matching findings</span><button className={button} disabled={page >= pagination.totalPages} onClick={() => { setFindings([]); setPagination(null); setPage(p => p + 1); }}>Next</button></nav>}
    </section>
  </main>;
}
