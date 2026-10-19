import React, { useEffect, useState } from "react";
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
  const [connected, setConnected] = useState(false);
  const [installations, setInstallations] = useState([]);
  const [selectedInstallation, setSelectedInstallation] = useState("");
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
    "SecurePatch Organization";

const fetchGitHubStatus = async () => {
  if (!organizationId) return;

  try {
    const response = await fetch(`${API_BASE_URL}/github/organizations/${organizationId}/status`, {
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to load GitHub status");
    }

    setConnected(Boolean(data.data?.connected));
    setInstallationUrl(data.data?.installation?.htmlUrl || null);
    if (data.data?.connected) {
      await fetchRepositories();
    } else {
      setRepositories([]);
      const [installResponse, appResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/github/installations`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/github/test`, { credentials: "include" }),
      ]);
      const installData = await installResponse.json();
      const appData = await appResponse.json();
      if (!installResponse.ok || !appResponse.ok) throw new Error("Unable to load GitHub App access.");
      setInstallations(installData.data || []);
      setSelectedInstallation(installData.data?.[0]?.id?.toString() || "");
      setInstallAppUrl(appData.data?.slug ? `https://github.com/apps/${encodeURIComponent(appData.data.slug)}/installations/new` : null);
    }
  } catch (err) {
    console.error("Failed to load GitHub status:", err);
    setError(err.message);
    setInstallationUrl(null);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

const fetchRepositories = async (isRefresh = false) => {
  if (!organizationId) return;

  try {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    const response = await fetch(`${API_BASE_URL}/github/organizations/${organizationId}/repositories`, {
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to load repositories");
    }

    setRepositories(data.data?.repositories || []);
  } catch (err) {
    console.error("Failed to load repositories:", err);
    setError(err.message || "Failed to load repositories");
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

useEffect(() => {
  if (!contextLoading && organizationId) {
    setLoading(true);
    setError(null);
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
    await fetchGitHubStatus();
  } catch (err) { setError(err.message); }
  finally { setConnecting(false); }
};


  const handleOpenRepository = (repo) => {
    navigate(`/github/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`);
  };

const handleManageGitHubAccess = () => {
  if (!installationUrl) return;

  window.open(installationUrl, "_blank", "noopener,noreferrer");
};

  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <GithubIcon className="h-6 w-6 text-white" />
              <h1 className="text-xl font-semibold tracking-tight">GitHub</h1>
            </div>
            <p className="mt-1 text-sm text-text-secondary">Manage repositories connected to SecurePatch</p>
          </div>

          <button onClick={async () => {
  setRefreshing(true);
  await fetchGitHubStatus();
}} disabled={refreshing || loading || !organizationId} className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-secondary transition hover:border-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-xl border border-border-subtle bg-bg-secondary p-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <GithubIcon className="h-6 w-6 text-white" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">GitHub App</h2>

                  <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${connected ? "border-accent-security/20 bg-accent-security/10 text-accent-security" : "border-white/10 bg-white/5 text-text-muted"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-accent-security" : "bg-text-muted"}`} />
                    {connected ? "Connected" : "Not connected"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-text-secondary">{organizationName}</p>
                <p className="mt-2 font-mono-code text-xs text-text-muted">GitHub App Installation</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <ShieldCheck className="h-4 w-4 text-accent-security" />
              Read-only repository access
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

            <div>
              <p className="text-sm font-medium text-red-300">Unable to load repositories</p>
              <p className="mt-1 text-sm text-text-secondary">{error}</p>
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

        {organizationId && !connected && !loading && (
          <section className="mb-6 rounded-xl border border-border-subtle bg-bg-secondary p-6">
            <h2 className="font-semibold">Connect your GitHub account</h2>
            <p className="mt-2 text-sm text-text-secondary">Authorize your GitHub account, then choose the installation for this workspace.</p>
            <a href={`${API_BASE_URL}/auth/github`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"><GithubIcon className="h-4 w-4" /> Sign in with GitHub</a>
            {installAppUrl && <a href={installAppUrl} className="ml-4 inline-flex items-center gap-2 text-sm text-accent-blue">Install GitHub App <ExternalLink className="h-3 w-3" /></a>}
            {installations.length > 0 && ["owner", "admin"].includes(selectedOrg?.role) && <div className="mt-5 flex flex-wrap items-center gap-3">
              <label htmlFor="github-installation" className="text-sm">GitHub installation</label>
              <select id="github-installation" value={selectedInstallation} onChange={(event) => setSelectedInstallation(event.target.value)} className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm">
                {installations.map((item) => <option key={item.id} value={item.id}>{item.account}</option>)}
              </select>
              <button disabled={connecting || !selectedInstallation} onClick={connectInstallation} className="rounded-lg bg-[#4ADE80] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{connecting ? "Connecting..." : "Connect installation"}</button>
            </div>}
          </section>
        )}

        {organizationId && connected && (
          <section>
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-mono-code text-xs uppercase tracking-[0.18em] text-accent-blue">Repository Access</p>

                  {!loading && (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono-code text-[9px] text-text-muted">
                      {repositories.length} {repositories.length === 1 ? "repository" : "repositories"}
                    </span>
                  )}
                </div>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Repositories</h2>
                <p className="mt-1 text-sm text-text-secondary">Repositories available to SecurePatch.</p>
              </div>

              <button onClick={() => setAddRepoOpen(true)} className="group inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.10] bg-bg-elevated px-3.5 py-2 text-xs font-medium text-text-secondary shadow-sm transition-all duration-200 hover:border-accent-blue/30 hover:bg-accent-blue/5 hover:text-white">
                <GithubIcon className="h-4 w-4 text-text-muted transition-colors group-hover:text-accent-blue" />
                <span>Add repository</span>
                <Plus className="h-3.5 w-3.5 text-text-muted transition-transform duration-200 group-hover:rotate-90 group-hover:text-accent-blue" />
              </button>
            </div>

            {loading || contextLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((item) => (
                  <div key={item} className="h-40 animate-pulse rounded-xl border border-border-subtle bg-bg-secondary" />
                ))}
              </div>
            ) : repositories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle bg-bg-secondary p-12 text-center">
                <FolderGit2 className="mx-auto h-8 w-8 text-text-muted" />
                <h3 className="mt-4 font-medium">No repositories found</h3>
                <p className="mt-2 text-sm text-text-secondary">No repositories are currently available through this GitHub App installation.</p>

                <button onClick={() => setAddRepoOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-text-secondary transition hover:border-accent-blue/30 hover:text-white">
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
                    className="group w-full cursor-pointer rounded-xl border border-border-subtle bg-bg-secondary p-5 text-left transition-all hover:border-white/15 hover:bg-bg-elevated"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                          <FolderGit2 className="h-5 w-5 text-accent-blue" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-medium text-text-primary">{repo.name}</h3>
                          <p className="mt-1 truncate font-mono-code text-xs text-text-muted">{repo.fullName}</p>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-white" />
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

                      <span className="font-mono-code text-[10px] uppercase tracking-wider text-text-muted">Ready to scan</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {addRepoOpen && <AddRepositoryModal onClose={() => setAddRepoOpen(false)} onManage={handleManageGitHubAccess} />}
    </div>
  );
}

function AddRepositoryModal({ onClose, onManage }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0D0F12] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
              <GithubIcon className="h-5 w-5 text-white" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-primary">Add repository</h3>
              <p className="mt-1 text-xs text-text-muted">Connect another repository to SecurePatch.</p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition hover:bg-white/[0.05] hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent-blue/20 bg-accent-blue/10">
                <span className="font-mono-code text-xs text-accent-blue">i</span>
              </div>

              <div>
                <p className="text-xs font-medium text-text-primary">Manage repository access through GitHub</p>
                <p className="mt-1.5 text-xs leading-5 text-text-secondary">SecurePatch can only access repositories that are authorized through its GitHub App installation.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Step number="01" title="Open GitHub App settings" description="Manage which repositories SecurePatch can access." />
            <Step number="02" title="Select a repository" description="Grant SecurePatch access to the repository you want to scan." />
            <Step number="03" title="Return to SecurePatch" description="Refresh this page to load the newly authorized repository." />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-xs font-medium text-text-secondary transition hover:border-white/[0.15] hover:text-white">
            Cancel
          </button>

          <button onClick={onManage} className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-white/90">
            <GithubIcon className="h-4 w-4" />
            Manage GitHub Access
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.025]">
        <span className="font-mono-code text-[9px] text-text-muted">{number}</span>
      </div>

      <div className="pt-0.5">
        <p className="text-xs font-medium text-text-primary">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-text-muted">{description}</p>
      </div>
    </div>
  );
}
