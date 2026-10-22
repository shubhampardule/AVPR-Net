import React from "react";

export function RiskScoreBar({ score, category }) {
  const num = typeof score === "number" ? score : 0;
  const percentage = Math.min(100, Math.max(0, (num / 10) * 100));

  const colors = {
    critical: {
      bar: "bg-severity-critical",
      text: "text-severity-critical",
      bg: "bg-severity-critical/10",
      border: "border-severity-critical/20",
    },
    high: {
      bar: "bg-severity-high",
      text: "text-severity-high",
      bg: "bg-severity-high/10",
      border: "border-severity-high/20",
    },
    medium: {
      bar: "bg-severity-medium",
      text: "text-severity-medium",
      bg: "bg-severity-medium/10",
      border: "border-severity-medium/20",
    },
    low: {
      bar: "bg-accent-security",
      text: "text-accent-security",
      bg: "bg-accent-security/10",
      border: "border-accent-security/20",
    },
  }[category?.toLowerCase()] || {
    bar: "bg-text-muted",
    text: "text-text-muted",
    bg: "bg-text-muted/10",
    border: "border-gray-500/20",
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 sm:w-28 h-2 rounded-full bg-text-primary/[0.08] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center gap-1.5 font-mono text-xs">
        <span className={`font-semibold ${colors.text}`}>{num.toFixed(1)}</span>
        <span className="text-text-muted text-[11px]">/ 10</span>
      </div>
    </div>
  );
}
