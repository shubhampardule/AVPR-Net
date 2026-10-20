import React from 'react';

const steps = [
  {
    number: '01',
    title: 'Scan a commit',
    description: 'Run the configured scanners against a pinned revision. Tool versions, covered files, and scan errors stay with the result.',
  },
  {
    number: '02',
    title: 'Review the evidence',
    description: 'Open a report at its source location, see which scanner raised it, and compare it with a prior scan when coverage matches.',
  },
  {
    number: '03',
    title: 'Evaluate a change',
    description: 'Inspect a focused diff and its applicability checks. Run project tests in trusted CI before deciding whether to open a draft PR.',
  },
];

export function ScrollNarrative() {
  return (
    <section id="workflow" className="scroll-mt-24 border-t border-white/[0.07] bg-[#141A1B] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="mb-12 max-w-2xl space-y-4">
          <p className="text-sm font-medium text-[#A8B9AF]">Workflow</p>
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-[#E8EEEB] sm:text-4xl">How a finding moves through review.</h2>
          <p className="max-w-xl text-base leading-7 text-[#AEB9B3]">Each step stays tied to the scanned commit and the evidence that produced the result.</p>
        </div>

        <ol className="grid gap-0 border-t border-white/[0.1] md:grid-cols-3 md:divide-x md:divide-white/[0.1]">
          {steps.map((step) => (
            <li key={step.number} className="border-b border-white/[0.1] py-6 md:border-b-0 md:px-7 md:py-7 first:md:pl-0 last:md:pr-0">
              <p className="font-mono-code text-xs text-[#A8B9AF]">{step.number}</p>
              <h3 className="mt-4 text-lg font-semibold text-[#E8EEEB]">{step.title}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#AEB9B3]">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
