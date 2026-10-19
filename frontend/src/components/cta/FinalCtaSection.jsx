import React from 'react';
import { ArrowRight, ShieldCheck, Terminal } from 'lucide-react';

export function FinalCtaSection({ onOpenScanModal }) {
  return (
    <section className="relative py-28 border-t border-white/[0.06] bg-[#0A0C0E] overflow-hidden text-center">
      {/* Background subtle accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-[#4ADE80]/[0.03] blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-text-secondary tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
          Production-Ready Security
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#F5F7FA]">
          Ship code with fewer unknowns.
        </h2>

        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          SecurePatch helps engineering teams find, understand, prioritize, and remediate security vulnerabilities before they become someone else's problem.
        </p>

        {/* Action CTAs */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onOpenScanModal}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-xs font-mono font-medium text-[#08090B] bg-[#4ADE80] hover:bg-[#3ecf74] transition-all shadow-subtle-glow group cursor-pointer"
          >
            <span>Start scanning</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <a
            href="#workflow"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-xs font-mono font-medium text-text-primary bg-[#111419] hover:bg-[#161b22] border border-white/[0.08] hover:border-white/[0.15] transition-all"
          >
            <span>Explore SecurePatch</span>
          </a>
        </div>

        {/* Supporting Line */}
        <div className="pt-6">
          <p className="text-xs font-mono text-text-muted">
            Built for developers. Designed for security teams.
          </p>
        </div>
      </div>
    </section>
  );
}
