import React from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RepositoryPreview } from './RepositoryPreview';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] bg-[#101416] pt-28 pb-16 sm:pt-32 sm:pb-20 lg:min-h-[680px] lg:pt-36 lg:pb-24">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:px-10">
        <div className="space-y-7 text-left lg:col-span-5">
          <p className="flex items-center gap-3 text-sm font-medium text-[#A8B9AF]">
            <span className="h-px w-8 bg-[#78A88B]" />
            Repository security review
          </p>

          <div className="space-y-5">
            <h1 className="max-w-xl text-[2.65rem] font-semibold leading-[1.08] tracking-[-0.045em] text-[#E8EEEB] sm:text-5xl lg:text-[3.65rem]">
              Review security findings in their source context.
            </h1>
            <p className="max-w-lg text-base leading-7 text-[#B1BCB6] sm:text-lg">
              SecurePatch brings scanner results, repository history, and proposed changes into one review flow. Your team decides what reaches GitHub.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#78A88B] px-4 py-2.5 text-sm font-semibold text-[#101916] transition-colors hover:bg-[#8DB89C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A2C7AE]"
            >
              Connect a repository
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#playground"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-[#E8EEEB] transition-colors hover:border-white/30 hover:bg-white/[0.04]"
            >
              View an example
              <ArrowDown className="h-4 w-4 text-[#A8B9AF]" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-7">
          <RepositoryPreview />
        </div>
      </div>
    </section>
  );
}
