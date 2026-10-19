import React, { useState } from 'react';
import { Layers, ArrowDownUp, ShieldAlert, BarChart3, Filter } from 'lucide-react';
import { SeverityPill } from '../ui/SeverityPill';
import { RiskGauge } from '../ui/RiskGauge';

export function StagePrioritize() {
  const [selectedFinding, setSelectedFinding] = useState(0);

  const findings = [
    {
      title: 'SQL Injection',
      cwe: 'CWE-89',
      severity: 'Critical',
      riskScore: 9.2,
      priority: 'P1',
      exploitability: 9.4,
      businessImpact: 9.0,
      occurrence: '2 Scanner Alerts (Correlated)',
      attackSurface: 'Public REST Endpoint',
      inputControllability: 'Direct HTTP query argument'
    },
    {
      title: 'Hardcoded Cloud Secret',
      cwe: 'CWE-798',
      severity: 'High',
      riskScore: 7.8,
      priority: 'P2',
      exploitability: 8.2,
      businessImpact: 7.4,
      occurrence: 'Trivy + Semgrep Matched',
      attackSurface: 'Repository Artifacts & Git History',
      inputControllability: 'Static Key Extraction'
    },
    {
      title: 'Weak Cryptography (DES / MD5)',
      cwe: 'CWE-327',
      severity: 'Medium',
      riskScore: 5.4,
      priority: 'P3',
      exploitability: 4.8,
      businessImpact: 6.0,
      occurrence: 'Bandit AST Flag',
      attackSurface: 'Internal Session Token Generation',
      inputControllability: 'Cryptanalytic Collision Attack'
    }
  ];

  const current = findings[selectedFinding];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0D0F12] p-5 sm:p-6 shadow-card text-left">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 font-mono text-xs text-text-secondary">
          <Layers className="w-4 h-4 text-[#818CF8]" />
          <span>M3 Correlation & M4 Risk Engine</span>
        </div>
        <span className="text-[11px] font-mono text-text-muted">
          Explainable Multi-Factor Formula
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Prioritized Finding List */}
        <div className="lg:col-span-6 space-y-2.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-1">
            Correlated Intelligence Queue
          </div>
          {findings.map((f, i) => (
            <div
              key={f.title}
              onClick={() => setSelectedFinding(i)}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                selectedFinding === i
                  ? 'border-white/[0.18] bg-[#151921] shadow-md'
                  : 'border-white/[0.06] bg-[#111419] hover:border-white/[0.1]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-text-muted">
                    #{i + 1}
                  </span>
                  <span className="text-xs font-semibold text-[#F5F7FA]">
                    {f.title}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {f.cwe}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <SeverityPill severity={f.severity} size="sm" />
                  <span className="font-mono text-xs font-bold text-text-primary bg-white/[0.04] px-1.5 py-0.5 rounded">
                    {f.riskScore.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-[11px] font-mono text-text-muted flex items-center justify-between">
                <span>{f.occurrence}</span>
                <span className="text-[#60A5FA] font-medium">Priority {f.priority}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Detailed Risk Factor Breakdown */}
        <div className="lg:col-span-6 rounded-lg border border-white/[0.08] bg-[#111419] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
                Calculated Risk Assessment
              </span>
              <h4 className="text-sm font-semibold text-text-primary mt-0.5">
                {current.title}
              </h4>
            </div>
            <RiskGauge score={current.riskScore} size={84} strokeWidth={7} />
          </div>

          <div className="mt-4 space-y-3 font-mono text-xs">
            {/* Factor 1: Exploitability */}
            <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/[0.04]">
              <span className="text-text-muted text-[11px]">Exploitability</span>
              <span className="text-text-primary font-semibold">{current.exploitability.toFixed(1)} / 10</span>
            </div>

            {/* Factor 2: Business Impact */}
            <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/[0.04]">
              <span className="text-text-muted text-[11px]">Business Impact</span>
              <span className="text-text-primary font-semibold">{current.businessImpact.toFixed(1)} / 10</span>
            </div>

            {/* Factor 3: Attack Surface */}
            <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/[0.04]">
              <span className="text-text-muted text-[11px]">Attack Surface</span>
              <span className="text-text-primary truncate max-w-[200px]">{current.attackSurface}</span>
            </div>

            {/* Factor 4: Occurrence Correlation */}
            <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/[0.04]">
              <span className="text-text-muted text-[11px]">Correlation</span>
              <span className="text-[#4ADE80]">{current.occurrence}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
