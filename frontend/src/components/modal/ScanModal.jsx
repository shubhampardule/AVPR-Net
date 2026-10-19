import React from 'react';
import { X, ArrowRight, ShieldCheck } from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';
import { API_BASE_URL } from '../../config/api';

export function ScanModal({ isOpen, onClose, defaultTab = 'scan' }) {
  if (!isOpen) return null;
  const login = defaultTab === 'login';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="scan-dialog-title" onClick={(event) => event.stopPropagation()} className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0D0F12] text-left shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <ShieldCheck className="h-5 w-5 text-[#4ADE80]" />
          <button type="button" aria-label="Close dialog" onClick={onClose} className="rounded-lg p-1 text-text-muted hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-6">
          <h2 id="scan-dialog-title" className="text-xl font-semibold">{login ? 'Sign in to SecurePatch' : 'Scan your GitHub repository'}</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{login ? 'Access your workspaces, repositories, and scan results.' : 'Open your workspace, connect your GitHub App installation, and choose a repository to scan.'}</p>
          {login ? <div className="mt-6 space-y-3">
            <a href={`${API_BASE_URL}/auth/github`} className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/15 bg-[#181B20] px-4 py-3 text-sm font-medium hover:bg-[#242830]"><GithubIcon className="h-4 w-4" /> Continue with GitHub</a>
            <a href={`${API_BASE_URL}/auth/google`} className="flex w-full items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-medium text-black hover:bg-gray-100">Continue with Google</a>
          </div> : <a href="/github" className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4ADE80] px-4 py-3 text-sm font-semibold text-black hover:bg-[#4ADE80]/90">Open repositories <ArrowRight className="h-4 w-4" /></a>}
        </div>
      </section>
    </div>
  );
}
