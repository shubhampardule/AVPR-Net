import React from 'react';

export function RiskGauge({ score = 9.4, size = 110, strokeWidth = 8, showBreakdown = false, exploitability = null, businessImpact = null }) {
  const normalizedScore = Math.min(Math.max(score, 0), 10);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Use a 270 degree arc for gauge look
  const strokeDashoffset = circumference - (normalizedScore / 10) * circumference * 0.75;

  let color = '#4ADE80'; // Resolved or Low
  let label = 'Low';
  if (normalizedScore >= 9.0) {
    color = '#F87171'; // Critical
    label = 'Critical';
  } else if (normalizedScore >= 7.0) {
    color = '#FB923C'; // High
    label = 'High';
  } else if (normalizedScore >= 4.0) {
    color = '#FBBF24'; // Medium
    label = 'Medium';
  } else if (normalizedScore === 0) {
    label = 'Resolved';
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-135"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference * 0.75}
            strokeLinecap="round"
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl font-bold tracking-tight text-[#F5F7FA]">
            {score.toFixed(1)}
          </span>
          <span className="text-[10px] font-mono tracking-wider uppercase" style={{ color }}>
            {label}
          </span>
        </div>
      </div>

      {showBreakdown && (exploitability || businessImpact) && (
        <div className="mt-3 grid grid-cols-2 gap-3 w-full text-xs font-mono border-t border-white/[0.06] pt-3">
          {exploitability !== null && (
            <div className="flex flex-col">
              <span className="text-text-muted text-[10px]">EXPLOITABILITY</span>
              <span className="font-semibold text-text-primary">{exploitability.toFixed(1)} / 10</span>
            </div>
          )}
          {businessImpact !== null && (
            <div className="flex flex-col text-right">
              <span className="text-text-muted text-[10px]">BUSINESS IMPACT</span>
              <span className="font-semibold text-text-primary">{businessImpact.toFixed(1)} / 10</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
