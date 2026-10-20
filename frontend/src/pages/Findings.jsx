import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { FindingCard } from "../components/ui/FindingCard";
export default function Findings() {
  const { selectedOrg } = useOutletContext(); const org = selectedOrg?.id || selectedOrg?._id;
  const [data, setData] = useState(null), [error, setError] = useState("");
  const [page, setPage] = useState(1), [risk, setRisk] = useState("all"), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!org) return; const controller = new AbortController(); setError("");
    fetch(`${API_BASE_URL}/scans/organizations/${org}/findings?page=${page}${risk === "all" ? "" : `&riskCategory=${risk}`}`, { credentials: "include", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || "Unable to load findings"); return body.data; })
      .then(setData).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [org, page, risk, revision]);
  return <main className="max-w-6xl mx-auto p-6 space-y-5 text-white"><h1 className="text-2xl font-semibold">Current unresolved findings</h1>
    <p className="text-sm text-slate-400">Open and acknowledged findings from each repository's latest scan with complete configured scanner coverage. Partial scans remain available in repository history.</p>
    {error && <p role="alert" className="text-red-200">{error} <button className="underline" onClick={() => setRevision(n => n + 1)}>Retry</button></p>}
    <label className="text-sm">Risk<select aria-label="Risk filter" value={risk} onChange={e => { setRisk(e.target.value); setPage(1); }} className="ml-3 bg-[#151820] p-2 rounded">{["all", "critical", "high", "medium", "low"].map(v => <option key={v}>{v}</option>)}</select></label>
    {!org && <p>Select an organization.</p>}
    {data?.findings.map(f => <FindingCard key={f._id} finding={f} organizationId={org} commitSha={data.latestScans.find(s => s.scan === f.scan)?.commitSha} onReviewed={() => setRevision(n => n + 1)} />)}
    {data && !data.findings.length && <p className="text-slate-400">No unresolved findings match this view.</p>}
    {data && <nav className="flex gap-4 items-center" aria-label="Findings pagination"><button disabled={page <= 1} className="disabled:opacity-30 underline" onClick={() => setPage(n => n - 1)}>Previous</button><span className="text-sm">{page}/{data.pagination.totalPages} · {data.pagination.total} findings</span><button className="disabled:opacity-30 underline" disabled={page >= data.pagination.totalPages} onClick={() => setPage(n => n + 1)}>Next</button></nav>}
  </main>;
}
