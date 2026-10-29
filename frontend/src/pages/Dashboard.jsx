import React, { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  GitBranch,
  GitPullRequest,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Terminal,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { ScanStatusBadge } from "../components/ui/ScanStatusBadge";

const RISK_LEVELS = [
  { key: "critical", label: "Critical", color: "text-severity-critical", bar: "bg-severity-critical", border: "border-severity-critical/30" },
  { key: "high", label: "High", color: "text-severity-high", bar: "bg-severity-high", border: "border-severity-high/30" },
  { key: "medium", label: "Medium", color: "text-severity-medium", bar: "bg-severity-medium", border: "border-severity-medium/30" },
  { key: "low", label: "Low", color: "text-severity-low", bar: "bg-severity-low", border: "border-severity-low/30" },
];

export default function Dashboard() {
  const { user, selectedOrg, loading: contextLoading = false } = useOutletContext();
  const organizationId = selectedOrg?._id || selectedOrg?.id || selectedOrg?.organization?._id || selectedOrg?.organization?.id;
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadOverview = useCallback(async (signal, refresh = false) => {
    if (!organizationId) {
      setOverview(null);
      setLoading(false);
      setError(null);
      return;
    }

    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/organizations/${encodeURIComponent(organizationId)}`,
        { credentials: "include", signal }
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message || body.message || "Unable to load organization overview.");
      }
      setOverview(body.data);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "Unable to load organization overview.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [organizationId]);

  useEffect(() => {
    if (contextLoading) return undefined;
    const controller = new AbortController();
    loadOverview(controller.signal);
    return () => controller.abort();
  }, [contextLoading, loadOverview]);

  const displayName = user?.name || user?.displayName || user?.email?.split("@")[0] || "Developer";
  const refresh = () => loadOverview(undefined, true);

  const hasRepositories = (overview?.repositories?.total ?? 0) > 0;

  return (
    <main className="app-page">
      {/* Page Header (No repeated eyebrow labels, clean typography) */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {selectedOrg?.name || `Welcome back, ${displayName}.`}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Continuous vulnerability analysis, risk triage, and agentic remediation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={refresh}
            disabled={contextLoading || !organizationId || refreshing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle bg-bg-card px-3.5 py-2 text-sm font-medium text-text-secondary transition hover:text-text-primary hover:border-text-secondary/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-severity-critical/30 bg-severity-critical/[0.06] p-6 mb-8">
          <div className="flex items-start gap-3.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-severity-critical" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-severity-critical">Unable to load the security overview</h2>
              <p className="mt-1 text-sm text-text-secondary">{error}</p>
              <button onClick={refresh} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-text-primary hover:underline">
                Retry <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading || contextLoading ? (
        <DashboardSkeleton />
      ) : overview && !hasRepositories ? (
        /* Empty / First-Run State: Connect a repository with 3 short numbered steps */
        <section aria-label="Connect repository onboarding" className="rounded-xl border border-border-subtle bg-bg-card p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent border border-accent/20 mb-6">
            <GitBranch className="h-7 w-7" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
            Connect a repository
          </h2>
          <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
            Authorize your GitHub repository to enable continuous vulnerability detection, automated risk triage, and agentic patch remediation.
          </p>

          <div className="mt-8 text-left grid grid-cols-1 gap-3.5 max-w-md mx-auto">
            <div className="flex items-start gap-3.5 p-4 rounded-lg border border-border-subtle bg-bg-primary">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white font-mono text-xs font-bold">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Install GitHub App</p>
                <p className="text-xs text-text-secondary mt-0.5">Authorize AVPR-Net with repository read and pull-request permissions.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-lg border border-border-subtle bg-bg-primary">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white font-mono text-xs font-bold">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Select Repositories</p>
                <p className="text-xs text-text-secondary mt-0.5">Choose which repositories AVPR-Net should index and monitor.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-lg border border-border-subtle bg-bg-primary">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white font-mono text-xs font-bold">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Run Baseline Scan</p>
                <p className="text-xs text-text-secondary mt-0.5">Run security engines to establish an initial vulnerability baseline.</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link
              to="/github"
              data-tour="add-repo-btn"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 transition cursor-pointer"
            >
              Connect a repository
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : overview && hasRepositories ? (
        <>
          {/* Stat Cards (Hide cards without a real data source) */}
          <section aria-label="Security overview metrics" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Open Findings */}
            <MetricCard
              label="Open findings"
              value={overview.totals?.currentFindings ?? overview.totals?.findings ?? 0}
              detail="Unresolved findings in latest full scans"
              icon={ShieldAlert}
            />

            {/* Card 2: Critical / High */}
            <MetricCard
              label="Critical/High"
              value={overview.totals?.currentCriticalAndHigh ?? 0}
              detail="Urgent vulnerabilities requiring immediate triage"
              icon={Siren}
              severityBadge={
                (overview.totals?.currentCriticalAndHigh ?? 0) > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-severity-critical/10 text-severity-critical border border-severity-critical/20">
                    Action required
                  </span>
                ) : null
              }
            />

            {/* Card 3: Patches Verified (Only show if data exists) */}
            {overview.totals?.patchesVerified != null && (
              <MetricCard
                label="Patches verified"
                value={overview.totals.patchesVerified}
                detail="Passed all automated verification gates"
                icon={ShieldCheck}
              />
            )}

            {/* Card 4: Draft PRs Opened (Only show if data exists) */}
            {(overview.totals?.draftPRsOpened != null || overview.totals?.draftPRs != null) && (
              <MetricCard
                label="Draft PRs opened"
                value={overview.totals?.draftPRsOpened ?? overview.totals?.draftPRs}
                detail="Remediation pull requests submitted"
                icon={GitPullRequest}
              />
            )}
          </section>

          {/* Main 2-Column Analytics: Severity Breakdown & Scanner Activity */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 mb-8">
            {/* Severity Breakdown Card */}
            <section className="rounded-xl border border-border-subtle bg-bg-card p-6 shadow-sm xl:col-span-7">
              <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-5">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Severity Breakdown</h2>
                  <p className="text-xs text-text-secondary mt-0.5">Distribution across all recorded findings</p>
                </div>
              </div>

              {(overview.totals?.findings ?? 0) === 0 ? (
                <div className="py-8 text-center text-sm text-text-muted">
                  No findings recorded yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {RISK_LEVELS.map((level) => {
                    const count = overview.riskDistribution?.[level.key] || 0;
                    const total = overview.totals.findings || 1;
                    const percent = ((count / total) * 100).toFixed(0);
                    return (
                      <div key={level.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className={`font-semibold ${level.color}`}>{level.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-text-primary">{count}</span>
                            <span className="text-xs text-text-muted">({percent}%)</span>
                          </div>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-border-subtle" aria-label={`${level.label}: ${count}`}>
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${level.bar}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Scanner Activity */}
            <section className="rounded-xl border border-border-subtle bg-bg-card p-6 shadow-sm xl:col-span-5">
              <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-4">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-text-muted" />
                  <h2 className="text-base font-semibold text-text-primary">Scanner Activity</h2>
                </div>
              </div>

              {Object.keys(overview.scannerStatus || {}).length === 0 ? (
                <p className="py-6 text-sm text-text-muted">No scanner execution status recorded yet.</p>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {Object.entries(overview.scannerStatus).map(([scanner, info]) => (
                    <div key={scanner} className="flex items-center justify-between gap-3 py-3">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">{scanner}</span>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${info.status === "completed" ? "text-severity-success" : "text-severity-critical"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${info.status === "completed" ? "bg-severity-success" : "bg-severity-critical"}`} />
                        {info.status === "completed" ? "Healthy" : "Failed"}
                        <span className="text-text-muted font-normal">· {formatDate(info.scanAt)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Recent Findings Table */}
          <section className="rounded-xl border border-border-subtle bg-bg-card overflow-hidden shadow-sm mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Recent Findings</h2>
                <p className="text-xs text-text-secondary mt-0.5">High-priority security findings from latest scans</p>
              </div>
              <Link to="/findings" className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1">
                View all findings <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {(!overview.priorityFindings || overview.priorityFindings.length === 0) ? (
              <div className="p-8 text-center text-sm text-text-muted">
                No active findings to prioritize. All current scans are clean.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-primary/50 text-xs font-semibold text-text-secondary border-b border-border-subtle">
                    <tr>
                      <th scope="col" className="px-6 py-3">Finding</th>
                      <th scope="col" className="px-6 py-3">Severity</th>
                      <th scope="col" className="px-6 py-3">Repository</th>
                      <th scope="col" className="px-6 py-3">Location</th>
                      <th scope="col" className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {overview.priorityFindings.map((finding) => (
                      <tr key={finding._id} className="hover:bg-white/[0.02] transition">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-text-primary line-clamp-1">{finding.title}</p>
                          {finding.cwe && (
                            <span className="font-mono text-xs text-text-muted mt-0.5 block">{finding.cwe}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <RiskBadge category={finding.riskCategory} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-text-secondary">
                          {finding.owner}/{finding.repo}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-text-muted truncate max-w-[200px]">
                          {finding.filePath}{finding.startLine ? `:${finding.startLine}` : ""}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Link
                            to={`/github/${encodeURIComponent(finding.owner)}/${encodeURIComponent(finding.repo)}/scan?scanId=${encodeURIComponent(finding.scan)}`}
                            className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1"
                          >
                            Inspect <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Quick Action Link to Repositories */}
          <div className="flex items-center gap-3">
            <Link
              to="/github"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 transition"
            >
              View Repositories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value, detail, icon: Icon, severityBadge }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-5 sm:p-6 shadow-sm transition">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-text-primary">{value}</p>
          <p className="mt-1.5 text-xs text-text-muted line-clamp-1">{detail}</p>
          {severityBadge && <div className="mt-2">{severityBadge}</div>}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-primary text-text-secondary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function RiskBadge({ category }) {
  const item = RISK_LEVELS.find(({ key }) => key === category?.toLowerCase());
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${item ? `${item.color} ${item.border} bg-white/[0.02]` : "border-border-subtle text-text-muted"}`}>
      {item?.label || "Unknown"}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Loading dashboard" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-xl border border-border-subtle bg-bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="h-72 animate-pulse rounded-xl border border-border-subtle bg-bg-card" />
        ))}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(durationMs) {
  const seconds = Math.round(durationMs / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
