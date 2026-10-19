import React, { useEffect, useState, useRef } from "react";
import {
  useNavigate,
  useOutletContext,
  useParams,
  Link,
} from "react-router-dom";
import {
  ArrowLeft,
  ScanLine,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../config/api";
import { ScanStatusBadge } from "../components/ui/ScanStatusBadge";
import { FindingCard } from "../components/ui/FindingCard";

export default function ScanPage() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const { selectedOrg } = useOutletContext();

  const organizationId =
    selectedOrg?._id ||
    selectedOrg?.id ||
    selectedOrg?.organization?._id ||
    selectedOrg?.organization?.id;

  const [activeScan, setActiveScan] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState("all");

  const pollIntervalRef = useRef(null);

  const fetchScanHistory = async () => {
    if (!organizationId || !owner || !repo) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/scans/organizations/${organizationId}/repositories/${encodeURIComponent(
          owner
        )}/${encodeURIComponent(repo)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok && data.data?.scans) {
        setScanHistory(data.data.scans);
        if (data.data.scans.length > 0 && !activeScan) {
          setActiveScan(data.data.scans[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch scan history:", err);
    }
  };

  const fetchScanDetails = async (scanId) => {
    if (!scanId) return;
    try {
      const [statusRes, findingsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/scans/${scanId}`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/scans/${scanId}/findings?limit=100`, {
          credentials: "include",
        }),
      ]);

      const statusData = await statusRes.json();
      const findingsData = await findingsRes.json();

      if (statusRes.ok && statusData.data) {
        setActiveScan(statusData.data);
      }

      if (findingsRes.ok && findingsData.data?.findings) {
        setFindings(findingsData.data.findings);
      }
    } catch (err) {
      console.error("Failed to fetch scan details:", err);
    }
  };

  // Start polling if scan is running or queued
  useEffect(() => {
    if (activeScan && (activeScan.status === "queued" || activeScan.status === "running")) {
      pollIntervalRef.current = setInterval(() => {
        fetchScanDetails(activeScan._id || activeScan.id);
      }, 3000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeScan?.status, activeScan?._id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchScanHistory();
      setLoading(false);
    };
    init();
  }, [organizationId, owner, repo]);

  useEffect(() => {
    if (activeScan?._id) {
      fetchScanDetails(activeScan._id);
    }
  }, [activeScan?._id]);

  const handleStartScan = async () => {
    if (!organizationId) {
      setError("Please select an active organization first.");
      return;
    }

    try {
      setTriggering(true);
      setError(null);

      const res = await fetch(
        `${API_BASE_URL}/scans/organizations/${organizationId}/repositories/${encodeURIComponent(
          owner
        )}/${encodeURIComponent(repo)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Failed to trigger scan");
      }

      // 202 Accepted returned with scanId
      const newScan = {
        _id: data.data.scanId,
        id: data.data.scanId,
        status: data.data.status,
        owner,
        repo,
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
        createdAt: new Date().toISOString(),
      };

      setActiveScan(newScan);
      setFindings([]);
      setScanHistory((prev) => [newScan, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setTriggering(false);
    }
  };

  const filteredFindings = findings.filter((f) => {
    if (filterSeverity === "all") return true;
    return f.riskCategory?.toLowerCase() === filterSeverity.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F5F7FA]">
      {/* Top Header */}
      <header className="border-b border-white/[0.08] bg-[#0A0C0F]/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`)}
                className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-text-muted hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted">Repository /</span>
                  <span className="text-sm font-semibold text-text-primary font-mono">
                    {owner}/{repo}
                  </span>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mt-0.5">
                  <ScanLine className="w-5 h-5 text-[#4ADE80]" />
                  Security Scan Pipeline
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => activeScan && fetchScanDetails(activeScan._id)}
                disabled={loading || triggering}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-text-secondary hover:text-white transition disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>

              <button
                onClick={handleStartScan}
                disabled={triggering || activeScan?.status === "running" || activeScan?.status === "queued"}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4ADE80] text-[#08090B] hover:bg-[#3ecb72] text-xs font-mono font-semibold transition disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {triggering ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Enqueuing...
                  </>
                ) : (
                  <>
                    <ScanLine className="w-3.5 h-3.5" />
                    New Security Scan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-mono font-semibold text-rose-300">Scan Pipeline Notice</h4>
              <p className="text-xs text-rose-200 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Active Scan Status Banner */}
        {activeScan && (
          <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#0D0F12]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <ScanStatusBadge status={activeScan.status} />
                <span className="text-xs font-mono text-text-muted">
                  Scan ID: <span className="text-text-primary">{activeScan._id || activeScan.id}</span>
                </span>
                {activeScan.jobId && (
                  <span className="text-xs font-mono text-text-muted">
                    Job: <span className="text-text-secondary">{activeScan.jobId}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-text-muted">
                {activeScan.startedAt && (
                  <span>
                    Started: {new Date(activeScan.startedAt).toLocaleTimeString()}
                  </span>
                )}
                {activeScan.completedAt && (
                  <span>
                    Finished: {new Date(activeScan.completedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {/* In-Progress Notification */}
            {(activeScan.status === "queued" || activeScan.status === "running") && (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                  <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  {activeScan.status === "queued" ? "Scan is Queued in BullMQ" : "Analyzing Code with Orchestrated Scanners"}
                </h3>
                <p className="text-xs text-text-muted max-w-md mt-1 leading-relaxed">
                  Ephemeral workspace downloaded from GitHub App authorization. Executing Semgrep and Bandit security rules...
                </p>
              </div>
            )}

            {/* Error Message if Failed */}
            {activeScan.status === "failed" && activeScan.errorMessage && (
              <div className="py-4 text-xs font-mono text-rose-400 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 mt-3">
                Failure Reason: {activeScan.errorMessage}
              </div>
            )}

            {activeScan.scannerErrors?.length > 0 && (
              <div className="py-4 text-xs text-amber-200 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 mt-3">
                <p className="font-semibold">Some scanners failed. These results may be incomplete.</p>
                {activeScan.scannerErrors.map(({ scanner, message }) => (
                  <p key={scanner} className="mt-1 font-mono text-amber-100/80">
                    {scanner}: {message}
                  </p>
                ))}
              </div>
            )}

            {/* Metric Summary Cards */}
            {activeScan.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
                <div className="p-3 rounded-xl bg-[#111419] border border-white/[0.06]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block">
                    Total Findings
                  </span>
                  <span className="text-2xl font-bold font-mono text-white mt-1 block">
                    {activeScan.summary.total || 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 block">
                    Critical Risk
                  </span>
                  <span className="text-2xl font-bold font-mono text-rose-400 mt-1 block">
                    {activeScan.summary.critical || 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-orange-400 block">
                    High Risk
                  </span>
                  <span className="text-2xl font-bold font-mono text-orange-400 mt-1 block">
                    {activeScan.summary.high || 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block">
                    Medium Risk
                  </span>
                  <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
                    {activeScan.summary.medium || 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#4ADE80]/5 border border-[#4ADE80]/10">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#4ADE80] block">
                    Low Risk
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#4ADE80] mt-1 block">
                    {activeScan.summary.low || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Findings List Section */}
        {activeScan && activeScan.status === "completed" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                  Prioritized Vulnerabilities
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Ordered by deterministic risk score (Severity, Exploitability, Occurrence, Business Impact)
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#111419] border border-white/[0.06] text-xs font-mono">
                {["all", "critical", "high", "medium", "low"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-2.5 py-1 rounded capitalize transition ${
                      filterSeverity === sev
                        ? "bg-white/[0.1] text-white font-medium"
                        : "text-text-muted hover:text-white"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {filteredFindings.length === 0 ? (
              <div className="p-8 rounded-2xl border border-white/[0.08] bg-[#0D0F12] text-center">
                <CheckCircle2 className="w-8 h-8 text-[#4ADE80] mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-white">No Vulnerabilities in this Category</h4>
                <p className="text-xs text-text-muted mt-1">
                  The scanned codebase does not have findings matching '{filterSeverity}'.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFindings.map((finding) => (
                  <FindingCard key={finding._id || finding.fingerprint} finding={finding} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* No Scans Initial State */}
        {!loading && !activeScan && (
          <div className="p-12 rounded-2xl border border-white/[0.08] bg-[#0D0F12] text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-xl bg-[#111419] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
              <ScanLine className="w-6 h-6 text-[#4ADE80]" />
            </div>
            <h3 className="text-lg font-bold text-white">No Security Scans Run Yet</h3>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              Launch your first security scan against {owner}/{repo}. SecurePatch will fetch an authorized ephemeral repository archive, run Semgrep and Bandit, and calculate audit-ready risk scores.
            </p>
            <button
              onClick={handleStartScan}
              disabled={triggering}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#4ADE80] text-[#08090B] font-mono text-xs font-bold hover:bg-[#3ecb72] transition"
            >
              <ScanLine className="w-4 h-4" />
              Start Security Scan
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
