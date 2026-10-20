import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ENTERPRISE_CAPABILITIES } from '../../data/scanners';

export function ArchitectureGrid() {
  return (
    <section id="capabilities" className="border-t border-white/[0.07] bg-[#101416] py-20 text-left sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <p className="text-sm font-medium text-[#A8B9AF]">Capabilities</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#E8EEEB] sm:text-4xl">
              Evidence and controls for each result.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-[#AEB9B3]">
              Review the source, scanner context, and patch checks behind a finding.
            </p>
            <a href="#workflow" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#A8C4B1] transition-colors hover:text-white">
              See the workflow <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <dl className="grid gap-x-8 sm:grid-cols-2 lg:col-span-8">
            {ENTERPRISE_CAPABILITIES.map((capability, index) => (
              <div key={capability.title} className="border-t border-white/[0.1] py-5">
                <dt className="flex items-baseline gap-3 text-sm font-semibold text-[#E8EEEB]">
                  <span className="font-mono-code text-[11px] font-normal text-[#819087]">0{index + 1}</span>
                  {capability.title}
                </dt>
                <dd className="mt-2 pl-8 text-sm leading-6 text-[#AEB9B3]">{capability.description}</dd>
              </div>
            ))}
          </dl>
        </div>

      </div>
    </section>
  );
}
