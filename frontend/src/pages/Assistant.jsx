import React, { useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { BrandLockup } from "../components/ui/BrandLogo";

const box = "rounded-xl border border-white/10 bg-[#171D1F] p-5 shadow-card sm:p-6";
const field = "w-full rounded-md border border-white/15 bg-[#101416] px-3 py-2 text-sm text-[#E8EEEB] placeholder:text-[#78857E] focus:outline-none focus:border-[#78A88B] focus:ring-1 focus:ring-[#78A88B]/40";
const button = "rounded-md bg-[#78A88B] px-4 py-2.5 text-sm font-semibold text-[#101916] transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#8DB89C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A2C7AE]";
const labels = { python: "Python", javascript: "JavaScript", typescript: "TypeScript", c: "C", cpp: "C++", bash: "Bash" };
const providerStatuses = {
  configured: "Connected",
  configured_unverified: "Configured · verification pending",
  missing_key: "Not configured",
};

function sanitizePreview(value, depth = 0) {
  if (depth > 8) return "[CONTENT TOO DEEP]";
  if (typeof value === "string") return value
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/g,
      match => "[REDACTED PRIVATE KEY]" + "\n".repeat((match.match(/\n/g) || []).length))
    .replace(/\b(?:nvapi-[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{12,}|AKIA[A-Z0-9]{16})\b/g, "[REDACTED TOKEN]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/((?:["']?)(?:api[_-]?key|password|passwd|secret|access[_-]?token|authorization|cookie)(?:["']?)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "$1[REDACTED]")
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED EMAIL]");
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(item => sanitizePreview(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /(?:password|secret|token|api.?key|authorization|cookie|email|user_?name|ip_?address|source_ip|destination_ip)/i.test(key)
      ? "[REDACTED]" : sanitizePreview(item, depth + 1)]));
  return "[UNSUPPORTED CONTENT]";
}

