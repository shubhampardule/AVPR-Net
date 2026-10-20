import React from "react";

export function ScanStatusBadge({ status }) {
  const norm = (status || "queued").toLowerCase();

  const config = {
    queued: {
      label: "QUEUED",
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/20",
      dot: "bg-blue-400 animate-pulse",
    },
    running: {
      label: "SCANNING",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      dot: "bg-amber-400 animate-ping",
    },
    completed: {
      label: "COMPLETED",
      bg: "bg-[#78A88B]/10",
      text: "text-[#78A88B]",
      border: "border-[#78A88B]/20",
      dot: "bg-[#78A88B]",
    },
    failed: {
      label: "FAILED",
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/20",
      dot: "bg-rose-400",
    },
  }[norm] || {
    label: norm.toUpperCase(),
    bg: "bg-white/[0.05]",
    text: "text-text-muted",
    border: "border-white/[0.1]",
    dot: "bg-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
