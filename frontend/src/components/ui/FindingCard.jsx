import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCode,
  ShieldAlert,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { RiskScoreBar } from "./RiskScoreBar";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";
import { supportsFindingRemediation } from "../../utils/remediationSupport";

export function findingGuidance(finding) {
  const scanner = String(finding.scanner || "").toLowerCase();
  if (scanner === "secrets") return {
    risk: "A credential-like value was found in source. If it is active, anyone who can access the repository or its history may be able to use it.",
    next: "Check whether the value is real. If it is, revoke or rotate it first, then move the replacement into a secret manager and remove the exposed value from repository history where practical.",
  };
  if (scanner === "dependency" || scanner === "trivy") return {
    risk: "A package or artifact matched known vulnerability data. Actual impact depends on the affected version and whether the vulnerable component is used in a reachable part of the application.",
    next: "Open the advisory, confirm the installed version and affected range, then upgrade to a fixed version and run the relevant tests.",
  };
  if (scanner === "bandit" || scanner === "semgrep") return {
    risk: "Static analysis matched a security rule in this code. The real impact depends on whether this code runs and whether an attacker can control the relevant input.",
    next: "Review the cited lines and the data flowing into them. Confirm whether the risky path is reachable, then fix the cause or document why the rule does not apply and add a regression test where useful.",
  };
  return {
    risk: "An automated scanner reported a pattern that may be security-sensitive. This is evidence to review, not proof that the application is exploitable.",
    next: "Inspect the cited source and scanner rule, validate the behavior in context, then record whether the issue is confirmed, dismissed, or fixed.",
  };
}

const reviewLabels = {
  open: "Needs human review",
  acknowledged: "Confirmed by reviewer",
  dismissed: "Dismissed after review",
  resolved: "Resolved by review",
};

