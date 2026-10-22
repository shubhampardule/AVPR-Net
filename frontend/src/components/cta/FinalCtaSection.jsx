import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FinalCtaSection() {
  return (
    <section className="border-t border-text-primary/[0.07] bg-bg-secondary py-16 text-left sm:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">Get started</p>
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-text-primary sm:text-3xl">Connect your repositories.</h2>
          <p className="max-w-2xl text-sm leading-6 text-text-secondary">Sign in, select an organization, then authorize repositories through its GitHub App installation.</p>
        </div>

        <Link
          to="/login"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-md bg-accent-security px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-security focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-security md:self-auto"
        >
          Continue to sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
