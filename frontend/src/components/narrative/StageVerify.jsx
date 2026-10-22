import React from "react";
export function StageVerify() {
  const checks = [
    ["Immutable source", "Scans and patch checks use the recorded commit SHA."],
    ["Patch applicability", "A single-file unified diff must match the scanned source without fuzz."],
    ["Syntax checks", "JavaScript and TypeScript use a parser. Python AST checks depend on the interpreter. Other languages require manual validation."],
    ["Independent tests", "Project test suites are not executed by the scanning service. Run them in your trusted CI before merging."],
    ["Human review", "Draft PR creation requires explicit review and never updates the default branch."],
  ];
  return <div className="rounded-xl border border-text-primary/10 bg-bg-secondary p-6 space-y-4 text-left">
    <p className="text-sm font-medium text-text-secondary">What these checks cover</p>
    {checks.map(([title, text]) => <div key={title} className="border-t border-text-primary/10 pt-3"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-text-secondary">{text}</p></div>)}
  </div>;
}
