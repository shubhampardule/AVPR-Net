import React, { useState } from 'react';
import { X, UploadCloud, Link as LinkIcon, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';

export function ScanModal({ isOpen, onClose, defaultTab = 'scan' }) {
  const [activeSource, setActiveSource] = useState('github'); // 'github' | 'zip' | 'url'
  const [repoUrl, setRepoUrl] = useState('https://github.com/org/backend-api');
  const [selectedRepo, setSelectedRepo] = useState('backend-api');
  const [scanState, setScanState] = useState('idle'); // 'idle' | 'queued' | 'running' | 'completed'

  if (!isOpen) return null;

  const handleStartSimulatedScan = () => {
    setScanState('queued');
    setTimeout(() => setScanState('running'), 1000);
    setTimeout(() => {
      setScanState('completed');
    }, 2800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.1] bg-[#0D0F12] shadow-2xl overflow-hidden text-left font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#111419] border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#4ADE80]" />
            <h3 className="text-sm font-semibold text-[#F5F7FA]">
              {defaultTab === 'login' ? 'Authentication · SecurePatch' : 'Connect Repository · Start Scan'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {defaultTab === 'login' ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#111419] border border-white/[0.08] flex items-center justify-center mx-auto text-[#4ADE80]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-text-primary">Sign in to SecurePatch</h4>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  Access organization repositories, scan histories, and verified remediation diffs.
                </p>
              </div>

              <div className="pt-2 max-w-xs mx-auto">
                <button
                  onClick={() => {
                    alert('Connecting via Google OAuth session...');
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-white text-black font-medium text-xs flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              <p className="text-[10px] text-text-muted">
                Role-based access: Owner, Admin, Developer tiers.
              </p>
            </div>
          ) : (
            <>
              {/* Repository Source Picker */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-text-muted">
                  Select Repository Source
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setActiveSource('github')}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      activeSource === 'github'
                        ? 'bg-white/10 text-white border-white/20 font-medium'
                        : 'bg-[#111419] text-text-muted border-white/[0.06] hover:text-text-primary'
                    }`}
                  >
                    <Github className="w-4 h-4 mx-auto mb-1.5 text-[#4ADE80]" />
                    <span className="text-xs block">GitHub App</span>
                  </button>

                  <button
                    onClick={() => setActiveSource('zip')}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      activeSource === 'zip'
                        ? 'bg-white/10 text-white border-white/20 font-medium'
                        : 'bg-[#111419] text-text-muted border-white/[0.06] hover:text-text-primary'
                    }`}
                  >
                    <UploadCloud className="w-4 h-4 mx-auto mb-1.5 text-[#60A5FA]" />
                    <span className="text-xs block">Upload ZIP</span>
                  </button>

                  <button
                    onClick={() => setActiveSource('url')}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      activeSource === 'url'
                        ? 'bg-white/10 text-white border-white/20 font-medium'
                        : 'bg-[#111419] text-text-muted border-white/[0.06] hover:text-text-primary'
                    }`}
                  >
                    <LinkIcon className="w-4 h-4 mx-auto mb-1.5 text-[#FBBF24]" />
                    <span className="text-xs block">Repo URL</span>
                  </button>
                </div>
              </div>

              {/* Source-specific input */}
              {activeSource === 'github' && (
                <div className="space-y-2">
                  <label className="text-xs text-text-muted uppercase">Select Authorized Repository</label>
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="w-full bg-[#111419] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#4ADE80]"
                  >
                    <option value="backend-api">securepatch-org / backend-api (JavaScript)</option>
                    <option value="media-worker">securepatch-org / media-worker (Python)</option>
                    <option value="auth-service">securepatch-org / auth-service (Node.js)</option>
                  </select>
                </div>
              )}

              {activeSource === 'zip' && (
                <div className="p-6 rounded-lg border-2 border-dashed border-white/[0.1] text-center space-y-2 hover:border-white/[0.2] transition-colors cursor-pointer">
                  <UploadCloud className="w-6 h-6 mx-auto text-[#60A5FA]" />
                  <p className="text-xs text-text-primary">Drag & drop project .zip archive here</p>
                  <p className="text-[10px] text-text-muted">Node.js or Python projects up to 50MB</p>
                </div>
              )}

              {activeSource === 'url' && (
                <div className="space-y-2">
                  <label className="text-xs text-text-muted uppercase">Repository Git URL</label>
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="w-full bg-[#111419] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-[#4ADE80]"
                    placeholder="https://github.com/org/repo.git"
                  />
                </div>
              )}

              {/* Scan Execution Feedback */}
              {scanState === 'queued' && (
                <div className="p-3 rounded-lg bg-[#111419] border border-[#60A5FA]/30 flex items-center gap-3 text-xs text-[#60A5FA]">
                  <span className="w-2 h-2 rounded-full bg-[#60A5FA] animate-ping" />
                  <span>Job Queued in BullMQ (Job #SP-1092)</span>
                </div>
              )}

              {scanState === 'running' && (
                <div className="p-3 rounded-lg bg-[#111419] border border-[#FBBF24]/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#FBBF24]">
                    <span>Orchestrating Semgrep + Bandit in Docker Sandbox...</span>
                    <span>45%</span>
                  </div>
                  <div className="w-full h-1 rounded bg-black overflow-hidden">
                    <div className="h-full bg-[#FBBF24] w-1/2 animate-pulse" />
                  </div>
                </div>
              )}

              {scanState === 'completed' && (
                <div className="p-3 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/30 flex items-center justify-between text-xs text-[#4ADE80]">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>Scan Complete: 19 Findings Normalized & Correlated</span>
                  </div>
                  <a href="#playground" onClick={onClose} className="underline text-text-primary font-bold">
                    View Findings →
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartSimulatedScan}
                  disabled={scanState === 'running'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-[#08090B] bg-[#4ADE80] hover:bg-[#3ecf74] transition-all shadow-subtle-glow disabled:opacity-50"
                >
                  <span>{scanState === 'completed' ? 'Run Rescan' : 'Initiate Security Scan'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
