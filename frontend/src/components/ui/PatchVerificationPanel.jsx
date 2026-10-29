import React from "react";
import { CheckCircle2, XCircle, Loader2, MinusCircle, AlertTriangle, ShieldCheck } from "lucide-react";

/**
 * Verification Gates Panel for Remediation Flow
 * Displays 4 verification gates as a vertical list of rows:
 * 1. Patch integrity
 * 2. Syntax check
 * 3. Security rescan
 * 4. Tests
 *
 * Each row has an icon (pass/fail/pending/not_run), a short label, and a one-line result.
 * Status badge for the whole patch: Verified, Failed, or Needs review.
 */
export default function PatchVerificationPanel({
  status, // "verified" | "failed" | "needs_review"
  gates = {}, // { integrity: { status, result }, syntax: { status, result }, rescan: { status, result }, tests: { status, result } }
  className = "",
}) {
  // Normalize gate definitions
  const gateItems = [
    {
      key: "integrity",
      label: "Patch integrity",
      status: gates.integrity?.status || "not_run",
      result: gates.integrity?.result || "Not run",
    },
    {
      key: "syntax",
      label: "Syntax check",
      status: gates.syntax?.status || "not_run",
      result: gates.syntax?.result || "Not run",
    },
    {
      key: "rescan",
      label: "Security rescan",
      status: gates.rescan?.status || "not_run",
      result: gates.rescan?.result || "Not run",
    },
    {
      key: "tests",
      label: "Tests",
      status: gates.tests?.status || "not_run",
      result: gates.tests?.result || "Not run",
    },
  ];

  // Derive overall status if not explicitly provided
  const derivedStatus = status || (() => {
    const hasFail = gateItems.some((g) => g.status === "failed");
    if (hasFail) return "failed";
    const rescanPass = gateItems.find((g) => g.key === "rescan")?.status === "passed";
    const integrityPass = gateItems.find((g) => g.key === "integrity")?.status === "passed";
    if (rescanPass && integrityPass) return "verified";
    return "needs_review";
  })();

  const badgeConfig = {
    verified: {
      label: "Verified",
      className: "bg-severity-success/10 text-severity-success border-severity-success/30",
      icon: CheckCircle2,
    },
    failed: {
      label: "Failed",
      className: "bg-severity-critical/10 text-severity-critical border-severity-critical/30",
      icon: XCircle,
    },
    needs_review: {
      label: "Needs review",
      className: "bg-severity-medium/10 text-severity-medium border-severity-medium/30",
      icon: AlertTriangle,
    },
  }[derivedStatus] || {
    label: "Needs review",
    className: "bg-severity-medium/10 text-severity-medium border-severity-medium/30",
    icon: AlertTriangle,
  };

  const StatusBadgeIcon = badgeConfig.icon;

  return (
    <section
      aria-label="Patch verification gates"
      className={`rounded-xl border border-border-subtle bg-bg-card p-5 ${className}`}
    >
      {/* Header with Title and Overall Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Verification Gates
          </h3>
          <p className="mt-0.5 text-sm text-text-secondary">
            Continuous automated validation checks before applying remediation.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeConfig.className}`}
          role="status"
        >
          <StatusBadgeIcon className="h-3.5 w-3.5" />
          {badgeConfig.label}
        </span>
      </div>

      {/* Vertical list of rows, one per gate */}
      <ul className="divide-y divide-border-subtle">
        {gateItems.map((gate) => {
          const isPassed = gate.status === "passed";
          const isFailed = gate.status === "failed";
          const isPending = gate.status === "pending" || gate.status === "running";
          const isNotRun = !isPassed && !isFailed && !isPending;

          return (
            <li
              key={gate.key}
              className="py-3.5 first:pt-4 last:pb-1 flex items-start justify-between gap-4 text-sm"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {isPassed && (
                    <CheckCircle2 className="h-4 w-4 text-severity-success" aria-label="Passed" />
                  )}
                  {isFailed && (
                    <XCircle className="h-4 w-4 text-severity-critical" aria-label="Failed" />
                  )}
                  {isPending && (
                    <Loader2 className="h-4 w-4 text-accent-security animate-spin" aria-label="Running" />
                  )}
                  {isNotRun && (
                    <MinusCircle className="h-4 w-4 text-text-muted" aria-label="Not run" />
                  )}
                </div>

                <div className="min-w-0">
                  <span className="font-semibold text-text-primary block">
                    {gate.label}
                  </span>
                  <span className="text-sm text-text-secondary block mt-0.5 break-words">
                    {isNotRun ? "Not run" : gate.result}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    isPassed
                      ? "text-severity-success bg-severity-success/10"
                      : isFailed
                      ? "text-severity-critical bg-severity-critical/10"
                      : isPending
                      ? "text-accent-security bg-accent-security/10"
                      : "text-text-muted bg-text-primary/[0.04]"
                  }`}
                >
                  {isPassed
                    ? "Pass"
                    : isFailed
                    ? "Fail"
                    : isPending
                    ? "Running"
                    : "Not run"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
