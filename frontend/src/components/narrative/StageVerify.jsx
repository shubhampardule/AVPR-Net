import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, Check, ArrowRight, Activity, Terminal, Boxes } from 'lucide-react';
import { RiskGauge } from '../ui/RiskGauge';

export function StageVerify() {
  const [activeStep, setActiveStep] = useState(3); // 1: OPEN, 2: PATCHED, 3: VERIFIED

  const checks = [
    { title: 'Syntax & AST Compilation Check', detail: 'ES2022 / Python 3.11 validator passed with 0 syntax errors', status: 'Passed' },
    { title: 'Project Test Suite Execution', detail: '18 unit & integration tests executed in isolated container without regressions', status: 'Passed' },
    { title: 'Full Security Rescan (Semgrep + Bandit)', detail: 'Zero remaining CWE-89 or taint patterns in modified call tree', status: 'Passed' },
    { title: 'Original Vulnerability Elimination', detail: 'Fingerprint VUL-NODE-089 marked resolved; attack payload rejected', status: 'Passed' },
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0D0F12] p-5 sm:p-6 shadow-card text-left">
      {/* State Progress Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-[#4ADE80]" />
          <span className="font-mono text-xs text-text-secondary">
            M7 Ephemeral Docker Sandbox Execution
          </span>
        </div>

        {/* State Transition Indicator */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
            <span>OPEN</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" />
            <span>PATCHED</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/30 font-semibold shadow-subtle-glow">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>VERIFIED</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Verification Checklist */}
        <div className="lg:col-span-7 space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-2">
            Automated Verification Gateways
          </div>
          {checks.map((check) => (
            <div
              key={check.title}
              className="flex items-start gap-3 p-3 rounded-lg bg-[#111419] border border-white/[0.06]"
            >
              <div className="p-1 rounded bg-[#4ADE80]/10 text-[#4ADE80] shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary">
                    {check.title}
                  </span>
                  <span className="text-[10px] font-mono text-[#4ADE80] bg-[#4ADE80]/10 px-1.5 py-0.2 rounded">
                    {check.status}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-text-muted mt-0.5">
                  {check.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Clean Security Overview & Risk Drop */}
        <div className="lg:col-span-5 space-y-4">
          {/* Risk Drop Comparison Card */}
          <div className="p-4 rounded-xl bg-[#111419] border border-white/[0.08] text-center">
            <div className="text-[11px] font-mono uppercase text-text-muted tracking-wider mb-2">
              Vulnerability Risk Transformation
            </div>
            <div className="flex items-center justify-center gap-4">
              <div>
                <span className="text-[10px] font-mono text-text-muted block">BEFORE</span>
                <span className="font-mono text-2xl font-bold text-[#F87171]">9.4</span>
                <span className="text-[10px] font-mono text-[#F87171] block">Critical</span>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted" />
              <div>
                <span className="text-[10px] font-mono text-text-muted block">AFTER</span>
                <span className="font-mono text-2xl font-bold text-[#4ADE80]">0.0</span>
                <span className="text-[10px] font-mono text-[#4ADE80] block">Resolved</span>
              </div>
            </div>
          </div>

          {/* Clean Security Overview */}
          <div className="p-4 rounded-xl bg-[#111419] border border-[#4ADE80]/20 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <span className="text-[11px] font-mono text-text-muted block">REPOSITORY POSTURE</span>
                <span className="text-xs font-semibold text-text-primary">Clean Security Baseline</span>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] text-text-muted block">OVERALL RISK</span>
                <span className="text-sm font-bold text-[#4ADE80]">2.4 / 10</span>
              </div>
            </div>

            {/* Exact PRD Numbers: Critical: 0, High: 1, Medium: 3, Low: 5 */}
            <div className="grid grid-cols-4 gap-2 text-center pt-3 font-mono text-xs">
              <div className="p-2 rounded bg-black/40 border border-white/[0.04]">
                <span className="text-[10px] text-[#F87171] block">CRITICAL</span>
                <span className="text-sm font-bold text-text-primary">0</span>
              </div>
              <div className="p-2 rounded bg-black/40 border border-white/[0.04]">
                <span className="text-[10px] text-[#FB923C] block">HIGH</span>
                <span className="text-sm font-bold text-text-primary">1</span>
              </div>
              <div className="p-2 rounded bg-black/40 border border-white/[0.04]">
                <span className="text-[10px] text-[#FBBF24] block">MEDIUM</span>
                <span className="text-sm font-bold text-text-primary">3</span>
              </div>
              <div className="p-2 rounded bg-black/40 border border-white/[0.04]">
                <span className="text-[10px] text-[#4ADE80] block">LOW</span>
                <span className="text-sm font-bold text-text-primary">5</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
