import React from 'react';
import { ShieldCheck, Terminal, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#08090B] py-14 text-xs font-mono text-text-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Wordmark & Status */}
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#111419] border border-white/[0.1] flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
              </div>
              <span className="font-semibold text-sm text-[#F5F7FA]">
                Secure<span className="text-[#4ADE80]">Patch</span>
              </span>
            </div>
            <p className="text-text-secondary text-[12px] leading-relaxed">
              Software vulnerability detection, correlation, risk assessment, and verified patch generation platform.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.06] text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
              <span>Scanning Engines Operational</span>
            </div>
          </div>

          {/* Col 2: Supported Scanners */}
          <div className="space-y-3 text-left">
            <div className="text-[11px] uppercase tracking-wider text-text-primary font-bold">
              Integrated Scanners
            </div>
            <ul className="space-y-2 text-text-secondary text-[11px]">
              <li>Semgrep (SAST & Taint Analysis)</li>
              <li>Bandit (Python Security AST)</li>
              <li>Trivy (Vulnerabilities & Secrets)</li>
              <li>OWASP ZAP (Baseline Assessment)</li>
            </ul>
          </div>

          {/* Col 3: Core Capabilities */}
          <div className="space-y-3 text-left">
            <div className="text-[11px] uppercase tracking-wider text-text-primary font-bold">
              Capabilities
            </div>
            <ul className="space-y-2 text-text-secondary text-[11px]">
              <li>M3 Correlation & Deduplication</li>
              <li>M4 Multi-Factor Risk Assessment</li>
              <li>Unified Diff Patch Generation</li>
              <li>M7 Isolated Docker Verification</li>
              <li>Periodic Server-Side Schedules</li>
            </ul>
          </div>

          {/* Col 4: Platform & Languages */}
          <div className="space-y-3 text-left">
            <div className="text-[11px] uppercase tracking-wider text-text-primary font-bold">
              Architecture
            </div>
            <ul className="space-y-2 text-text-secondary text-[11px]">
              <li>Node.js / Express & Python</li>
              <li>MERN Stack Architecture</li>
              <li>Redis & BullMQ Job Workers</li>
              <li>Docker Sandbox Isolation</li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>
            © {new Date().getFullYear()} SecurePatch Platform. Built for defensive source-code security.
          </div>
          <div className="flex items-center gap-6">
            <a href="#product" className="hover:text-text-primary transition-colors">Product</a>
            <a href="#workflow" className="hover:text-text-primary transition-colors">Workflow</a>
            <a href="#playground" className="hover:text-text-primary transition-colors">Playground</a>
            <a href="#capabilities" className="hover:text-text-primary transition-colors">Architecture</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
