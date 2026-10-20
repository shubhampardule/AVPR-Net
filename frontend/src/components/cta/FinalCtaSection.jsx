import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FinalCtaSection() {
  return (
    <section className="border-t border-white/[0.07] bg-[#141A1B] py-16 text-left sm:py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#A8B9AF]">Get started</p>
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[#E8EEEB] sm:text-3xl">Connect your repositories.</h2>
          <p className="max-w-2xl text-sm leading-6 text-[#AEB9B3]">Sign in, select an organization, then authorize repositories through its GitHub App installation.</p>
        </div>

        <Link
          to="/login"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-md bg-[#78A88B] px-4 py-2.5 text-sm font-semibold text-[#101916] transition-colors hover:bg-[#8DB89C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A2C7AE] md:self-auto"
        >
          Continue to sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
