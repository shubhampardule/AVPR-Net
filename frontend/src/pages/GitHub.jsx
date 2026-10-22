import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { GitBranch, FolderGit2, RefreshCw, ShieldCheck, Lock, Globe, ChevronRight, AlertCircle, Plus, X, ExternalLink } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { GithubIcon } from "../components/ui/GithubIcon";

import { API_BASE_URL } from "../config/api";

export default function GitHub() {
  const { selectedOrg, loading: contextLoading = false } = useOutletContext();
  const navigate = useNavigate();

  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [installationUrl, setInstallationUrl] = useState(null);
  const [installation, setInstallation] = useState(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [installations, setInstallations] = useState([]);
  const [selectedInstallation, setSelectedInstallation] = useState("");
  const [installationRevoked, setInstallationRevoked] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [installAppUrl, setInstallAppUrl] = useState(null);

  const organizationId =
    selectedOrg?._id ||
    selectedOrg?.id ||
    selectedOrg?.organization?._id ||
    selectedOrg?.organization?.id;

  const organizationName =
    selectedOrg?.name ||
    selectedOrg?.organization?.name ||
    "Selected workspace";

const fetchGitHubStatus = async (isRefresh = false) => {
  if (!organizationId) return null;
  let statusChecked = false;
  if (isRefresh) setRefreshing(true);
  else setLoading(true);
  setError(null);
  try {
    const response = await fetch(`${API_BASE_URL}/github/organizations/${organizationId}/status`, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Failed to load GitHub status");
    statusChecked = true;
    setStatusUnavailable(false);

    const isConnected = Boolean(body.data?.connected);
    const connectedInstallation = body.data?.installation || null;
    setInstallationRevoked((current) => Boolean(body.data?.revoked || (current && !isConnected)));
    setConnected(isConnected);
    setInstallation(connectedInstallation);
    setInstallationUrl(connectedInstallation?.htmlUrl || null);
    if (isConnected) {
      const reposResponse = await fetch(`${API_BASE_URL}/github/organizations/${organizationId}/repositories`, { credentials: "include" });
      const reposBody = await reposResponse.json();
      if (!reposResponse.ok) throw new Error(reposBody.error?.message || "GitHub is connected, but its repository list could not be loaded.");
      const nextRepositories = reposBody.data?.repositories || [];
      setRepositories(nextRepositories);
      setInstallations([]);
      setInstallAppUrl(null);
      return { connected: true, account: connectedInstallation?.account || null, repositories: nextRepositories };
    }

    setInstallation(null);
    setInstallationUrl(null);
    setRepositories([]);
    const [installResponse, appResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/github/installations`, { credentials: "include" }),
      fetch(`${API_BASE_URL}/github/test`, { credentials: "include" }),
    ]);
    const [installData, appData] = await Promise.all([installResponse.json(), appResponse.json()]);
    if (!installResponse.ok || !appResponse.ok) throw new Error("Unable to load GitHub App access.");
    const revokedId = body.data?.revokedInstallationId;
    const availableInstallations = (installData.data || []).filter((item) =>
      revokedId == null || String(item.id) !== String(revokedId)
    );
    setInstallations(availableInstallations);
    setSelectedInstallation(availableInstallations[0]?.id?.toString() || "");
    setInstallAppUrl(appData.data?.slug ? `https://github.com/apps/${encodeURIComponent(appData.data.slug)}/installations/new` : null);
    return { connected: false, account: null, repositories: [] };
  } catch (err) {
    console.error("Failed to load GitHub status:", err);
    setError(err.message || "Failed to load GitHub status");
    if (!statusChecked) setStatusUnavailable(true);
    // The installation status may have loaded successfully before the repository
    // request failed. Keep that verified account state instead of showing a false
    // disconnected state; only clear identity when status itself is unavailable.
    if (!statusChecked && !isRefresh) {
      setConnected(false);
      setInstallation(null);
      setInstallationUrl(null);
      setRepositories([]);
    }
    return { error: err.message || "Failed to load GitHub status" };
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

useEffect(() => {
  if (!contextLoading && organizationId) {
    setLoading(true);
    setError(null);
    setStatusUnavailable(false);
    setConnected(false);
    setInstallationRevoked(false);
    setInstallation(null);
    setInstallationUrl(null);
    setRepositories([]);
    fetchGitHubStatus();
  }
}, [contextLoading, organizationId]);

const connectInstallation = async () => {
  setConnecting(true);
  setError(null);
  try {
    const response = await fetch(`${API_BASE_URL}/github/organizations/${organizationId}/connect`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId: selectedInstallation }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Unable to connect GitHub.");
    await fetchGitHubStatus(true);
  } catch (err) { setError(err.message); }
  finally { setConnecting(false); }
};


  const handleOpenRepository = (repo) => {
    navigate(`/github/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`);
  };

  return (
    <main className="app-document min-h-screen">
      <header className="page-header border-b border-border-subtle bg-bg-primary">
        <div className="flex items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <GithubIcon className="h-6 w-6 text-text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">Repositories</h1>
            </div>
            <p className="mt-1 text-sm text-text-secondary">Manage repositories connected to AVPR-Net</p>
          </div>

          <button onClick={() => fetchGitHubStatus(true)} disabled={refreshing || loading || !organizationId} className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-secondary transition hover:border-text-primary/15 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="app-page">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-xl border border-border-subtle bg-bg-secondary p-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-text-primary/10 bg-text-primary/[0.04]">
                <GithubIcon className="h-6 w-6 text-text-primary" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">GitHub App</h2>

                  <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${connected ? "border-severity-low/20 bg-severity-low/10 text-severity-low" : "border-text-primary/10 bg-text-primary/5 text-text-muted"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-severity-low" : "bg-text-muted"}`} />
                    {connected ? "Connected" : "Not connected"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-text-secondary">{organizationName}</p>
                {connected && installation?.account ? (
                  <p className="mt-2 text-xs text-text-muted">
                    Installation owner: {installation.htmlUrl ? <a href={installation.htmlUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-text-secondary underline decoration-text-primary/20 underline-offset-2 hover:text-text-primary">{installation.account}</a> : <span className="font-medium text-text-secondary">{installation.account}</span>}
                    {installation.accountType && <span> · {installation.accountType}</span>}
                  </p>
                ) : connected ? (
                  <p className="mt-2 font-mono-code text-xs text-text-muted">Connected installation</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <ShieldCheck className="h-4 w-4 text-accent-security" />
              Access managed by GitHub
            </div>
          </div>
        </motion.div>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-severity-critical/20 bg-severity-critical/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-severity-critical" />

            <div>
              <p className="text-sm font-medium text-severity-critical">Unable to load repositories</p>
              <p className="mt-1 text-sm text-text-secondary">{error}</p>
              <button type="button" onClick={() => fetchGitHubStatus(true)} disabled={refreshing} className="mt-3 inline-flex items-center gap-2 rounded-md border border-severity-critical/20 px-3 py-1.5 text-xs font-medium text-severity-critical hover:bg-severity-critical/5 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Retry</button>
              {repositories.length > 0 && <p className="mt-3 text-xs text-severity-medium">Showing {repositories.length} repositories from the last successful load; they may be out of date. Refresh to check for changes.</p>}
            </div>
          </div>
        )}

        {!contextLoading && !organizationId && !error && (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-secondary p-12 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-text-muted" />
            <h3 className="mt-4 font-medium">No organization selected</h3>
            <p className="mt-2 text-sm text-text-secondary">Select an organization from the workspace selector.</p>
          </div>
        )}

        {organizationId && !connected && !loading && !statusUnavailable && (
          <section className="mb-6 rounded-xl border border-border-subtle bg-bg-secondary p-6">
            <h2 className="font-semibold">Connect your GitHub account</h2>
            <p className="mt-2 text-sm text-text-secondary">Sign in with GitHub to authorize your identity. App installation is separate: if no installation is listed, install AVPR-Net on the GitHub account that owns the repositories, then return and connect it here.</p>
            {installationRevoked && <p role="status" className="mt-3 rounded-lg border border-severity-medium/20 bg-severity-medium/5 p-3 text-sm text-severity-medium">GitHub reports that AVPR-Net was removed from this organization. Reinstall the app, then connect its new installation here.</p>}
            <a href={`${API_BASE_URL}/auth/github`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-security px-4 py-2 text-sm font-medium text-on-accent"><GithubIcon className="h-4 w-4" /> Sign in with GitHub</a>
            {installAppUrl && <a href={installAppUrl} className="ml-4 inline-flex items-center gap-2 text-sm text-accent-blue">Install GitHub App <ExternalLink className="h-3 w-3" /></a>}
            {installations.length > 0 && ["owner", "admin"].includes(selectedOrg?.role) && <div className="mt-5 flex flex-wrap items-center gap-3">
              <label htmlFor="github-installation" className="text-sm">GitHub installation</label>
              <select id="github-installation" value={selectedInstallation} onChange={(event) => setSelectedInstallation(event.target.value)} className="rounded-lg border border-text-primary/10 bg-bg-elevated px-3 py-2 text-sm">
                {installations.map((item) => <option key={item.id} value={item.id}>{item.account}</option>)}
              </select>
              <button disabled={connecting || !selectedInstallation} onClick={connectInstallation} className="rounded-lg bg-accent-security px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50">{connecting ? "Connecting..." : "Connect installation"}</button>
            </div>}
          </section>
        )}

        {organizationId && connected && (
          <section>
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-3">

                  {!loading && (
                    <span className="rounded-full border border-text-primary/[0.08] bg-text-primary/[0.03] px-2 py-0.5 font-mono-code text-[11px] text-text-muted">
                      {repositories.length} {repositories.length === 1 ? "repository" : "repositories"}
                    </span>
                  )}
                </div>

                <h2 className="mt-2 text-base font-semibold">Available repositories</h2>

              </div>

              <button onClick={() => setAddRepoOpen(true)} className="group inline-flex items-center justify-center gap-2 rounded-lg border border-text-primary/[0.10] bg-bg-elevated px-3.5 py-2 text-xs font-medium text-text-secondary shadow-sm transition-all duration-200 hover:border-accent-blue/30 hover:bg-accent-blue/5 hover:text-text-primary">
                <GithubIcon className="h-4 w-4 text-text-muted transition-colors group-hover:text-accent-blue" />
                <span>Add repository</span>
                <Plus className="h-3.5 w-3.5 text-text-muted transition-transform duration-200 group-hover:text-accent-blue" />
              </button>
            </div>

            {loading || contextLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((item) => (
                  <div key={item} className="h-40 animate-pulse rounded-xl border border-border-subtle bg-bg-secondary" />
                ))}
              </div>
            ) : error && repositories.length === 0 ? (
              <div role="status" className="rounded-xl border border-dashed border-border-subtle bg-bg-secondary p-8 text-center">
                <AlertCircle className="mx-auto h-7 w-7 text-text-muted" />
                <h3 className="mt-3 font-medium">Repository list unavailable</h3>
                <p className="mt-2 text-sm text-text-secondary">AVPR-Net could not confirm which repositories this installation can access. Retry the request before changing GitHub permissions.</p>
              </div>
            ) : repositories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle bg-bg-secondary p-12 text-center">
                <FolderGit2 className="mx-auto h-8 w-8 text-text-muted" />
                <h3 className="mt-4 font-medium">No repositories found</h3>
                <p className="mt-2 text-sm text-text-secondary">This installation currently grants AVPR-Net access to no repositories. Open GitHub’s app settings, select the missing repositories, then return here and refresh access.</p>

                <button onClick={() => setAddRepoOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-text-primary/[0.10] bg-text-primary/[0.04] px-3.5 py-2 text-xs font-medium text-text-secondary transition hover:border-accent-blue/30 hover:text-text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Add repository
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {repositories.map((repo, index) => (
                  <motion.button
                    type="button"
                    key={repo.id}
                    onClick={() => handleOpenRepository(repo)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group w-full cursor-pointer rounded-xl border border-border-subtle bg-bg-secondary p-5 text-left transition-all hover:border-text-primary/15 hover:bg-bg-elevated"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-text-primary/10 bg-text-primary/[0.03]">
                          <FolderGit2 className="h-5 w-5 text-accent-blue" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-medium text-text-primary">{repo.name}</h3>
                          <p className="mt-1 truncate font-mono-code text-xs text-text-muted">{repo.fullName}</p>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-text-primary" />
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-border-subtle pt-4">
                      <div className="flex items-center gap-4 text-xs text-text-secondary">
                        <span className="flex items-center gap-1.5">
                          <GitBranch className="h-3.5 w-3.5" />
                          {repo.defaultBranch}
                        </span>

                        <span className="flex items-center gap-1.5">
                          {repo.private ? (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              Private
                            </>
                          ) : (
                            <>
                              <Globe className="h-3.5 w-3.5" />
                              Public
                            </>
                          )}
                        </span>
                      </div>

                      <span className="font-mono-code text-[11px] uppercase tracking-wider text-text-muted">Browse repository</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {addRepoOpen && <AddRepositoryModal onClose={() => setAddRepoOpen(false)} installationUrl={installationUrl} installation={installation} repositoryCount={repositories.length} onRefresh={() => fetchGitHubStatus(true)} refreshing={refreshing} />}
    </main>
  );
}

function AddRepositoryModal({ onClose, installationUrl, installation, repositoryCount, onRefresh, refreshing }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("button")?.focus();
    const onKey = event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...(dialogRef.current?.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') || [])];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); previousFocus?.focus?.(); };
  }, []);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshFailed, setRefreshFailed] = useState(false);
  async function refreshAccess() {
    setRefreshMessage("");
    setRefreshFailed(false);
    const result = await onRefresh();
    if (!result || result.error) {
      setRefreshFailed(true);
      setRefreshMessage(`Couldn’t refresh repository access: ${result?.error || "Please try again."}`);
      return;
    }
    setRefreshMessage(result.connected
      ? `Access refreshed. AVPR-Net can now see ${result.repositories.length} ${result.repositories.length === 1 ? "repository" : "repositories"}${result.account ? ` for ${result.account}` : ""}.`
      : "No GitHub installation is connected to this workspace yet. Connect one before loading repositories.");
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-repository-title" onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-text-primary/[0.09] bg-bg-secondary shadow-2xl">
        <div className="flex items-start justify-between border-b border-text-primary/[0.06] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-text-primary/[0.08] bg-text-primary/[0.04]">
              <GithubIcon className="h-5 w-5 text-text-primary" />
            </div>

            <div>
              <h3 id="add-repository-title" className="text-base font-semibold text-text-primary">Add repository</h3>
              <p className="mt-1 text-xs text-text-muted">Authorize repository access through GitHub.</p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition hover:bg-text-primary/[0.05] hover:text-text-primary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="rounded-xl border border-text-primary/[0.07] bg-text-primary/[0.025] p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent-blue/20 bg-accent-blue/10">
                <span className="font-mono-code text-xs text-accent-blue">i</span>
              </div>

              <div>
                <p className="text-xs font-medium text-text-primary">Manage repository access through GitHub</p>
                <p className="mt-1.5 text-xs leading-5 text-text-secondary">AVPR-Net can only access repositories that are authorized through its GitHub App installation.</p>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-text-primary/[0.06] px-4 py-3 text-xs text-text-secondary">
            <p><span className="text-text-muted">Current installation:</span> {installation?.account || "Unknown"}{installation?.accountType ? ` · ${installation.accountType}` : ""}</p>
            <p className="mt-1"><span className="text-text-muted">Currently available:</span> {repositoryCount} {repositoryCount === 1 ? "repository" : "repositories"}</p>
          </div>

          <div className="mt-6 space-y-4">
            <Step number="01" title="Open GitHub App settings" description="Manage which repositories AVPR-Net can access." />
            <Step number="02" title="Select a repository" description="Grant AVPR-Net access to the repository you want to scan." />
            <Step number="03" title="Return and refresh access" description="Use the button below after saving your GitHub App settings. The list will reload from GitHub." />
            {refreshMessage && <p role={refreshFailed ? "alert" : "status"} className="rounded-lg border border-text-primary/[0.08] bg-text-primary/[0.03] p-3 text-xs leading-5 text-text-secondary">{refreshMessage}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-text-primary/[0.06] px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-text-primary/[0.08] px-3.5 py-2 text-xs font-medium text-text-secondary transition hover:border-text-primary/[0.15] hover:text-text-primary">
            Cancel
          </button>

          {installationUrl ? (
            <a href={installationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-accent-security px-3.5 py-2 text-xs font-semibold text-on-accent transition hover:bg-text-primary/90">
              <GithubIcon className="h-4 w-4" />
              Open GitHub settings
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span title="Refresh GitHub status to load the installation settings link" className="flex items-center gap-2 rounded-lg bg-accent-security px-3.5 py-2 text-xs font-semibold text-on-accent opacity-50">
              <GithubIcon className="h-4 w-4" />
              GitHub settings unavailable
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="flex justify-end px-6 pb-5">
          <button type="button" onClick={refreshAccess} disabled={refreshing} className="flex items-center gap-2 rounded-lg border border-accent-blue/30 bg-accent-blue/10 px-3.5 py-2 text-xs font-semibold text-text-primary transition hover:bg-accent-blue/15 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing access…" : "I’ve updated access — refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-text-primary/[0.08] bg-text-primary/[0.025]">
        <span className="font-mono-code text-[11px] text-text-muted">{number}</span>
      </div>

      <div className="pt-0.5">
        <p className="text-xs font-medium text-text-primary">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-text-muted">{description}</p>
      </div>
    </div>
  );
}