export function FindingCard({ finding, organizationId, commitSha, onReviewed }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewStatus, setReviewStatus] = useState(finding.status || "open");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => setReviewStatus(finding.status || "open"), [finding.status]);
  async function saveReview(event) {
    event.preventDefault(); setSaving(true); setError(""); setSaved("");
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${finding.scan}/findings/${finding._id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewStatus, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Review failed");
      setReviewStatus(body.data?.status || reviewStatus);
      setReason("");
      setSaved("Review decision saved with its reason and timestamp.");
      onReviewed?.();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  const severityBadges = {
    critical: "bg-severity-critical/10 text-severity-critical border-severity-critical/20",
    high: "bg-severity-high/10 text-severity-high border-severity-high/20",
    medium: "bg-severity-medium/10 text-severity-medium border-severity-medium/20",
    low: "bg-accent-security/10 text-accent-security border-accent-security/20",
    info: "bg-severity-info/10 text-severity-info border-severity-info/20",
  };

  const badgeClass =
    severityBadges[finding.severity?.toLowerCase()] ||
    "bg-text-primary/[0.05] text-text-muted border-text-primary/[0.1]";
  const riskCategoryClass =
    severityBadges[finding.riskCategory?.toLowerCase()] ||
    "bg-text-primary/[0.05] text-text-muted border-text-primary/[0.1]";
  const guidance = findingGuidance(finding);
  const humanReviewState = finding.status === "acknowledged"
    ? "Human reviewed · confirmed"
    : finding.status === "dismissed"
      ? "Human reviewed · dismissed"
      : finding.status === "resolved"
        ? "Human reviewed · resolved"
        : "Automated signal · not yet verified by a person";

  const effectiveOrgId = organizationId || (typeof finding.organization === "object" ? finding.organization?._id : finding.organization);
  const scanner = String(finding?.scanner || "").toLowerCase();
  const remediationTitle = !supportsFindingRemediation(finding)
    ? scanner === "secrets"
      ? "Credential exposed in source. Rotate the key and remove it from repository history."
      : ["dependency", "trivy"].includes(scanner)
        ? "Vulnerable package. Upgrade the dependency version in your package manifest."
        : "This finding needs a coordinated or manual remediation path."
    : !effectiveOrgId
      ? "Select a workspace to draft an automated fix."
      : "This finding needs a coordinated or manual remediation path.";

  return (
    <div className="rounded-xl border border-text-primary/[0.08] bg-bg-secondary overflow-hidden transition hover:border-text-primary/[0.16]">
      {/* Header Row */}
      <div
        className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
      >
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 p-2 rounded-lg bg-bg-elevated border border-text-primary/[0.08] text-severity-critical">
            <ShieldAlert className="w-4 h-4" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold border ${badgeClass}`}
                title={`Scanner severity: ${finding.severity}`}
              >
                Severity: {finding.severity}
              </span>

              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold border ${riskCategoryClass}`}
                title="AVPR-Net calculated risk category"
              >
                Risk: {finding.riskCategory}
              </span>

              {finding.cwe && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono text-text-muted bg-text-primary/[0.04] border border-text-primary/[0.06]">
                  {finding.cwe}
                </span>
              )}

              <span className="px-2 py-0.5 rounded text-[11px] font-mono text-text-muted bg-text-primary/[0.04] border border-text-primary/[0.06]">
                {finding.scanner}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-text-primary tracking-tight">
              {finding.title}
            </h3>
            {finding._id && <Link to={`/assistant?findingId=${encodeURIComponent(finding._id)}&org=${encodeURIComponent(effectiveOrgId || "")}`}
              onClick={(event) => event.stopPropagation()} className="text-xs font-medium text-accent-security hover:underline underline-offset-2">Explain with Nemotron →</Link>}
            {effectiveOrgId && finding._id && supportsFindingRemediation(finding)
              ? <Link to={`/assistant?findingId=${encodeURIComponent(finding._id)}&org=${encodeURIComponent(effectiveOrgId)}&mode=review`}
                onClick={event => event.stopPropagation()} className="ml-3 text-xs font-medium text-accent-security hover:underline underline-offset-2">Draft a fix →</Link>
              : <span className="ml-3 text-xs text-text-muted" title={remediationTitle}>Manual remediation</span>}
            <span className="ml-3 text-xs text-text-muted">{reviewLabels[finding.status || "open"] || "Needs human review"}</span>

            <div className="mt-1 flex items-center gap-2 text-xs font-mono text-text-muted">
              <FileCode className="w-3.5 h-3.5 text-text-muted" />
              <span>
                {finding.filePath}
                {finding.startLine ? `:${finding.startLine}` : ""}
              </span>
            </div>
            {finding.ruleId && <p className="mt-1 break-all font-mono-code text-[11px] text-text-muted">Rule: {finding.ruleId}</p>}
          </div>
        </div>

        {/* Risk Score and Accordion Toggle */}
        <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-text-primary/[0.06]">
          <div className="flex flex-col items-start md:items-end">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-1">
              Risk Score
            </span>
            <RiskScoreBar
              score={finding.riskScore}
              category={finding.riskCategory}
            />
          </div>

          <button
            aria-label={expanded ? "Collapse finding" : "Expand finding"} aria-expanded={expanded}
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-text-primary/[0.04] border border-text-primary/[0.06] text-text-muted hover:text-text-primary"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-5 pt-2 sm:px-5 border-t border-text-primary/[0.06] bg-bg-primary/60 space-y-4">
          <section className="rounded-lg border border-accent-security/15 bg-accent-security/[0.04] p-4" aria-label="Finding interpretation">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-text-primary">Why this matters</h4>
              <span className="rounded-full border border-text-primary/10 px-2 py-1 text-[11px] text-text-secondary">{humanReviewState}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{guidance.risk}</p>
            <h5 className="mt-4 text-xs font-semibold text-accent-security">Suggested next step</h5>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{guidance.next}</p>
            <p className="mt-3 text-[11px] leading-5 text-text-muted">AVPR-Net risk score ({finding.riskScore}/10) helps prioritize review; it is not a probability of exploitation. Verify the source and rule before treating this as confirmed.</p>
          </section>
          {finding.remediationGuidance?.source === "deterministic" && Array.isArray(finding.remediationGuidance.steps) && <section className="rounded-lg border border-sky-400/15 bg-sky-400/[0.03] p-4" aria-label="Rule-based remediation guidance">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium text-text-primary">{finding.remediationGuidance.title}</h4><span className="rounded-full border border-sky-300/20 px-2 py-1 text-[11px] text-sky-200">Rule-based · {finding.remediationGuidance.version}</span></div>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{finding.remediationGuidance.summary}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-text-secondary">{finding.remediationGuidance.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
            <p className="mt-3 text-[11px] text-text-muted">This guidance is a fixed AVPR-Net rule result. It is separate from any AI-generated proposal and still needs review in your code context.</p>
          </section>}
          {commitSha && <a className="text-xs font-medium text-accent-security underline underline-offset-2" target="_blank" rel="noreferrer" href={`https://github.com/${finding.owner}/${finding.repo}/blob/${commitSha}/${finding.filePath.split("/").map(encodeURIComponent).join("/")}#L${finding.startLine}`}>View exact scanned source</a>}
          {organizationId && <form onSubmit={saveReview} className="space-y-2">
            <label className="block text-xs text-text-secondary">Record your decision<select aria-label="Review status" value={reviewStatus} onChange={e => setReviewStatus(e.target.value)} className="ml-2 bg-bg-subtle p-2 rounded">{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{value === "open" ? "Open — needs review" : value === "acknowledged" ? "Confirm / acknowledge" : value === "dismissed" ? "Dismiss after review" : "Resolved"}</option>)}</select></label>
            <p className="text-xs text-text-muted">Acknowledged means a person reviewed and confirmed the finding for follow-up. Dismissed records why it is not actionable. A persisting issue marked resolved reopens on the next scan.</p>
            <label className="block text-xs text-text-secondary">Reason<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="block mt-2 w-full bg-bg-primary border border-text-primary/15 p-2 rounded" /></label>
            <button disabled={saving || !reason.trim()} className="text-xs font-medium text-accent-security underline underline-offset-2">{saving ? "Saving…" : "Save decision"}</button>
            {saved && <p role="status" className="text-xs text-severity-low">{saved}</p>}
            {finding.reviewHistory?.length > 0 && <details className="pt-2"><summary className="cursor-pointer text-xs text-text-secondary">Review history ({finding.reviewHistory.length})</summary><ol className="mt-2 space-y-2 border-l border-text-primary/10 pl-3">{[...finding.reviewHistory].reverse().map((entry, index) => <li key={`${entry.reviewedAt || index}-${index}`} className="text-xs text-text-muted"><span className="font-medium text-text-primary">{reviewLabels[entry.status] || entry.status}</span><span> · {entry.reviewedBy?.name || "Workspace member"} · {entry.reviewedAt ? new Date(entry.reviewedAt).toLocaleString() : "time unavailable"}</span><p className="mt-1 whitespace-pre-wrap">{entry.reason}</p></li>)}</ol></details>}
            {!finding.reviewHistory?.length && finding.statusReason && <p className="text-xs text-text-muted">Previous review: {finding.statusReason}{finding.reviewedAt ? ` · ${new Date(finding.reviewedAt).toLocaleString()}` : ""}</p>}
            {error && <p role="alert" className="text-xs text-severity-critical">{error}</p>}
          </form>}
          {/* Description */}
          {finding.description && (
            <div>
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-1">
                Description
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                {finding.description}
              </p>
            </div>
          )}

          {/* Code Snippet */}
          {finding.evidenceSnippet && (
            <div>
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-accent-security" />
                Vulnerable Code Evidence
              </h4>
              <div className="p-3 rounded-lg bg-bg-primary border border-text-primary/[0.08] overflow-x-auto font-mono text-xs text-text-primary">
                <pre>{finding.evidenceSnippet}</pre>
              </div>
            </div>
          )}

          {/* Risk Factors Breakdown */}
          {finding.riskFactors && (
            <div className="p-3 rounded-lg bg-bg-elevated border border-text-primary/[0.06]">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-2">
                Deterministic Risk Factors
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[11px] text-text-muted block">Severity</span>
                  <span className="font-semibold text-text-primary">
                    {finding.riskFactors.severity} / 10
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-text-muted block">Exploitability</span>
                  <span className="font-semibold text-text-primary">
                    {finding.riskFactors.exploitability} / 10
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-text-muted block">Occurrence</span>
                  <span className="font-semibold text-text-primary">
                    {finding.riskFactors.occurrence} / 10
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-text-muted block">Business Impact</span>
                  <span className="font-semibold text-text-primary">
                    {finding.riskFactors.businessImpact} / 10
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Remediation Guidance */}
          {finding.remediation && (
            <div>
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-accent-security mb-1">
                Suggested remediation · review before applying
              </h4>
              <a
                href={/^https:\/\//.test(finding.remediation) ? finding.remediation : undefined}
                className="text-xs text-text-secondary leading-relaxed hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {finding.remediation}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
