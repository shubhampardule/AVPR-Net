import React from 'react';
import { ArrowRight, Terminal, ShieldCheck, ChevronRight, Play } from 'lucide-react';
import { CodeScannerTerminal } from './CodeScannerTerminal';
import { Link } from 'react-router-dom';

export function HeroSection({ onOpenScanModal }) {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center pt-28 pb-16 overflow-hidden tech-grid">
      {/* Background ambient lighting - strictly restrained, not a giant purple blob */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-b from-[#4ADE80]/[0.04] to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left / Editorial Typography */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-text-secondary tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
              AI-Assisted Code Security
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#F5F7FA] leading-[1.08]">
              Find the vulnerability.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5F7FA] via-white to-[#4ADE80]">
                Fix the risk.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl">
              SecurePatch analyzes source code, correlates scanner findings, calculates business risk, and generates verified patches—before security weaknesses become production incidents.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="px-5 py-3 text-xs font-mono font-semibold text-[#08090B] bg-[#4ADE80] rounded-lg shadow-subtle-glow flex items-center justify-center gap-1.5"
              >
                <span>Start scanning</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <a
                href="#workflow"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-mono font-medium text-text-primary bg-[#111419] hover:bg-[#161b22] border border-white/[0.08] hover:border-white/[0.15] transition-all"
              >
                <Play className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>See how it works</span>
              </a>
            </div>

            {/* Supported Trust Telemetry */}
            <div className="pt-6 border-t border-white/[0.06] flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-mono text-text-muted">
              <div className="flex items-center gap-1.5">
                <span className="text-[#4ADE80]">●</span>
                <span className="text-text-secondary font-medium">JavaScript & Python</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#60A5FA]">●</span>
                <span className="text-text-secondary font-medium">Semgrep + Bandit + Trivy + ZAP</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">●</span>
                <span className="text-text-secondary font-medium">Protected Git Branches</span>
              </div>
            </div>
          </div>

          {/* Right / Interactive Code & Remediation Visual */}
          <div className="lg:col-span-6 w-full">
            <div className="relative">
              {/* Subtle backdrop glow */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-white/[0.04] to-transparent blur-sm -z-10" />
              <CodeScannerTerminal />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