function TextList({ title, items }) {
  if (!items?.length) return null;
  return <div className="space-y-2"><h3 className="text-sm font-semibold capitalize text-[#D7DFDA]">{title}</h3>
    {Array.isArray(items) ? <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[#AEB9B3]">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
      : <pre className="whitespace-pre-wrap text-sm leading-6 text-[#AEB9B3]">{items}</pre>}</div>;
}

function Sources({ sources = [] }) {
  return <div className="space-y-3"><h3 className="text-sm font-semibold text-[#D7DFDA]">Retrieved evidence</h3>
    {!sources.length && <p className="text-sm text-amber-200">No relevant sources retrieved. Context is insufficient.</p>}
    {sources.map((s) => <details key={s.id} className="rounded-md border border-white/10 bg-[#101416] p-3">
      <summary className="cursor-pointer break-all text-sm text-[#D7DFDA]">{s.source}:{s.startLine}–{s.endLine}
        {typeof s.score === "number" && <span className="ml-2 text-[#89968F]">similarity {s.score.toFixed(3)}</span>}</summary>
      <p className="my-2 text-xs text-[#89968F]">Source ID {s.id}</p>
      <pre className="whitespace-pre-wrap text-xs text-[#AEB9B3]">{s.text}</pre>
    </details>)}
  </div>;
}

export default function Assistant({ demo = false }) {
  const context = useOutletContext();
  const [params] = useSearchParams();
  const organizationId = context?.selectedOrg?._id || context?.selectedOrg?.id;
  const canCreatePullRequest = ["owner", "admin"].includes(context?.selectedOrg?.role);
  const base = demo ? `${API_BASE_URL}/ai/demo` : organizationId ? `${API_BASE_URL}/organizations/${organizationId}/ai` : null;
  const [tab, setTab] = useState("investigate");
  const [health, setHealth] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [consentFor, setConsentFor] = useState(null);
  const [findingPreview, setFindingPreview] = useState(null);
  const [findingPreviewError, setFindingPreviewError] = useState("");
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
  const [draftContext, setDraftContext] = useState(null);
  const [patchCheck, setPatchCheck] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pullRequest, setPullRequest] = useState(null);
  const activeBase = useRef(base);
  const pendingRequest = useRef(null);
  const eventTextEdited = useRef(false);
  const requestEdited = useRef(false);
  activeBase.current = base;
  const requestFingerprint = JSON.stringify({ organizationId, tab, findingId: demo ? "" : findingId,
    eventText: tab === "investigate" ? eventText : "", language: tab === "code" ? language : "",
    mode: tab === "code" ? mode : "", request: tab === "code" ? request : "",
    originalCode: tab === "code" && mode === "review" ? originalCode : "", query: tab === "sources" ? query : "" });
  let previewValue, embeddingQuery;
  if (tab === "investigate") {
    if (findingId.trim() && !demo) {
      previewValue = findingPreview;
      if (findingPreview?.original) {
        const original = findingPreview.original;
        embeddingQuery = sanitizePreview(`${original.scanner} ${original.cwe || ""} ${original.title || ""}`.slice(0, 1500));
      }
    } else {
      try {
        const event = sanitizePreview(JSON.parse(eventText)); previewValue = event;
        embeddingQuery = sanitizePreview(`${event.category || ""} ${event.protocol || ""} ${event.description || ""}`.slice(0, 1500));
      } catch { previewValue = sanitizePreview(eventText); }
    }
  } else if (tab === "code") {
    previewValue = sanitizePreview({ language, mode, request, ...(mode === "review" ? { originalCode } : {}) });
    embeddingQuery = sanitizePreview(`${language} secure coding guidance ${sanitizePreview(request)}`.slice(0, 1500));
  } else { previewValue = sanitizePreview({ query }); embeddingQuery = sanitizePreview(query).slice(0, 1500); }
  const findingIdFormatInvalid = !demo && Boolean(findingId.trim()) && !/^[a-f0-9]{24}$/i.test(findingId.trim());
  const findingPreviewPending = !demo && tab === "investigate" && Boolean(findingId.trim()) && !findingIdFormatInvalid && !findingPreview;
  const hostedAiBlocked = !demo && policy?.hostedAiEnabled !== true;
  const providerStatus = health?.status
    ? providerStatuses[health.status] || health.status.replaceAll("_", " ")
    : "Checking";

  async function api(route, body, signal) {
    const response = await fetch(`${base}/${route}`, { method: body === undefined ? "GET" : "POST",
      credentials: "include", signal, headers: { "Content-Type": "application/json", ...(demo ? { "X-SecurePatch-Demo": "1" } : {}),
        ...(body === undefined ? {} : { "X-SecurePatch-AI-Consent": "1" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const payload = await response.json();
    if (!response.ok && !payload.data) throw new Error(payload.error?.message || "Assistant request failed");
    return payload.data;
  }

  useEffect(() => {
    if (!base) return;
    let live = true;
    const controller = new AbortController();
    eventTextEdited.current = false;
    requestEdited.current = false;
    setResult(null); setError(""); setHealth(null); setPolicy(null); setKnowledge(null); setBusy(false);
    setEventText(""); setRequest("");
    Promise.all([api("health", undefined, controller.signal), api("knowledge", undefined, controller.signal),
      api("fixtures", undefined, controller.signal), demo ? Promise.resolve({ hostedAiEnabled: true }) : api("policy", undefined, controller.signal)]).then(async ([h, k, f, p]) => {
      if (!live) return;
      setHealth(h); setPolicy(p); setKnowledge(k); setFixtures(f);
      if (!eventTextEdited.current) setEventText(JSON.stringify(f.events.suspicious, null, 2));
      if (!requestEdited.current) setRequest(f.code.javascript.request);
      if (!demo && params.get("mode") === "review" && params.get("findingId")) {
        const source = await api(`finding/${params.get("findingId")}`, undefined, controller.signal);
        if (!live) return;
        setDraftContext(source); setTab("code"); setLanguage(source.language); setMode("review");
        setOriginalCode(source.originalCode);
        if (!requestEdited.current) setRequest(source.request);
      }
    }).catch((e) => { if (live) setError(demo ? `${e.message}. Start the backend with npm run demo.` : e.message); });
    return () => { live = false; controller.abort(); pendingRequest.current?.abort(); };
  }, [base]);

  useEffect(() => {
    if (demo || !base || !/^[a-f0-9]{24}$/i.test(findingId.trim())) {
      setFindingPreview(null); setFindingPreviewError("");
      return;
    }
    let live = true;
    const controller = new AbortController();
    setFindingPreview(null); setFindingPreviewError("");
    const timer = setTimeout(() => api(`preview/finding/${findingId.trim()}`, undefined, controller.signal)
      .then(value => { if (live) setFindingPreview(value); })
      .catch(e => { if (live && e.name !== "AbortError") setFindingPreviewError(e.message); }), 250);
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [base, findingId, demo]);

  function loadCode(name) {
    const fixture = fixtures?.code[name];
    if (!fixture) return;
    setLanguage(fixture.language); setMode(fixture.mode); setRequest(fixture.request);
    setOriginalCode(fixture.originalCode || "");
  }

  function changeLanguage(name) {
    setLanguage(name);
    const fixture = fixtures?.code[name];
    if (fixture) {
      setMode(fixture.mode);
      setRequest(fixture.request);
      setOriginalCode(fixture.originalCode || "");
    }
  }

  async function run(event) {
    event.preventDefault(); setError("");
    if (consentFor !== requestFingerprint) { setError("Review the data preview and confirm sharing it for this request."); return; }
    setConsentFor(null);
    setBusy(true); setResult(null); setPatchCheck(null); setPullRequest(null); setAcknowledged(false);
    const startedFor = base;
    const controller = new AbortController();
    pendingRequest.current = controller;
    try {
      const response = tab === "investigate" ? await api("analyze", findingId.trim() && !demo
        ? { findingId: findingId.trim() } : { event: JSON.parse(eventText) }, controller.signal)
        : tab === "code" ? await api("code", { language, mode, request, ...(mode === "review" ? { originalCode } : {}) }, controller.signal)
          : await api("retrieve", { query }, controller.signal);
      if (activeBase.current !== startedFor) return;
      if (response.status !== "unavailable") {
        setHealth(current => current ? { ...current, reachable: true, status: "configured" } : current);
      }
      setResult(response);
      if (response.status === "unavailable") setError(response.error?.message || "AI assistance unavailable; original evidence is retained.");
    } catch (e) { if (activeBase.current === startedFor && e.name !== "AbortError") setError(e instanceof SyntaxError ? "Event must contain valid JSON." : e.message); }
    finally { if (activeBase.current === startedFor) setBusy(false); }
  }

  async function patchAction(action) {
    if (!draftContext || !result?.proposal) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${draftContext.scanId}/findings/${draftContext.findingId}/${action}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: result.proposal.code, acknowledged }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Patch request failed");
      if (action === "validate") setPatchCheck(body.data); else setPullRequest(body.data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function downloadProposal() {
    const url = URL.createObjectURL(new Blob([result.proposal.code], { type: "text/plain" }));
    const link = document.createElement("a"); link.href = url; link.download = result.proposal.format === "diff" ? "securepatch.patch" : "securepatch-proposal.txt";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="min-h-screen bg-[#101416] px-4 py-6 text-[#E8EEEB] sm:px-8 sm:py-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 text-sm">
        <Link to={demo ? "/" : "/dashboard"} aria-label="SecurePatch home" className="transition-colors hover:opacity-80">
          <BrandLockup wordmarkClassName="text-sm" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#89968F]">{demo ? "Sample-data demo" : "Organization assistant"}</span>
          <ThemeToggle />
        </div>
      </div>
      <header className="space-y-4 border-b border-white/[0.08] pb-6 pt-2">
        <p className="text-sm font-medium text-[#A8B9AF]">Security assistant · NVIDIA Nemotron</p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Evidence before action.</h1>
        <p className="max-w-2xl text-sm leading-6 text-[#AEB9B3]">Investigate supplied events, explain scanner findings, and draft defensive code with traceable sources.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs text-[#AEB9B3]">
          <span>NVIDIA: <strong className="font-medium text-[#D7DFDA]">{providerStatus}</strong></span>
          <span>Knowledge index: <strong className="font-medium text-[#D7DFDA]">{knowledge?.chunks ?? "—"} passages</strong></span>
          <span>Code execution disabled</span>
        </div>
      </header>
      <aside className="border-l-2 border-[#B99B62] bg-[#171D1F] px-4 py-3 text-sm leading-6 text-[#C8C1AE]">
        <p className="font-semibold text-[#E0D6BF]">Before sending data</p>
        <p className="mt-1">After approval, SecurePatch sends redacted evidence and up to four excerpts from the approved security index to NVIDIA for search and inference. Redaction is best effort.
        {demo && " This demo uses sample events and does not monitor network traffic."}
        {" "}Review all advice, code, and suggested tests. Nothing is executed.</p>
      </aside>
      <nav className="flex flex-wrap gap-x-5 border-b border-white/[0.1]" aria-label="Assistant workflows">
        {[["investigate", "Investigate"], ["code", "Code & review"], ["sources", "Knowledge"]].map(([id, label]) =>
          <button key={id} type="button" disabled={busy} onClick={() => { setTab(id); setResult(null); setError(""); }}
            aria-current={tab === id ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 py-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A2C7AE] ${tab === id ? "border-[#78A88B] font-semibold text-[#E8EEEB]" : "border-transparent text-[#9BA8A1] hover:text-[#E8EEEB] disabled:opacity-50"}`}>{label}</button>)}
      </nav>
      {error && <p role="alert" className="rounded-md border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
      {!demo && !organizationId && <p className="text-sm text-amber-200">Select an organization to use the assistant.</p>}
      {!demo && organizationId && policy && hostedAiBlocked && <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Hosted AI is disabled for this organization. An owner or admin can enable it in <Link className="underline" to="/settings">Workspace settings</Link>.</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <form onSubmit={run} className={`${box} space-y-4`}>
          {tab === "investigate" && <>
            <h2 className="font-semibold">Structured evidence</h2>
            {!demo && <label className="block text-sm text-[#C5CFC9]">Existing finding ID (optional)
              <input aria-label="Finding ID" className={`${field} mt-2`} value={findingId} onChange={(e) => setFindingId(e.target.value)} maxLength={24} />
            </label>}
            {findingIdFormatInvalid && tab === "investigate" && <p role="alert" className="text-xs text-rose-200">Finding ID must contain exactly 24 hexadecimal characters.</p>}
            {findingId.trim() && !demo && findingPreviewPending && !findingPreviewError && <p role="status" className="text-xs text-[#9BA8A1]">Loading sanitized finding preview…</p>}
            {findingPreviewError && tab === "investigate" && <p role="alert" className="text-xs text-rose-200">Finding preview: {findingPreviewError}</p>}
            <div className="flex gap-2">{["suspicious", "benign"].map((name) => <button key={name} type="button" disabled={!fixtures || busy}
              onClick={() => { setEventText(JSON.stringify(fixtures.events[name], null, 2)); setFindingId(""); }}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs capitalize transition-colors hover:border-white/30 hover:bg-white/[0.03] disabled:opacity-50">{name} fixture</button>)}</div>
            <label className="block text-xs text-[#9BA8A1]">Event JSON
              <textarea className={`${field} mt-2 font-mono text-xs`} aria-label="Event JSON" rows={12} maxLength={16000}
                value={eventText} onChange={(e) => { eventTextEdited.current = true; setEventText(e.target.value); }} disabled={busy || Boolean(findingId && !demo)} />
            </label>
          </>}
          {tab === "code" && <>
            <h2 className="font-semibold">Defensive code proposal</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[#9BA8A1]">Language<select className={`${field} mt-2`} value={language} onChange={(e) => changeLanguage(e.target.value)}>
              {(health?.languages || Object.keys(labels)).map((l) => <option key={l} value={l}>{labels[l] || l.toUpperCase()}</option>)}</select></label>
              <label className="text-xs text-[#9BA8A1]">Mode<select className={`${field} mt-2`} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="generate">Generate</option><option value="review">Review as diff</option></select></label>
            </div>
            <button type="button" disabled={!fixtures || busy} onClick={() => loadCode("review")} className="text-xs font-medium text-[#A8C4B1] underline underline-offset-2">Load review example</button>
            <label className="block text-xs text-[#9BA8A1]">Request<textarea aria-label="Code request" className={`${field} mt-2`} rows={8}
              value={request} onChange={(e) => { requestEdited.current = true; setRequest(e.target.value); }} required maxLength={3000} /></label>
            {mode === "review" && <label className="block text-xs text-[#9BA8A1]">Source for review<textarea aria-label="Source for review"
              className={`${field} mt-2 font-mono`} rows={7} value={originalCode} onChange={(e) => setOriginalCode(e.target.value)} required maxLength={8000} /></label>}
          </>}
          {tab === "sources" && <>
            <h2 className="font-semibold">Inspect shared knowledge</h2>
            <p className="text-xs text-[#9BA8A1]">{fixtures?.provenance}. Only operator-approved files are indexed.</p>
            <label className="block text-xs text-[#9BA8A1]">Search query<input aria-label="Knowledge query" className={`${field} mt-2`} value={query}
              onChange={(e) => setQuery(e.target.value)} maxLength={1500} required /></label>
            <ul className="space-y-2 break-all text-xs text-[#89968F]">{knowledge?.sources?.map((s) => <li key={s}>{s}</li>)}</ul>
          </>}
          <details open className="space-y-3 rounded-lg border border-white/10 bg-[#202729] p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#D7DFDA]">Review the data for this request</summary>
            <p className="text-xs leading-5 text-[#AEB9B3]">This preview shows the supplied evidence after best-effort redaction. The search text below is sent to NVIDIA embeddings to select up to four excerpts from the approved shared security index. Those excerpts are sent to NVIDIA inference and appear in the result.</p>
            <pre aria-label="Sanitized data preview" className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#101416] p-3 text-xs text-[#C5CFC9]">{previewValue === undefined ? "Finding details are not available yet." : JSON.stringify(previewValue, null, 2)}</pre>
            {embeddingQuery !== undefined && <div><p className="mb-1 text-xs font-medium text-[#9BA8A1]">Search text sent for retrieval</p><pre className="whitespace-pre-wrap break-words rounded-md bg-[#101416] p-3 text-xs text-[#C5CFC9]">{embeddingQuery}</pre></div>}
            <label className="flex items-start gap-2 text-xs leading-5 text-[#D7DFDA]"><input type="checkbox" className="mt-0.5 accent-[#78A88B]" checked={consentFor === requestFingerprint}
              disabled={busy || !health || hostedAiBlocked || findingIdFormatInvalid || findingPreviewPending || Boolean(findingPreviewError)}
              onChange={e => setConsentFor(e.target.checked ? requestFingerprint : null)} />
              <span>I approve sending the data shown above and derived search terms to NVIDIA for this request.</span></label>
          </details>
          <button className={button} disabled={busy || !base || !health || hostedAiBlocked || findingIdFormatInvalid || consentFor !== requestFingerprint || findingPreviewPending || Boolean(findingPreviewError)}>{busy ? "Waiting for NVIDIA…" : tab === "investigate" ? "Analyze evidence" : tab === "code" ? "Draft proposal" : "Retrieve sources"}</button>
          <p className="text-xs leading-5 text-[#89968F]">{busy ? "The request may retry on a temporary provider failure." : "Nothing is applied, executed, blocked or deployed."}</p>
        </form>
        <section className={`${box} min-h-[20rem] space-y-6`} aria-live="polite" aria-label="Assistant result">
          {!result && <div className="flex min-h-[18rem] flex-col justify-center border-l-2 border-white/10 pl-5"><p className="text-base font-semibold text-[#D7DFDA]">Your review will appear here.</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#89968F]">Submit evidence or a request to see its sources, limitations, and suggested next steps.</p></div>}
          {result?.original && <details open className="space-y-3"><summary className="font-semibold cursor-pointer">Original evidence · {result.kind}</summary>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-[#101416] p-3 text-xs text-[#C5CFC9]">{JSON.stringify(result.original, null, 2)}</pre>
            {result.detector && <p className="text-xs text-amber-200">Scanner verdict retained: {result.detector.severity}; risk {result.detector.riskScore} (not a probability).</p>}</details>}
          {result?.analysis && <><div><p className="text-xs text-amber-200 mb-2">Advisory severity: {result.analysis.severity_assessment}</p>
            <p className="text-sm leading-6 text-[#D7DFDA]">{result.analysis.summary}</p></div>
            {["observed_evidence", "possible_interpretations", "recommended_actions", "false_positive_checks", "missing_information", "limitations"].map((key) =>
              <TextList key={key} title={key.replaceAll("_", " ")} items={result.analysis[key]} />)}
          </>}
          {result?.proposal && <>
            <p className="text-sm leading-6 text-[#C5CFC9]">{result.proposal.explanation}</p>
            <p className="text-xs text-[#A8C4B1]">{labels[result.language]} · {result.proposal.format} · Syntax: {result.validation?.status} · Tests: not executed</p>
            {result.validation?.message && <p className="text-xs text-amber-200">{result.validation.message}</p>}
            <pre className="max-h-[32rem] overflow-auto rounded-md bg-[#101416] p-4 text-xs leading-5 text-[#D7DFDA]"><code>{result.proposal.code}</code></pre>
            <div className="flex gap-4"><button className="text-sm font-medium text-[#A8C4B1] underline underline-offset-2" onClick={downloadProposal}>Download proposal</button>
              <button className="text-sm font-medium text-[#A8C4B1] underline underline-offset-2" onClick={() => navigator.clipboard.writeText(result.proposal.code).catch(() => setError("Clipboard unavailable. Download the proposal instead."))}>Copy proposal</button></div>
            {draftContext && result.proposal.format === "diff" && <div className="space-y-3 rounded-lg border border-white/15 p-4 text-sm">
              <p className="break-all text-[#9BA8A1]">Target: {draftContext.filePath} at {draftContext.commitSha.slice(0, 7)}</p>
              <button disabled={busy} className="font-medium text-[#A8C4B1] underline underline-offset-2" onClick={() => patchAction("validate")}>Check patch against scanned source</button>
              {patchCheck && <p className="text-amber-200">Patch applies. Syntax: {patchCheck.syntax.status}. Tests were not executed.</p>}
              <label className="block text-[#C5CFC9]"><input type="checkbox" className="mr-2 accent-[#78A88B]" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /> I reviewed this patch and understand that tests were not executed.</label>
              <button disabled={busy || !acknowledged || !patchCheck || Boolean(pullRequest) || !canCreatePullRequest} className={`${button} text-xs`} onClick={() => patchAction("pull-request")}>Create draft pull request</button>
              <p className="text-xs leading-5 text-[#9BA8A1]">Owner/admin role and approved GitHub App write permissions required. The default branch must still match the scanned commit.</p>
              {pullRequest && <a target="_blank" rel="noreferrer" href={pullRequest.url} className="block font-medium text-[#A8C4B1] underline underline-offset-2">Open draft pull request #{pullRequest.number}</a>}
            </div>}
            {["assumptions", "dependencies", "security_considerations", "validation_instructions", "tests"].map((key) =>
              <TextList key={key} title={key === "tests" ? "Suggested tests · unexecuted" : key.replaceAll("_", " ")} items={result.proposal[key]} />)}
          </>}
          {result && <Sources sources={result.sources || result.retrieved_sources} />}
          <TextList title="Application limitations" items={result?.limitations} />
          {result?.requestId && <p className="break-all font-mono text-[10px] text-[#78857E]">Request {result.requestId}</p>}
        </section>
      </div>
    </div>
  </main>;
}
