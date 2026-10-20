import React from 'react';
import { GitBranch } from 'lucide-react';
import { SeverityPill } from '../ui/SeverityPill';

const sampleFindings = [
  { title: 'Missing authorization check', path: 'src/api/accounts.js:84', severity: 'High' },
  { title: 'Insecure cookie settings', path: 'src/http/session.js:29', severity: 'Medium' },
];

export function RepositoryPreview() {
  return (
    <section aria-label="Sample repository overview" className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#171D1F] text-left shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[#E8EEEB]">Example project</p>
          <p className="mt-1 text-xs text-[#A5B1AB]">Example data · no live scan</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-white/[0.1] px-2.5 py-1.5 text-xs text-[#B8C3BD]"><GitBranch className="h-3.5 w-3.5" aria-hidden="true" /> main</span>
      </div>

      <div className="px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono-code text-xs text-[#A8B9AF]">acme / payments-api</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#E8EEEB]">Findings for review</h2>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-[#101416] px-4 py-3 text-right">
            <p className="text-2xl font-semibold tracking-tight text-[#E8EEEB]">02</p>
            <p className="mt-0.5 text-xs text-[#9BA8A1]">sample findings</p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.08]">
          {sampleFindings.map((finding) => (
            <div key={finding.title} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#E8EEEB]">{finding.title}</p>
                <p className="mt-1 truncate font-mono-code text-xs text-[#9BA8A1]">{finding.path}</p>
              </div>
              <SeverityPill severity={finding.severity} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
