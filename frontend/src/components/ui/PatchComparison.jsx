import React, { useMemo, useState } from "react";
import { applyPatch, diffLines, parsePatch } from "diff";

const lines = text => text.replace(/\r\n/g, "\n").split("\n").slice(0, text.endsWith("\n") ? -1 : undefined);

export default function PatchComparison({ originalCode, patch, filename = "source", commitSha }) {
  const [view, setView] = useState("split");
  const comparison = useMemo(() => {
    try {
      if (typeof originalCode !== "string") return null;
      const parsed = parsePatch(patch, { strict: true });
      if (parsed.length !== 1 || parsed[0].oldFileName !== `a/${filename}` || parsed[0].newFileName !== `b/${filename}`) return null;
      const after = applyPatch(originalCode, parsed[0], { fuzzFactor: 0 });
      if (after === false) return null;
      const changes = diffLines(originalCode, after);
      const rows = [];
      let beforeLine = 1, afterLine = 1;
      for (let index = 0; index < changes.length; index++) {
        const change = changes[index];
        if (!change.added && !change.removed) {
          for (const text of lines(change.value)) rows.push({ before: { text, number: beforeLine++ }, after: { text, number: afterLine++ } });
          continue;
        }
        const removed = change.removed ? lines(change.value) : [];
        let added = change.added ? lines(change.value) : [];
        if (change.removed && changes[index + 1]?.added) added = lines(changes[++index].value);
        for (let row = 0; row < Math.max(removed.length, added.length); row++) rows.push({
          before: row < removed.length ? { text: removed[row], number: beforeLine++, changed: true } : null,
          after: row < added.length ? { text: added[row], number: afterLine++, changed: true } : null,
        });
      }
      return { rows };
    } catch { return null; }
  }, [originalCode, patch, filename]);

  return <section aria-label="Before and after code comparison" className="min-w-0 overflow-hidden rounded-lg border border-text-primary/15 bg-bg-primary">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-text-primary/10 bg-bg-elevated px-4 py-3">
      <div className="min-w-0"><p className="break-all font-mono text-xs text-text-primary">{filename}</p>
        <p className="mt-1 text-xs text-text-muted">{commitSha ? `Scanned commit ${commitSha.slice(0, 7)} · ` : ""}Proposed change · not applied</p></div>
      <div role="group" aria-label="Code comparison view" className="flex gap-1 rounded-md border border-text-primary/15 p-1">
        {[["split", "Side by side"], ["unified", "Unified diff"]].map(([value, label]) => <button type="button" key={value}
          aria-pressed={view === value} disabled={value === "split" && !comparison} onClick={() => setView(value)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-security disabled:opacity-40 ${view === value ? "bg-text-primary/10 text-text-primary" : "text-text-secondary hover:bg-text-primary/5"}`}>{label}</button>)}
      </div>
    </div>
    {!comparison && <p role="status" className="border-b border-text-primary/10 px-4 py-3 text-xs text-severity-medium">A side-by-side preview is unavailable because this patch could not be matched exactly to the submitted source. Review the unified diff below.</p>}
    {view === "split" && comparison ? <div className="overflow-x-auto" tabIndex={0} aria-label="Scrollable before and after source">
      <div className="min-w-[40rem]">
        <div className="grid grid-cols-2 border-b border-text-primary/10 text-xs font-semibold">
          <h3 className="border-r border-text-primary/10 px-4 py-2.5">Before <span className="ml-2 font-normal text-text-muted">Scanned source</span></h3>
          <h3 className="px-4 py-2.5">After <span className="ml-2 font-normal text-text-muted">Proposed source</span></h3>
        </div>
        <div className="max-h-[36rem] overflow-y-auto py-2 font-mono text-xs leading-6">
          {comparison.rows.map((row, index) => <div key={index} className="grid grid-cols-2">
            {["before", "after"].map(side => <div key={side} className={`flex min-w-0 ${side === "before" ? "border-r border-text-primary/10" : ""} ${row[side]?.changed ? side === "before" ? "bg-severity-critical/10" : "bg-accent-security/10" : ""}`}>
              <span aria-hidden="true" className="w-10 shrink-0 select-none pr-2 text-right text-text-muted">{row[side]?.number}</span>
              <span aria-hidden="true" className="w-4 shrink-0 select-none text-text-muted">{row[side]?.changed ? side === "before" ? "−" : "+" : ""}</span>
              <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-all pr-4 text-text-primary"><code>{row[side]?.text || " "}</code></pre>
            </div>)}
          </div>)}
        </div>
      </div>
    </div> : <pre className="max-h-[36rem] overflow-auto p-4 font-mono text-xs leading-6 text-text-primary"><code>{patch}</code></pre>}
    {view === "split" && comparison && <p className="border-t border-text-primary/10 px-4 py-2 text-xs text-text-muted sm:hidden">Scroll horizontally to compare both columns, or choose Unified diff.</p>}
  </section>;
}
