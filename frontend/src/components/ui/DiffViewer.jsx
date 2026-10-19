import React, { useState } from 'react';
import { GitPullRequest, CheckCircle2, SplitSquareHorizontal, FileCode2 } from 'lucide-react';

export function DiffViewer({
  filename = 'src/routes/auth.js',
  branch = 'securepatch/fix-VUL-NODE-089',
  vulnerableCode = '',
  remediatedCode = '',
  unifiedDiff = '',
  explanation = 'Parameterized query isolates data from SQL execution structure.',
  strategy = 'Deterministic Rule Transformation'
}) {
  const [mode, setMode] = useState('split'); // 'split' | 'unified'

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0D0F12] overflow-hidden text-xs font-mono shadow-card">
      {/* Header with branch and mode switch */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[#111419] border-b border-white/[0.06]">
        <div className="flex items-center gap-2 text-text-secondary">
          <FileCode2 className="w-4 h-4 text-[#60A5FA]" />
          <span className="text-text-primary font-medium">{filename}</span>
          <span className="text-white/20">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
            <GitPullRequest className="w-3 h-3 text-[#4ADE80]" />
            {branch}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20">
            <CheckCircle2 className="w-3 h-3" />
            Suggested Patch
          </span>
          <div className="flex rounded-md border border-white/[0.08] bg-black/40 p-0.5">
            <button
              onClick={() => setMode('split')}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                mode === 'split' ? 'bg-white/10 text-white font-medium' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setMode('unified')}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                mode === 'unified' ? 'bg-white/10 text-white font-medium' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Unified Diff
            </button>
          </div>
        </div>
      </div>

      {/* Code diff display */}
      {mode === 'split' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
          {/* Left: Vulnerable */}
          <div className="p-4 bg-[#F87171]/[0.02]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.04]">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#F87171] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
                Vulnerable Code (Before)
              </span>
              <span className="text-[10px] text-text-muted font-mono">Status: Open</span>
            </div>
            <pre className="text-[12px] leading-relaxed overflow-x-auto whitespace-pre font-mono text-[#F87171]/90 select-text">
              {vulnerableCode.trim()}
            </pre>
          </div>

          {/* Right: Remediated */}
          <div className="p-4 bg-[#4ADE80]/[0.02]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.04]">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#4ADE80] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                Secure Code (Suggested Patch)
              </span>
              <span className="text-[10px] text-[#4ADE80] font-mono">Validated</span>
            </div>
            <pre className="text-[12px] leading-relaxed overflow-x-auto whitespace-pre font-mono text-[#4ADE80]/90 select-text">
              {remediatedCode.trim()}
            </pre>
          </div>
        </div>
      ) : (
        <div className="p-4 overflow-x-auto bg-[#0A0C0E]">
          <pre className="text-[12px] leading-relaxed font-mono select-text">
            {unifiedDiff.trim().split('\n').map((line, i) => {
              let lineClass = 'text-text-muted';
              if (line.startsWith('---') || line.startsWith('+++')) {
                lineClass = 'text-[#60A5FA] font-semibold';
              } else if (line.startsWith('@@')) {
                lineClass = 'text-[#818CF8] bg-white/[0.02] block py-0.5';
              } else if (line.startsWith('-')) {
                lineClass = 'text-[#F87171] bg-[#F87171]/10 block py-0.5 px-1 -mx-1';
              } else if (line.startsWith('+')) {
                lineClass = 'text-[#4ADE80] bg-[#4ADE80]/10 block py-0.5 px-1 -mx-1';
              }
              return (
                <div key={i} className={lineClass}>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      )}

      {/* Explanation Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-[#111419] border-t border-white/[0.06] text-xs">
        <div className="flex items-start sm:items-center gap-2 text-text-secondary">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
            Why this works
          </span>
          <span className="text-text-primary text-[12px]">{explanation}</span>
        </div>
        <div className="text-[11px] text-[#60A5FA] font-mono shrink-0">
          Strategy: {strategy}
        </div>
      </div>
    </div>
  );
}
