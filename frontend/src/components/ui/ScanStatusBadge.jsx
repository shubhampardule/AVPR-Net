import React from "react";

export function ScanStatusBadge({ status }) {
  const norm = (status || "queued").toLowerCase();

  const config = {
    queued: {
      label: "QUEUED",
      bg: "bg-severity-info/10",
      text: "text-severity-info",
      border: "border-severity-info/20",
      dot: "bg-severity-info animate-pulse",
    },
    running: {
      label: "SCANNING",
      bg: "bg-severity-medium/10",
      text: "text-severity-medium",
      border: "border-severity-medium/20",
      dot: "bg-severity-medium animate-ping",
    },
    completed: {
      label: "COMPLETED",
      bg: "bg-severity-low/10",
      text: "text-severity-low",
      border: "border-severity-low/20",
      dot: "bg-severity-low",
    },
    failed: {
      label: "FAILED",
      bg: "bg-severity-critical/10",
      text: "text-severity-critical",
      border: "border-severity-critical/20",
      dot: "bg-severity-critical",
    },
  }[norm] || {
    label: norm.toUpperCase(),
    bg: "bg-text-primary/[0.05]",
    text: "text-text-muted",
    border: "border-text-primary/[0.1]",
    dot: "bg-text-muted",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
