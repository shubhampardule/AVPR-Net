import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { API_BASE_URL } from '../config/api';
import { GithubIcon } from '../components/ui/GithubIcon';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { BrandLockup } from '../components/ui/BrandLogo';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const query = new URLSearchParams(window.location.search);
  const errorCode = query.get('error');
  const returnTo = query.get('returnTo');
  const authUrl = (provider) => `${API_BASE_URL}/auth/${provider}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  const errors = {
    github_unavailable: 'GitHub sign-in is not configured yet.',
    github_state: 'The sign-in request expired. Please try again.',
    github_denied: 'GitHub sign-in was not completed. Please try again.',
    github_email: 'Add a verified email address to your GitHub account, then try again.',
    github_conflict: 'This GitHub account is already linked to another account. Sign in to that account first.',
    account_inactive: 'Your account is inactive.',
  };

  const startSignIn = (provider) => {
    setIsLoading(true);
    window.location.href = authUrl(provider);
  };

  return (
    <main className="min-h-screen bg-[#101416] text-[#E8EEEB]">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="/" className="inline-flex items-center gap-2.5 text-[#E8EEEB]" aria-label="SecurePatch home">
            <BrandLockup wordmarkClassName="text-base" />
          </a>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#AEB9B3] transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Return home
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:px-10">
        <div className="max-w-xl space-y-6 lg:col-span-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A8B9AF]">SecurePatch workspace</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#E8EEEB] sm:text-4xl lg:text-5xl">
            Review repository security in one workspace.
          </h1>
          <p className="max-w-lg text-base leading-7 text-[#AEB9B3]">
            Sign in with GitHub or Google, then choose an organization and authorize its repositories.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md lg:col-span-6 lg:justify-self-end">
          <div className="rounded-xl border border-white/[0.1] bg-[#171D1F] p-6 shadow-card sm:p-8">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#E8EEEB]">Sign in to SecurePatch</h2>
            <p className="mt-2 text-sm leading-6 text-[#AEB9B3]">Choose an account to continue.</p>

            {errorCode && <p role="alert" className="mt-5 rounded-md border border-red-400/25 bg-red-400/[0.06] p-3 text-sm leading-5 text-red-200">{errors[errorCode] || 'Sign-in failed. Please try again.'}</p>}

            <div className="mt-6 space-y-3">
              <button type="button" disabled={isLoading} onClick={() => startSignIn('github')} className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-white/[0.16] bg-[#202729] text-sm font-semibold text-[#E8EEEB] transition-colors hover:bg-[#263032] disabled:cursor-wait disabled:opacity-60">
                <GithubIcon className="h-4 w-4" aria-hidden="true" /> Continue with GitHub
              </button>
              <button type="button" disabled={isLoading} onClick={() => startSignIn('google')} className="flex h-11 w-full items-center justify-center gap-3 rounded-md bg-white text-sm font-semibold text-[#202729] transition-colors hover:bg-[#E8EEEB] disabled:cursor-wait disabled:opacity-60">
                <GoogleIcon /> Continue with Google
              </button>
            </div>

            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <p className="text-xs leading-5 text-[#89968F]">Repository access is controlled by each organization’s GitHub App installation.</p>
              <p className="mt-4 text-xs font-medium text-[#A8B9AF]" role={isLoading ? 'status' : undefined}>{isLoading ? 'Connecting to your account…' : 'You can choose a repository after signing in.'}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18A11.98 11.98 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}
