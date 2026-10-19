import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, ChevronRight, RefreshCw, Terminal, Layers, ArrowRight } from 'lucide-react';
import { SeverityPill } from '../ui/SeverityPill';

export function CodeScannerTerminal() {
  const [activeStep, setActiveStep] = useState(1); // 1: Scanning/Detect, 2: Risk Breakdown, 3: Patch Generation, 4: Verification
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev % 4) + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const steps = [
    { id: 1, label: 'Detection', tag: 'CWE-89' },
    { id: 2, label: 'Risk Analysis', tag: 'Score 9.4' },
    { id: 3, label: 'Patch Generated', tag: 'Diff Ready' },
    { id: 4, label: 'Verified', tag: 'Risk 0.0' },
  ];

  return (
    <div
      className="relative rounded-xl border border-white/[0.1] bg-[#0D0F12] shadow-2xl overflow-hidden text-left"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111419] border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
          </div>
          <span className="ml-2 text-white/20">|</span>
          <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
            <Terminal className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span className="text-text-secondary">backend-api</span>
            <span>/</span>
            <span className="text-text-primary">src/routes/auth.js</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            Semgrep + Bandit Pipeline
          </span>
        </div>
      </div>

      {/* Step Indicators / Interactive Tabs */}
      <div className="grid grid-cols-4 border-b border-white/[0.06] bg-[#090B0E] text-[11px] font-mono">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => {
              setIsAutoPlaying(false);
              setActiveStep(step.id);
            }}
            className={`py-2 px-2 text-center transition-all border-b-2 flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeStep === step.id
                ? 'border-[#4ADE80] text-text-primary bg-white/[0.03]'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className="text-[10px] text-text-muted">0{step.id}</span>
            <span className="font-medium truncate">{step.label}</span>
          </button>
        ))}
      </div>

      {/* Code Editor Body */}
      <div className="p-4 sm:p-5 font-mono text-xs leading-relaxed overflow-x-auto bg-[#0A0C0E]">
        <div className="space-y-1">
          <div className="text-text-muted/60">// Line 121: POST /api/v1/auth/login endpoint handler</div>
          <div className="text-text-secondary">
            <span className="text-[#60A5FA]">router</span>.<span className="text-[#38BDF8]">post</span>(
            <span className="text-[#4ADE80]">'/login'</span>, <span className="text-[#60A5FA]">async</span> (req, res) =&gt; &#123;
          </div>
          <div className="pl-4 text-text-secondary">
            <span className="text-[#60A5FA]">const</span> &#123; username, password &#125; = req.body;
          </div>
          
          {/* Highlighted Vulnerable / Remediated Line */}
          <div className="my-2">
            {activeStep <= 2 ? (
              <div className="relative p-2.5 rounded bg-[#F87171]/10 border-l-2 border-[#F87171] text-[#F87171] text-[12px] transition-all">
                <div className="flex items-center justify-between pb-1 text-[10px] uppercase font-mono text-[#F87171] tracking-wider">
                  <span className="flex items-center gap-1 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Line 124 · Unsanitized Query String Interpolation
                  </span>
                  <SeverityPill severity="Critical" size="sm" />
                </div>
                <div className="whitespace-pre">
                  - const query = "SELECT * FROM users WHERE name = '" + username + "'";
                </div>
              </div>
            ) : (
              <div className="relative p-2.5 rounded bg-[#4ADE80]/10 border-l-2 border-[#4ADE80] text-[#4ADE80] text-[12px] transition-all">
                <div className="flex items-center justify-between pb-1 text-[10px] uppercase font-mono text-[#4ADE80] tracking-wider">
                  <span className="flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Line 124 · Parameterized SQL Query (SecurePatch Automated Fix)
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#4ADE80]/20 text-[#4ADE80] font-mono font-semibold">
                    Verified
                  </span>
                </div>
                <div className="whitespace-pre">
                  + const query = "SELECT * FROM users WHERE name = $1";
                </div>
                <div className="whitespace-pre text-emerald-300/90 pl-2">
                  + const result = await db.query(query, [username]);
                </div>
              </div>
            )}
          </div>

          <div className="pl-4 text-text-secondary">
            <span className="text-[#60A5FA]">const</span> result = <span className="text-[#60A5FA]">await</span> db.query(query);
          </div>
          <div className="pl-4 text-text-secondary">
            <span className="text-[#60A5FA]">return</span> res.json(&#123; user: result.rows[0] &#125;);
          </div>
          <div className="text-text-secondary">&#125;);</div>
        </div>
      </div>

      {/* Dynamic Telemetry Layer based on active step */}
      <div className="p-4 bg-[#111419] border-t border-white/[0.08] text-xs">
        {activeStep === 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-text-secondary">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F87171] animate-ping" />
              <span className="font-mono text-text-primary font-medium">Finding: CWE-89 (SQL Injection)</span>
              <span className="text-text-muted">|</span>
              <span className="text-text-muted text-[11px] font-mono">Matched: Semgrep Rule javascript.express.sqli</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-[#F87171]">
              Severity: Critical
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="bg-[#0D0F12] p-2 rounded border border-white/[0.06]">
              <span className="text-text-muted text-[10px] block">EXPLOITABILITY</span>
              <span className="text-text-primary font-bold">9.2 / 10 (Direct)</span>
            </div>
            <div className="bg-[#0D0F12] p-2 rounded border border-white/[0.06]">
              <span className="text-text-muted text-[10px] block">ATTACK SURFACE</span>
              <span className="text-[#F87171] font-bold">Public REST API</span>
            </div>
            <div className="bg-[#0D0F12] p-2 rounded border border-white/[0.06]">
              <span className="text-text-muted text-[10px] block">OCCURRENCE</span>
              <span className="text-text-primary font-bold">M3 Correlated (2x)</span>
            </div>
            <div className="bg-[#0D0F12] p-2 rounded border border-white/[0.06]">
              <span className="text-text-muted text-[10px] block">TOTAL RISK</span>
              <span className="text-[#F87171] font-bold">9.4 · Priority P1</span>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-text-secondary">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#60A5FA]" />
              <span className="font-mono text-text-primary font-medium">Targeted Unified Diff Generated</span>
              <span className="text-text-muted font-mono text-[11px]">Branch: securepatch/fix-VUL-NODE-089</span>
            </div>
            <span className="text-[11px] font-mono text-[#4ADE80]">
              Preserves 100% route signature & types
            </span>
          </div>
        )}

        {activeStep === 4 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-text-secondary">
            <div className="flex items-center gap-2 text-[#4ADE80] font-mono text-xs">
              <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
              <span>Sandbox Verification Passed (Syntax · 18/18 Tests · 0 Rescan Findings)</span>
            </div>
            <div className="font-mono text-[11px] bg-[#4ADE80]/10 text-[#4ADE80] px-2 py-0.5 rounded border border-[#4ADE80]/20">
              Risk Score: 9.4 → 0.0 (Resolved)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
