import React from "react";

export function RiskScoreBar({ score, category }) {
  const num = typeof score === "number" ? score : 0;
  const percentage = Math.min(100, Math.max(0, (num / 10) * 100));

  const colors = {
    critical: {
      bar: "bg-rose-500",
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    high: {
      bar: "bg-orange-500",
      text: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    },
    medium: {
      bar: "bg-amber-400",
      text: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
    low: {
      bar: "bg-[#78A88B]",
      text: "text-[#78A88B]",
      bg: "bg-[#78A88B]/10",
      border: "border-[#78A88B]/20",
    },
  }[category?.toLowerCase()] || {
    bar: "bg-gray-400",
    text: "text-gray-400",
    bg: "bg-gray-500/10",
    border: "border-gray-500/20",
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 sm:w-28 h-2 rounded-full bg-white/[0.08] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center gap-1.5 font-mono text-xs">
        <span className={`font-semibold ${colors.text}`}>{num.toFixed(1)}</span>
        <span className="text-text-muted text-[10px]">/ 10</span>
      </div>
    </div>
  );
}
