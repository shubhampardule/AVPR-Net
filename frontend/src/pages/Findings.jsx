import React, { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { FindingCard } from "../components/ui/FindingCard";

const riskOptions = [
  ["all", "All risks"],
  ["critical", "Critical"],
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
];

export default function Findings() {
  const { selectedOrg, loading: contextLoading = false } = useOutletContext();
  const organizationId = selectedOrg?.id || selectedOrg?._id;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [risk, setRisk] = useState("all");
  const [revision, setRevision] = useState(0);
  const preserveCurrentResults = useRef(false);

  useEffect(() => {
    if (contextLoading) return undefined;
    if (!organizationId) {
      setData(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setError("");
    if (!preserveCurrentResults.current) setLoading(true);
    fetch(`${API_BASE_URL}/scans/organizations/${organizationId}/findings?page=${page}${risk === "all" ? "" : `&riskCategory=${risk}`}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Unable to load findings.");
        return body.data;
      })
      .then((result) => setData(result))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message || "Unable to load findings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          preserveCurrentResults.current = false;
        }
      });

    return () => controller.abort();
  }, [contextLoading, organizationId, page, risk, revision]);

  const retry = () => {
    preserveCurrentResults.current = Boolean(data);
    setRevision((value) => value + 1);
  };
  const refreshAfterReview = () => {
    preserveCurrentResults.current = true;
    setRevision((value) => value + 1);
  };
  const changeRisk = (event) => {
    setData(null);
    setRisk(event.target.value);
    setPage(1);
  };
  const changePage = (nextPage) => {
    setData(null);
    setPage(nextPage);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-7 sm:px-6 lg:px-8 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-[#A8B9AF]">{selectedOrg?.name || "Organization findings"}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Findings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Open findings from the latest complete scans. Check each repository’s scan history for partial coverage.</p>
        </div>
        {organizationId && (
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <span>Risk</span>
            <select aria-label="Risk filter" value={risk} onChange={changeRisk} className="rounded-md border border-white/[0.12] bg-[#202729] px-3 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A2C7AE]">
              {riskOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
      </header>

      {!contextLoading && !organizationId && (
        <section className="rounded-xl border border-white/[0.1] bg-[#171D1F] p-5 sm:p-6">
          <h2 className="font-semibold text-text-primary">No organization selected</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Choose a workspace from the selector in the sidebar to see its findings.</p>
          <Link to="/settings" className="mt-4 inline-flex rounded-md border border-white/[0.14] px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/[0.04]">Open workspace settings</Link>
        </section>
      )}

      {loading && organizationId && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#171D1F] px-4 py-3 text-sm text-text-secondary">
          <RefreshCw className="h-4 w-4 animate-spin text-[#A8C4B1]" aria-hidden="true" /> Loading findings…
        </p>
      )}

      {error && (
        <section role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.04] p-5 text-sm text-rose-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">We couldn’t load findings.</h2>
              <p className="mt-1 text-rose-100/75">Retry the request. If it keeps failing, share the technical details with your administrator.</p>
              <details className="mt-3 text-xs text-rose-100/70">
                <summary className="w-fit cursor-pointer underline underline-offset-2">Technical details</summary>
                <p className="mt-2 break-words font-mono-code">{error}</p>
              </details>
              <button type="button" onClick={retry} className="mt-4 rounded-md border border-rose-100/20 px-3 py-2 text-xs font-semibold hover:bg-rose-100/10">Retry</button>
              {data && <p className="mt-3 text-xs text-amber-200">The results below are from the last successful load and may be out of date.</p>}
            </div>
          </div>
        </section>
      )}

      {!loading && data?.findings?.map((finding) => (
        <FindingCard
          key={finding._id}
          finding={finding}
          organizationId={organizationId}
          commitSha={data.latestScans?.find((scan) => scan.scan === finding.scan)?.commitSha}
          onReviewed={refreshAfterReview}
        />
      ))}

      {!loading && !error && data && data.findings.length === 0 && (
        <section className="rounded-xl border border-white/[0.1] bg-[#171D1F] p-5 sm:p-6">
          <h2 className="font-semibold text-text-primary">{data.pagination?.total ? "No findings on this page" : "No findings in this view"}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{data.pagination?.total ? "Try the previous page to return to the results." : "No open or acknowledged findings match the selected risk level. Check scanner coverage in repository history if you expected results."}</p>
          {!data.pagination?.total && <Link to="/github" className="mt-4 inline-flex rounded-md border border-white/[0.14] px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/[0.04]">View repositories</Link>}
        </section>
      )}

      {!loading && !error && data?.pagination && data.pagination.totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4" aria-label="Findings pagination">
          <p className="text-sm text-text-secondary">{page}/{data.pagination.totalPages} · {data.pagination.total} findings</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} className="rounded-md border border-white/[0.12] px-3 py-2 text-sm text-text-primary transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => changePage((value) => value - 1)}>Previous</button>
            <button type="button" disabled={page >= data.pagination.totalPages} className="rounded-md border border-white/[0.12] px-3 py-2 text-sm text-text-primary transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => changePage((value) => value + 1)}>Next</button>
          </div>
        </nav>
      )}
    </main>
  );
}
