import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, LockKeyhole, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

import { API_BASE_URL } from '../config/api';
import { GithubIcon } from '../components/ui/GithubIcon';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const errorCode = new URLSearchParams(window.location.search).get('error');
  const errors = {
    github_unavailable: 'GitHub sign-in is not configured yet.',
    github_state: 'The sign-in request expired. Please try again.',
    github_denied: 'GitHub sign-in was not completed. Please try again.',
    github_email: 'Add a verified email address to your GitHub account, then try again.',
    github_conflict: 'This GitHub account is already linked to another account. Sign in to that account first.',
    account_inactive: 'Your account is inactive.',
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);

    // Redirect to the backend Google OAuth endpoint.
    // The backend handles Google authentication and session creation.
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <main className="min-h-screen bg-[#08090B] text-[#F5F7FA] overflow-hidden relative">
      {/* Technical grid */}
      <div className="absolute inset-0 tech-grid opacity-40 pointer-events-none" />

      {/* Subtle ambient light */}
      <div className="absolute top-[-180px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#4ADE80]/[0.035] blur-3xl pointer-events-none" />

      {/* Top navigation */}
      <header className="relative z-10 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#111419] border border-white/[0.1] flex items-center justify-center transition-all group-hover:border-[#4ADE80]/50 group-hover:bg-[#4ADE80]/10">
              <ShieldCheck className="w-4 h-4 text-[#4ADE80] transition-transform group-hover:scale-110" />
            </div>

            <span className="font-mono text-base font-semibold tracking-tight text-[#F5F7FA]">
              Secure<span className="text-[#4ADE80]">Patch</span>
            </span>
          </a>

          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return home
          </a>
        </div>
      </header>

      {/* Login area */}
      <section className="relative z-10 min-h-[calc(100vh-81px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Small system indicator */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center mb-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.035] border border-white/[0.08] font-mono text-[10px] uppercase tracking-wider text-text-muted"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
              Secure authentication
            </div>
          </motion.div>

          {/* Login card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="rounded-2xl border border-white/[0.09] bg-[#0D0F12] shadow-elevated overflow-hidden"
          >
            {/* Card header */}
            <div className="px-6 sm:px-8 pt-8 pb-7 text-center border-b border-white/[0.06]">
              <div className="mx-auto w-12 h-12 rounded-xl bg-[#111419] border border-white/[0.09] flex items-center justify-center shadow-subtle-glow">
                <LockKeyhole className="w-5 h-5 text-[#4ADE80]" />
              </div>

              <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
                Secure your codebase.
              </h1>

              <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
                Sign in to access your SecurePatch security workspace, repositories,
                findings, and verified remediation workflows.
              </p>
            </div>

            {/* Card body */}
            <div className="px-6 sm:px-8 py-7">
              {errorCode && <p role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">{errors[errorCode] || 'Sign-in failed. Please try again.'}</p>}

              <button type="button" disabled={isLoading} onClick={() => {
                setIsLoading(true);
                window.location.href = `${API_BASE_URL}/auth/github`;
              }} className="mb-3 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-white/15 bg-[#181B20] text-sm font-medium transition hover:bg-[#242830] disabled:opacity-60">
                <GithubIcon className="h-4 w-4" /> Continue with GitHub
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full h-11 rounded-lg bg-white text-[#111419] hover:bg-[#F1F3F5] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 text-sm font-medium shadow-sm"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#111419]/20 border-t-[#111419] rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    {/* Google mark */}
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
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

                    Continue with Google
                  </>
                )}
              </button>

              {/* Security information */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#111419] border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
                    <span className="text-[10px] font-mono text-text-primary">
                      OAuth
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-text-muted">
                    GitHub or Google sign-in
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#111419] border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-[#60A5FA]" />
                    <span className="text-[10px] font-mono text-text-primary">
                      RBAC
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-text-muted">
                    Organization-level access
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
                <p className="text-[10px] font-mono text-text-muted leading-relaxed">
                  Sign in securely with GitHub or Google.
                  <br />
                  SecurePatch does not store your password.
                </p>
              </div>
            </div>

            {/* System footer */}
            <div className="px-6 py-3.5 bg-[#111419] border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider">
                SecurePatch Auth
              </span>

              <span className="flex items-center gap-1.5 text-[9px] font-mono text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                SYSTEM READY
              </span>
            </div>
          </motion.div>

          {/* Bottom text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 text-center text-[10px] font-mono text-text-muted"
          >
            Built for developers. Designed for security teams.
          </motion.p>
        </div>
      </section>
    </main>
  );
}
