import React, { useState } from 'react';
import { StageDiscover } from './StageDiscover';
import { StagePrioritize } from './StagePrioritize';
import { StageRemediate } from './StageRemediate';
import { StageVerify } from './StageVerify';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function ScrollNarrative() {
  const [activeStage, setActiveStage] = useState(0);

  const stages = [
    {
      id: 'discover',
      step: '01',
      title: 'DISCOVER',
      headline: "See what's hiding in your code.",
      copy: "SecurePatch analyzes source code to identify security weaknesses before they become production incidents. Scans run with zero config across JavaScript and Python repositories.",
      badge: 'Multi-Scanner Ingestion',
      component: <StageDiscover />
    },
    {
      id: 'prioritize',
      step: '02',
      title: 'PRIORITIZE',
      headline: 'Not every vulnerability deserves the same urgency.',
      copy: 'Correlate findings, reduce noise, and focus your team on the vulnerabilities that matter most. The M3 correlation engine eliminates duplicates while M4 computes explainable CVSS-aligned risk.',
      badge: 'M3 Deduplication & M4 Risk',
      component: <StagePrioritize />
    },
    {
      id: 'remediate',
      step: '03',
      title: 'REMEDIATE',
      headline: 'From finding to fix.',
      copy: 'SecurePatch helps developers understand the issue and move from detection to practical remediation with minimal, targeted unified diffs on isolated branches.',
      badge: 'Targeted Patch Generation',
      component: <StageRemediate />
    },
    {
      id: 'verify',
      step: '04',
      title: 'VERIFY',
      headline: 'Fix it. Verify it. Move on.',
      copy: 'Security remediation is complete only when the fix has been verified. Ephemeral Docker containers test syntax, run test suites, and rescan before certifying risk elimination.',
      badge: 'Isolated Docker Verification',
      component: <StageVerify />
    }
  ];

  return (
    <section id="workflow" className="relative py-24 border-t border-white/[0.06] bg-[#08090B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-text-secondary tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
            End-to-End Security Workflow
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#F5F7FA]">
            From raw repository to verified safe code.
          </h2>
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed">
            Four coordinated stages convert raw scanner output into verified, zero-regression security patches.
          </p>

          {/* Interactive Navigation Timeline / Stepper */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2 font-mono text-xs">
            {stages.map((stg, index) => (
              <button
                key={stg.id}
                onClick={() => setActiveStage(index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  activeStage === index
                    ? 'bg-white/10 text-text-primary border-white/20 font-semibold shadow-subtle-glow'
                    : 'bg-[#0D0F12] text-text-muted hover:text-text-secondary border-white/[0.06]'
                }`}
              >
                <span className="text-[10px] text-[#4ADE80] font-bold">{stg.step}</span>
                <span>{stg.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Stage Content Area */}
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Stage Info */}
            <div className="lg:col-span-4 space-y-4 text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#4ADE80] bg-[#4ADE80]/10 px-2.5 py-1 rounded border border-[#4ADE80]/20">
                <span className="font-bold">{stages[activeStage].step}</span>
                <span>/ 04</span>
                <span className="text-white/20">|</span>
                <span>{stages[activeStage].badge}</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F7FA] leading-snug">
                {stages[activeStage].headline}
              </h3>

              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                {stages[activeStage].copy}
              </p>

              {/* Step progression buttons */}
              <div className="pt-4 flex items-center gap-3">
                {activeStage > 0 && (
                  <button
                    onClick={() => setActiveStage((prev) => prev - 1)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-mono bg-[#111419] border border-white/[0.08] text-text-muted hover:text-text-primary transition-colors"
                  >
                    ← Previous Stage
                  </button>
                )}
                {activeStage < 3 && (
                  <button
                    onClick={() => setActiveStage((prev) => prev + 1)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-medium text-[#08090B] bg-[#4ADE80] hover:bg-[#3ecf74] transition-all"
                  >
                    <span>Next: {stages[activeStage + 1].title}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Stage Interactive Visual Panel */}
            <div className="lg:col-span-8">
              {stages[activeStage].component}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
