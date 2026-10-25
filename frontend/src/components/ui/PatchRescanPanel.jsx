import React, { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../../config/api";

const errors = {
  RESCAN_COVERAGE_INCOMPLETE: "A required scanner failed or was unavailable. This result cannot verify the patch.",
  RESCAN_COVERAGE_CHANGED: "Scanner versions or covered files changed between scans. Retry with stable coverage.",
  RESCAN_SOURCE_MISMATCH: "The source no longer matches this proposal. Reload the finding and generate a fresh patch.",
  RESCAN_POLICY_CHANGED: "The scanner policy changed. Start a new rescan.",
  RESCAN_DEADLINE_EXCEEDED: "No worker completed this rescan before its deadline. Check the worker, then retry.",
  RESCAN_SYNTAX_FAILED: "The proposed code failed syntax validation.",
  RESCAN_SUPPRESSION_ADDED: "The patch adds a scanner suppression instead of demonstrating a fix. Revise the proposal.",
  RESCAN_REMEDIATION_PARSER_INCOMPLETE: "This patch removed the alert but did not use the safe XML parser and handle its errors correctly. No PR can be created from it. Add the correct imports and error handling, then generate a complete fix.",
  RESCAN_REMEDIATION_DEPENDENCY_MISSING: "This patch uses defusedxml, but the project does not declare it as a direct dependency. No PR can be created from it. Add the dependency and rescan.",
};
export default function PatchRescanPanel({ context, patch, onVerified, onFeedback, autoStart = false }) {
  const [job, setJob] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const active = useRef(true), pending = useRef(null);
  const base = `${API_BASE_URL}/scans/${context.scanId}/findings/${context.findingId}/rescans`;
  const running = job && ["queued", "running"].includes(job.status);
  useEffect(() => { active.current = true; return () => { active.current = false; pending.current?.abort(); }; }, []);
  async function request(url, body) {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", credentials: "include", signal: controller.signal,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || "Could not check the patch rescan.");
    if (active.current && !controller.signal.aborted && pending.current === controller) {
      setJob(payload.data.job);
      onVerified(payload.data.job.status === "completed" && payload.data.job.result?.status === "passed" ? payload.data.job.id : null);
      setError("");
    }
  }
  async function act(action) {
    setBusy(true); setError("");
    try { await request(action === "start" ? base : `${base}/${job.id}${action === "cancel" ? "/cancel" : ""}`,
      action === "start" ? { patch } : action === "cancel" ? {} : undefined); }
    catch (e) { if (active.current && e.name !== "AbortError") setError(e.message); }
    finally { if (active.current) setBusy(false); }
  }
  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(() => act("start"), 0);
    return () => clearTimeout(timer);
  }, [autoStart]);
  useEffect(() => {
    if (!running || error || busy) return;
    const timer = setTimeout(() => act("refresh"), 3000);
    return () => clearTimeout(timer);
  }, [job, error, busy]);
  const result = job?.result;
  const outcome = result?.outcome === "baseline_not_reproduced" ? "The original scanner alert could not be reproduced. No fix was confirmed."
    : result?.outcome === "target_alert_remains" ? `${result.remainingTargetAlerts} matching alerts remain in the target file. Revise the patch.`
    : result?.outcome === "new_alerts_detected" ? `${result.introducedAlerts} new scanner alerts were detected. Review the change.`
    : result?.status === "passed" ? "The original alert was reproduced before the patch, is absent afterward, and no increase in rule/path alert counts was found."
    : null;
  return <section aria-label="Patch security rescan" className="space-y-3 rounded-md border border-text-primary/10 bg-bg-secondary p-4">
    <div><h3 className="text-sm font-semibold text-text-primary">Check the proposed fix</h3>
      <p className="mt-1 text-xs leading-5 text-text-muted">Rescan the pinned source before and after this patch in a temporary worker workspace. Your GitHub files stay unchanged. Project tests are not run.</p></div>
    {!running && <button type="button" disabled={busy} onClick={() => act("start")} className="text-sm font-medium text-accent-security underline underline-offset-2 disabled:opacity-50">{busy ? "Starting rescan…" : job ? "Check this patch again" : "Rescan proposed fix"}</button>}
    {running && <div className="space-y-2"><p role="status" className="text-sm text-text-secondary">{job.status === "queued" ? "Queued — waiting for the scan worker." : "Running baseline and patched security scans…"}</p>
      <div className="flex gap-4 text-xs"><button type="button" disabled={busy} onClick={() => act("refresh")} className="underline">Refresh rescan</button><button type="button" disabled={busy} onClick={() => act("cancel")} className="underline">Cancel rescan</button></div></div>}
    {job?.status === "completed" && <div role="status" className="space-y-2 text-sm text-text-secondary"><p className={result?.status === "passed" ? "font-medium text-severity-low" : "font-medium text-severity-medium"}>{result?.status === "passed" ? "Static checks passed — tests not run" : "Patch needs further review"}</p><p>{outcome}</p><p className="text-xs text-text-muted">{result?.limitation}</p><p className="text-xs text-text-muted">Commit {job.commitSha?.slice(0, 7)} · patch {job.patchHash?.slice(0, 12)}</p></div>}
    {job?.status === "completed" && result?.status === "failed" && onFeedback && <button type="button" className="text-sm font-medium text-accent-security underline underline-offset-2" onClick={() => onFeedback(result.outcome === "target_alert_remains"
      ? "The previous proposed patch still triggered the original scanner rule in the target file. Follow the rule's safer API guidance without suppressing checks, deleting behavior or hiding the original operation."
      : result.outcome === "new_alerts_detected" ? "The previous proposal introduced additional scanner alerts. Fix the original finding without adding other risky patterns or suppressing checks."
      : "The original finding could not be reproduced in the verification baseline. Reassess the original evidence before claiming a fix; do not invent a passing result.")}>Revise with scanner feedback</button>}
    {job?.status === "failed" && <p role="status" className="text-sm text-severity-medium">{errors[job.errorCode] || "The rescan could not finish. No fix was confirmed. Check the worker and retry."}</p>}
    {job?.status === "cancelled" && <p role="status" className="text-sm text-text-muted">Rescan cancelled. No fix was confirmed.</p>}
    {error && <div role="alert" className="text-sm text-severity-medium">{error}{running && <button type="button" className="ml-3 underline" onClick={() => act("refresh")}>Retry rescan status</button>}</div>}
  </section>;
}
