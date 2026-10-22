import React, { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Clock3,
  FolderGit2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { ScanStatusBadge } from "../components/ui/ScanStatusBadge";

const RISK_LEVELS = [
  { key: "critical", label: "Critical", color: "text-severity-critical", bar: "bg-severity-critical", border: "border-severity-critical/15" },
  { key: "high", label: "High", color: "text-severity-high", bar: "bg-severity-high", border: "border-severity-high/15" },
  { key: "medium", label: "Medium", color: "text-severity-medium", bar: "bg-severity-medium", border: "border-severity-medium/15" },
  { key: "low", label: "Low", color: "text-severity-low", bar: "bg-severity-low", border: "border-severity-low/15" },
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

  return (
    <main className="app-page">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">Organization overview</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {selectedOrg?.name || `Welcome back, ${displayName}.`}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Organization security activity and prioritized findings.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={contextLoading || !organizationId || refreshing || loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-md border border-text-primary/[0.12] bg-bg-elevated px-3 py-2 text-sm font-medium text-text-secondary transition hover:border-text-primary/[0.2] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {!contextLoading && !organizationId ? (
        <Notice icon={FolderGit2} title="No organization selected" detail="Choose an organization from the workspace selector to view its security overview." />
      ) : error ? (
        <div className="rounded-xl border border-severity-critical/20 bg-severity-critical/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-severity-critical" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-severity-critical">Unable to load the security overview</h2>
              <p className="mt-1 text-xs text-text-secondary">{error}</p>
              <button onClick={refresh} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-text-primary hover:text-accent-security">
                Retry <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      ) : loading || contextLoading ? (
        <DashboardSkeleton />
      ) : overview ? (
        <>
          <section aria-label="Organization metrics" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <MetricCard label="Repositories" value={overview.repositories.total ?? "—"} detail={overview.repositories.connected ? "Accessible through GitHub App" : "GitHub App not connected"} icon={FolderGit2} tone="blue" />
            <MetricCard label="Total scans" value={overview.totals.scans} detail="Scans recorded for this organization" icon={Activity} tone="green" />
            <MetricCard label="Historical findings" value={overview.totals.findings} detail={`All scan records · ${overview.totals.criticalAndHigh} historical critical/high`} icon={ShieldAlert} tone="amber" />
            <MetricCard label="Current unresolved" value={overview.totals.currentFindings ?? "—"} detail="Open or acknowledged in latest full scans" icon={ShieldCheck} tone="green" />
            <MetricCard label="Current critical + high" value={overview.totals.currentCriticalAndHigh ?? "—"} detail="Open or acknowledged in latest full scans" icon={Siren} tone="red" />
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <section className="overflow-hidden rounded-xl border border-text-primary/[0.07] bg-bg-secondary xl:col-span-7">
              <SectionHeader title="Historical risk distribution" detail="Final AVPR-Net risk category across all recorded scans" />
              {overview.totals.findings === 0 ? (
                <div className="p-6"><EmptyState title="No findings recorded" detail="Risk distribution will appear after a scan persists findings for this organization." /></div>
              ) : (
                <div className="space-y-4 p-5">
                  {RISK_LEVELS.map((level) => {
                    const count = overview.riskDistribution[level.key] || 0;
                    const percent = overview.totals.findings ? (count / overview.totals.findings) * 100 : 0;
                    return (
                      <div key={level.key}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className={`font-medium ${level.color}`}>{level.label} Risk</span>
                          <span className="font-mono-code text-text-secondary">{count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-text-primary/[0.06]" aria-label={`${level.label} risk: ${count}`}>
                          <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className="pt-1 text-[11px] text-text-muted">Counts include all persisted findings in this organization. Scanner severity is shown separately on each finding.</p>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-text-primary/[0.07] bg-bg-secondary xl:col-span-5">
              <SectionHeader title="Scanner activity" detail="Most recent recorded scanner outcomes" />
              {Object.keys(overview.scannerStatus || {}).length === 0 ? (
                <div className="p-5"><p className="text-xs leading-5 text-text-muted">No scanner execution status is available in recorded scan data yet.</p></div>
              ) : (
                <div className="divide-y divide-text-primary/[0.05]">
                  {Object.entries(overview.scannerStatus).map(([scanner, info]) => (
                    <div key={scanner} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <span className="text-xs font-medium capitalize text-text-primary">{scanner}</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs ${info.status === "completed" ? "text-severity-low" : "text-severity-critical"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${info.status === "completed" ? "bg-severity-low" : "bg-severity-critical"}`} />
                        {info.status === "completed" ? "Completed" : "Failed"}
                        <span className="text-text-muted">· {formatDate(info.scanAt)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-text-primary/[0.07] bg-bg-secondary xl:col-span-7">
              <SectionHeader title="Recent scans" detail="Latest scan activity for this organization" action={<Link to="/github" className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary">Repositories <ArrowRight className="h-3 w-3" /></Link>} />
              {overview.recentScans.length === 0 ? (
                <div className="p-6"><EmptyState title="No scans yet" detail="Run a scan from a connected repository to see its results here." action={<Link to="/github" className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent-security hover:underline">View repositories <ArrowRight className="h-3 w-3" /></Link>} /></div>
              ) : (
                <div className="divide-y divide-text-primary/[0.05]">
                  {overview.recentScans.map((scan) => (
                    <Link key={scan._id} to={`/github/${encodeURIComponent(scan.owner)}/${encodeURIComponent(scan.repo)}/scan`} className="block px-5 py-4 transition hover:bg-text-primary/[0.02]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono-code text-xs font-medium text-text-primary">{scan.owner}/{scan.repo}</span>
                        <ScanStatusBadge status={scan.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                        <span>{scan.summary?.total ?? 0} findings</span>
                        <span className="text-severity-critical">Critical {scan.summary?.critical ?? 0}</span>
                        <span className="text-severity-high">High {scan.summary?.high ?? 0}</span>
                        <span className="text-severity-medium">Medium {scan.summary?.medium ?? 0}</span>
                        <span className="text-severity-low">Low {scan.summary?.low ?? 0}</span>
                        <span>{formatDate(scan.createdAt)}</span>
                        {scan.durationMs != null && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatDuration(scan.durationMs)}</span>}
                      </div>
                      {((scan.scannersUsed?.length || 0) > 0 || (scan.scannerErrors?.length || 0) > 0) && (
                        <div className="mt-2 text-xs text-text-muted">
                          Scanners: {[...(scan.scannersUsed || []).map((name) => `${name} completed`), ...(scan.scannerErrors || []).map(({ scanner }) => `${scanner} failed`)].join(" · ")}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-text-primary/[0.07] bg-bg-secondary xl:col-span-5">
              <SectionHeader title="Prioritized findings" detail="Open and acknowledged findings from each repository's latest full scan, ordered by risk" />
              {overview.currentFindingsStatus?.repositoriesUsingEarlierSuccessfulResult > 0 && <p role="status" className="border-b border-severity-medium/10 bg-severity-medium/[0.04] px-5 py-3 text-xs leading-5 text-severity-medium">Newer scans are partial, failed, or still running for {overview.currentFindingsStatus.repositoriesUsingEarlierSuccessfulResult} {overview.currentFindingsStatus.repositoriesUsingEarlierSuccessfulResult === 1 ? "repository" : "repositories"}. Results remain based on the last successful full scan; these runs do not clear findings. <Link to="/github" className="ml-1 underline underline-offset-2">Review repositories</Link></p>}
              {overview.currentFindingsStatus?.repositoriesWithoutSuccessfulBaseline > 0 && <p role="status" className="border-b border-severity-medium/10 bg-severity-medium/[0.04] px-5 py-3 text-xs leading-5 text-severity-medium">{overview.currentFindingsStatus.repositoriesWithoutSuccessfulBaseline} {overview.currentFindingsStatus.repositoriesWithoutSuccessfulBaseline === 1 ? "repository has" : "repositories have"} no full-coverage scan yet and {overview.currentFindingsStatus.repositoriesWithoutSuccessfulBaseline === 1 ? "is" : "are"} excluded from current findings. <Link to="/github" className="ml-1 underline underline-offset-2">Open repositories</Link></p>}
              {overview.priorityFindings.length === 0 ? (
                <div className="p-6"><EmptyState title="No current findings to prioritize" detail={overview.currentFindingsStatus?.repositoriesWithSuccessfulBaseline ? "The latest successful full scans have no open or acknowledged findings." : overview.totals.scans ? "No repository has a successful full-coverage scan yet. Partial and failed scans do not establish a clean result." : "Current findings will appear after the first successful full scan."} /></div>
              ) : (
                <div className="divide-y divide-text-primary/[0.05]">
                  {overview.priorityFindings.map((finding) => (
                    <Link key={finding._id} to={`/github/${encodeURIComponent(finding.owner)}/${encodeURIComponent(finding.repo)}/scan?scanId=${encodeURIComponent(finding.scan)}`} className="block px-5 py-4 transition hover:bg-text-primary/[0.02]">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <RiskBadge category={finding.riskCategory} />
                        <span className="text-xs text-text-muted">Scanner severity: {finding.severity}</span>
                        <span className="ml-auto text-xs text-text-secondary">{Number(finding.riskScore).toFixed(2)} / 10</span>
                      </div>
                      <p className="text-sm font-medium text-text-primary">{finding.title}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
                        <span>{finding.owner}/{finding.repo}</span><span>·</span><span>{finding.cwe}</span><span>·</span><span className="truncate">{finding.filePath}{finding.startLine ? `:${finding.startLine}` : ""}</span><span>·</span><span className="capitalize">{finding.scanner}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/github" className="inline-flex items-center gap-2 rounded-md bg-accent-security px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-accent-security">View repositories <ArrowRight className="h-3.5 w-3.5" /></Link>
            {overview.recentScans[0] && <Link to={`/github/${encodeURIComponent(overview.recentScans[0].owner)}/${encodeURIComponent(overview.recentScans[0].repo)}`} className="inline-flex items-center gap-2 rounded-md border border-text-primary/[0.12] bg-bg-elevated px-4 py-2.5 text-sm text-text-secondary transition hover:border-text-primary/[0.2] hover:text-text-primary">Open latest repository <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </div>
        </>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  const styles = {
    blue: "text-severity-info border-severity-info/15 bg-severity-info/10",
    green: "text-severity-low border-severity-low/15 bg-severity-low/10",
    amber: "text-severity-medium border-severity-medium/15 bg-severity-medium/10",
    red: "text-severity-critical border-severity-critical/15 bg-severity-critical/10",
  };
  return (
    <div className="rounded-xl border border-text-primary/[0.07] bg-bg-secondary p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${styles[tone]}`}><Icon className="h-3.5 w-3.5" /></div>
      </div>
    </div>
  );
}

function SectionHeader({ title, detail, action }) {
  return <div className="flex items-center justify-between gap-3 border-b border-text-primary/[0.06] px-5 py-4"><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p></div>{action}</div>;
}

function RiskBadge({ category }) {
  const item = RISK_LEVELS.find(({ key }) => key === category?.toLowerCase());
  return <span className={`rounded-md border px-2 py-1 text-xs font-medium ${item ? `${item.color} ${item.border} bg-text-primary/[0.02]` : "border-text-primary/[0.08] text-text-muted"}`}>Risk: {item?.label || "Unknown"}</span>;
}

function EmptyState({ title, detail, action }) {
  return <div className="py-3 text-center"><ShieldCheck className="mx-auto h-7 w-7 text-accent-security" /><h3 className="mt-3 text-sm font-semibold text-text-primary">{title}</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-text-muted">{detail}</p>{action}</div>;
}

function Notice({ icon: Icon, title, detail }) {
  return <div className="rounded-xl border border-dashed border-text-primary/[0.1] bg-bg-secondary p-10 text-center"><Icon className="mx-auto h-8 w-8 text-text-muted" /><h2 className="mt-4 text-sm font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-xs text-text-secondary">{detail}</p></div>;
}

function DashboardSkeleton() {
  return <div aria-label="Loading dashboard" className="space-y-5"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-text-primary/[0.06] bg-bg-secondary" />)}</div><div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl border border-text-primary/[0.06] bg-bg-secondary" />)}</div></div>;
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
