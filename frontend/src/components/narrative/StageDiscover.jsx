import React, { useState } from 'react';
import { Search, Code2, ShieldAlert, Cpu, AlertCircle } from 'lucide-react';
import { SeverityPill } from '../ui/SeverityPill';

export function StageDiscover() {
  const [selectedScanner, setSelectedScanner] = useState('all');

  const findings = [
    {
      id: 'FIND-01',
      category: 'SQL Injection',
      cwe: 'CWE-89',
      file: 'src/routes/auth.js',
      line: 124,
      severity: 'Critical',
      scanner: 'Semgrep',
      message: 'Direct concatenation of untrusted input inside SQL query',
      engineRule: 'javascript.express.security.sql-concat'
    },
    {
      id: 'FIND-02',
      category: 'Command Injection',
      cwe: 'CWE-78',
      file: 'services/transcoder.py',
      line: 67,
      severity: 'Critical',
      scanner: 'Bandit',
      message: 'subprocess call with shell=True and user-controlled arguments',
      engineRule: 'B602:subprocess_popen_with_shell_equals_true'
    },
    {
      id: 'FIND-03',
      category: 'Hardcoded Secret',
      cwe: 'CWE-798',
      file: 'config/mailer.js',
      line: 19,
      severity: 'High',
      scanner: 'Trivy',
      message: 'Detected high-entropy AWS API secret token in committed source',
      engineRule: 'secret-aws-access-key-id'
    },
    {
      id: 'FIND-04',
      category: 'Server-Side Request Forgery',
      cwe: 'CWE-918',
      file: 'routers/webhooks.py',
      line: 43,
      severity: 'High',
      scanner: 'OWASP ZAP',
      message: 'Unvalidated external URL parameter invoked without private IP checks',
      engineRule: 'zap-ssrf-rule-90021'
    }
  ];

  const filteredFindings = selectedScanner === 'all'
    ? findings
    : findings.filter((f) => f.scanner.toLowerCase() === selectedScanner.toLowerCase());

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0D0F12] p-5 sm:p-6 shadow-card text-left">
      {/* Visual Subtitle & Scanner Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 font-mono text-xs text-text-secondary">
          <Code2 className="w-4 h-4 text-[#60A5FA]" />
          <span>Multi-Scanner Normalization Pipeline</span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] bg-black/40 p-1 rounded-lg border border-white/[0.06]">
          {['all', 'Semgrep', 'Bandit', 'Trivy', 'OWASP ZAP'].map((s) => (
            <button
              key={s}
              onClick={() => setSelectedScanner(s)}
              className={`px-2.5 py-1 rounded transition-all ${
                selectedScanner === s
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Progressive Finding Feed */}
      <div className="mt-4 space-y-3">
        {filteredFindings.map((finding) => (
          <div
            key={finding.id}
            className="group relative rounded-lg border border-white/[0.06] bg-[#111419] p-3.5 hover:border-white/[0.15] transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-1.5 rounded bg-white/[0.04] border border-white/[0.06] text-[#60A5FA] shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-[#F5F7FA]">
                      {finding.category}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-text-muted border border-white/[0.06]">
                      {finding.cwe}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">
                      {finding.file}:{finding.line}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-1">
                    {finding.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <span className="text-[10px] font-mono text-text-muted bg-white/[0.02] px-2 py-0.5 rounded border border-white/[0.04]">
                  {finding.scanner}
                </span>
                <SeverityPill severity={finding.severity} size="sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ingestion Pipeline Telemetry */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-xs font-mono text-text-muted">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
          <span>Raw scanner streams normalized to common AST schema</span>
        </div>
        <span className="text-text-secondary">4 Scanners · 19 Findings Normalized</span>
      </div>
    </div>
  );
}
