import React from 'react';
const coverage = [
  ['Semgrep', 'JavaScript, TypeScript, and Python patterns', 'Project-owned rules; not a complete application security assessment.'],
  ['Bandit', 'Python source checks', 'Findings depend on covered files and enabled rules.'],
  ['Credential patterns', 'Potential embedded credentials', 'Pattern matches require review; a match does not prove a live secret.'],
  ['OSV advisories', 'npm lockfile v2/v3 dependencies', 'Optional. Sends package names and versions to OSV.'],
];
export function ArchitectureGrid() {
  return <section id="capabilities" className="border-t border-border-subtle bg-bg-primary py-16">
    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-2xl"><h2 className="text-3xl font-semibold tracking-tight text-text-primary">Know what a scan covers.</h2><p className="mt-3 text-sm leading-6 text-text-secondary">Every result records its scanners, pinned commit, covered files, and failed checks. Partial coverage stays visible.</p></div>
      <div className="coverage-table overflow-x-auto rounded-lg border border-border-light"><table className="w-full text-left text-sm"><caption className="sr-only">Supported scanners and their limits</caption><thead className="bg-bg-secondary text-xs text-text-muted"><tr><th scope="col" className="p-4 font-medium">Scanner</th><th scope="col" className="p-4 font-medium">Checks</th><th scope="col" className="p-4 font-medium">Limits</th></tr></thead><tbody>{coverage.map(([scanner,checks,limits]) => <tr key={scanner} className="border-t border-border-subtle"><th scope="row" className="p-4 align-top font-medium text-text-primary">{scanner}</th><td className="p-4 align-top text-text-secondary">{checks}</td><td className="p-4 align-top text-text-secondary">{limits}</td></tr>)}</tbody></table></div>
    </div>
  </section>;
}
