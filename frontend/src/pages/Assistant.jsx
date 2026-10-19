import React, { useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

const box = "rounded-2xl border border-white/10 bg-[#0D0F12] p-5 sm:p-6";
const field = "w-full rounded-lg border border-white/15 bg-[#08090B] px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400";
const button = "rounded-lg bg-[#4ADE80] px-4 py-2 text-sm font-semibold text-[#08090B] disabled:opacity-40 hover:bg-green-300";
const labels = { python: "Python", javascript: "JavaScript", typescript: "TypeScript", c: "C", cpp: "C++", bash: "Bash" };

function TextList({ title, items }) {
  if (!items?.length) return null;
  return <div className="space-y-2"><h3 className="text-xs font-mono uppercase tracking-wider text-green-300">{title}</h3>
    {Array.isArray(items) ? <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
      : <pre className="text-sm whitespace-pre-wrap text-slate-300">{items}</pre>}</div>;
}

function Sources({ sources = [] }) {
  return <div className="space-y-3"><h3 className="text-xs uppercase font-mono text-green-300">Retrieved evidence</h3>
    {!sources.length && <p className="text-sm text-amber-200">No relevant sources retrieved. Context is insufficient.</p>}
    {sources.map((s) => <details key={s.id} className="rounded-lg border border-white/10 p-3">
      <summary className="cursor-pointer text-sm text-slate-200 break-all">{s.source}:{s.startLine}–{s.endLine}
        {typeof s.score === "number" && <span className="ml-2 text-slate-500">similarity {s.score.toFixed(3)}</span>}</summary>
      <p className="text-xs text-slate-500 my-2">Source ID {s.id}</p>
      <pre className="whitespace-pre-wrap text-xs text-slate-400">{s.text}</pre>
    </details>)}
  </div>;
}

export default function Assistant({ demo = false }) {
  const context = useOutletContext();
  const [params] = useSearchParams();
  const organizationId = context?.selectedOrg?._id || context?.selectedOrg?.id;
  const base = demo ? `${API_BASE_URL}/ai/demo` : organizationId ? `${API_BASE_URL}/organizations/${organizationId}/ai` : null;
  const [tab, setTab] = useState("investigate");
  const [health, setHealth] = useState(null);
  const [knowledge, setKnowledge] = useState(null);
  const [fixtures, setFixtures] = useState(null);
  const [eventText, setEventText] = useState("");
  const [findingId, setFindingId] = useState(params.get("findingId") || "");
  const [language, setLanguage] = useState("javascript");
  const [mode, setMode] = useState("generate");
  const [request, setRequest] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [query, setQuery] = useState("Repeated SSH authentication failures");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeBase = useRef(base);
  const pendingRequest = useRef(null);
  activeBase.current = base;

  async function api(route, body, signal) {
    const response = await fetch(`${base}/${route}`, { method: body === undefined ? "GET" : "POST",
      credentials: "include", signal, headers: { "Content-Type": "application/json", ...(demo ? { "X-SecurePatch-Demo": "1" } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const payload = await response.json();
    if (!response.ok && !payload.data) throw new Error(payload.error?.message || "Assistant request failed");
    return payload.data;
  }

  useEffect(() => {
    if (!base) return;
    let live = true;
    const controller = new AbortController();
    setResult(null); setError(""); setHealth(null); setKnowledge(null); setBusy(false);
    Promise.all([api("health", undefined, controller.signal), api("knowledge", undefined, controller.signal),
      api("fixtures", undefined, controller.signal)]).then(([h, k, f]) => {
      if (!live) return;
      setHealth(h); setKnowledge(k); setFixtures(f);
      setEventText(JSON.stringify(f.events.suspicious, null, 2));
      setRequest(f.code.javascript.request);
    }).catch((e) => { if (live) setError(demo ? `${e.message}. Start the backend with npm run demo.` : e.message); });
    return () => { live = false; controller.abort(); pendingRequest.current?.abort(); };
  }, [base]);

  function loadCode(name) {
    const fixture = fixtures?.code[name];
    if (!fixture) return;
    setLanguage(fixture.language); setMode(fixture.mode); setRequest(fixture.request);
    setOriginalCode(fixture.originalCode || "");
  }

  async function run(event) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    const startedFor = base;
    const controller = new AbortController();
    pendingRequest.current = controller;
    try {
      const response = tab === "investigate" ? await api("analyze", findingId.trim() && !demo
        ? { findingId: findingId.trim() } : { event: JSON.parse(eventText) }, controller.signal)
        : tab === "code" ? await api("code", { language, mode, request, ...(mode === "review" ? { originalCode } : {}) }, controller.signal)
          : await api("retrieve", { query }, controller.signal);
      if (activeBase.current !== startedFor) return;
      setResult(response);
      if (response.status === "unavailable") setError(response.error?.message || "AI assistance unavailable; original evidence is retained.");
    } catch (e) { if (activeBase.current === startedFor && e.name !== "AbortError") setError(e instanceof SyntaxError ? "Event must contain valid JSON." : e.message); }
    finally { if (activeBase.current === startedFor) setBusy(false); }
  }

  return <div className="min-h-screen bg-[#08090B] text-white px-4 py-8 sm:px-8">
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <Link to={demo ? "/" : "/dashboard"} className="hover:text-green-300">← SecurePatch</Link>
        <span>{demo ? "LOCAL SYNTHETIC DEMO" : "ORGANIZATION ASSISTANT"}</span>
      </div>
      <header className="space-y-3 py-4">
        <p className="text-green-400 font-mono text-xs tracking-[0.2em] uppercase">NVIDIA Nemotron · Retrieval augmented assistance</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Evidence before action.</h1>
        <p className="max-w-2xl text-slate-400 text-sm leading-relaxed">Investigate supplied events, explain scanner findings, and draft defensive code with traceable sources.</p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 px-3 py-1">NVIDIA: {health?.status || "checking"}</span>
          <span className="rounded-full border border-white/10 px-3 py-1">Knowledge: {knowledge?.chunks ?? "—"} chunks</span>
          <span className="rounded-full border border-white/10 px-3 py-1">Code execution disabled</span>
        </div>
      </header>
      <div className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-4 text-xs text-amber-100/80 leading-relaxed">
        Requests send sanitized excerpts to NVIDIA-hosted inference. Use approved, nonsensitive material; redaction is best effort.
        {demo && " Demo events are synthetic. This application has no network detection engine."}
        {" "}Advice, code and suggested tests require review. No proposed action is executed.
      </div>
      <nav className="flex gap-2" aria-label="Assistant workflows">
        {[["investigate", "Investigate"], ["code", "Code & review"], ["sources", "Knowledge"]].map(([id, label]) =>
          <button key={id} type="button" disabled={busy} onClick={() => { setTab(id); setResult(null); setError(""); }}
            className={`rounded-lg px-4 py-2 text-sm border ${tab === id ? "border-green-400/40 bg-green-400/10 text-green-300" : "border-white/10 text-slate-400"}`}>{label}</button>)}
      </nav>
      {error && <p role="alert" className="p-4 rounded-xl border border-rose-400/30 bg-rose-400/10 text-sm text-rose-200">{error}</p>}
      {!demo && !organizationId && <p className="text-sm text-amber-200">Select an organization to use the assistant.</p>}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 items-start">
        <form onSubmit={run} className={`${box} space-y-4`}>
          {tab === "investigate" && <>
            <h2 className="font-semibold">Structured evidence</h2>
            {!demo && <label className="block text-sm text-slate-300">Existing finding ID (optional)
              <input aria-label="Finding ID" className={`${field} mt-2`} value={findingId} onChange={(e) => setFindingId(e.target.value)} maxLength={24} />
            </label>}
            <div className="flex gap-2">{["suspicious", "benign"].map((name) => <button key={name} type="button" disabled={!fixtures || busy}
              onClick={() => { setEventText(JSON.stringify(fixtures.events[name], null, 2)); setFindingId(""); }}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs capitalize">{name} fixture</button>)}</div>
            <label className="block text-xs text-slate-400">Event JSON
              <textarea className={`${field} mt-2 font-mono text-xs`} aria-label="Event JSON" rows={17} maxLength={16000}
                value={eventText} onChange={(e) => setEventText(e.target.value)} disabled={busy || Boolean(findingId && !demo)} />
            </label>
          </>}
          {tab === "code" && <>
            <h2 className="font-semibold">Defensive code proposal</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">Language<select className={`${field} mt-2`} value={language} onChange={(e) => loadCode(e.target.value)}>
                {(health?.languages || Object.keys(labels)).map((l) => <option key={l} value={l}>{labels[l]}</option>)}</select></label>
              <label className="text-xs text-slate-400">Mode<select className={`${field} mt-2`} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="generate">Generate</option><option value="review">Review as diff</option></select></label>
            </div>
            <button type="button" disabled={!fixtures || busy} onClick={() => loadCode("review")} className="text-xs text-green-300 underline">Load review example</button>
            <label className="block text-xs text-slate-400">Request<textarea aria-label="Code request" className={`${field} mt-2`} rows={8}
              value={request} onChange={(e) => setRequest(e.target.value)} required maxLength={3000} /></label>
            {mode === "review" && <label className="block text-xs text-slate-400">Source for review<textarea aria-label="Source for review"
              className={`${field} mt-2 font-mono`} rows={7} value={originalCode} onChange={(e) => setOriginalCode(e.target.value)} required maxLength={8000} /></label>}
          </>}
          {tab === "sources" && <>
            <h2 className="font-semibold">Inspect shared knowledge</h2>
            <p className="text-xs text-slate-400">{fixtures?.provenance}. Only operator-approved files are indexed.</p>
            <label className="block text-xs text-slate-400">Search query<input aria-label="Knowledge query" className={`${field} mt-2`} value={query}
              onChange={(e) => setQuery(e.target.value)} maxLength={1500} required /></label>
            <ul className="space-y-2 text-xs text-slate-500 break-all">{knowledge?.sources?.map((s) => <li key={s}>{s}</li>)}</ul>
          </>}
          <button className={button} disabled={busy || !base || !health}>{busy ? "Waiting for NVIDIA…" : tab === "investigate" ? "Analyze evidence" : tab === "code" ? "Draft proposal" : "Retrieve sources"}</button>
          <p className="text-xs text-slate-500">{busy ? "The request may retry on a temporary provider failure." : "Nothing is applied, executed, blocked or deployed."}</p>
        </form>
        <section className={`${box} space-y-6`} aria-live="polite" aria-label="Assistant result">
          {!result && <div className="py-14 text-center"><p className="text-green-300 font-mono text-sm">A reviewable result starts here.</p>
            <p className="mt-3 text-sm text-slate-500">Submit evidence or a request to see sources, limitations and next steps.</p></div>}
          {result?.original && <details open className="space-y-3"><summary className="font-semibold cursor-pointer">Original evidence · {result.kind}</summary>
            <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-slate-300">{JSON.stringify(result.original, null, 2)}</pre>
            {result.detector && <p className="text-xs text-amber-200">Scanner verdict retained: {result.detector.severity}; risk {result.detector.riskScore} (not a probability).</p>}</details>}
          {result?.analysis && <><div><p className="text-xs text-amber-200 mb-2">Advisory severity: {result.analysis.severity_assessment}</p>
            <p className="text-sm text-slate-200 leading-relaxed">{result.analysis.summary}</p></div>
            {["observed_evidence", "possible_interpretations", "recommended_actions", "false_positive_checks", "missing_information", "limitations"].map((key) =>
              <TextList key={key} title={key.replaceAll("_", " ")} items={result.analysis[key]} />)}
          </>}
          {result?.proposal && <>
            <p className="text-sm text-slate-300">{result.proposal.explanation}</p>
            <p className="text-xs font-mono text-green-300">{labels[result.language]} · {result.proposal.format} · Syntax: {result.validation?.status} · Tests: not executed</p>
            {result.validation?.message && <p className="text-xs text-amber-200">{result.validation.message}</p>}
            <pre className="overflow-auto max-h-[32rem] rounded-lg bg-black/40 p-4 text-xs text-green-100"><code>{result.proposal.code}</code></pre>
            {["assumptions", "dependencies", "security_considerations", "validation_instructions", "tests"].map((key) =>
              <TextList key={key} title={key === "tests" ? "Suggested tests · unexecuted" : key.replaceAll("_", " ")} items={result.proposal[key]} />)}
          </>}
          {result && <Sources sources={result.sources || result.retrieved_sources} />}
          <TextList title="Application limitations" items={result?.limitations} />
          {result?.requestId && <p className="text-[10px] text-slate-600 font-mono break-all">Request {result.requestId}</p>}
        </section>
      </div>
    </div>
  </div>;
}
