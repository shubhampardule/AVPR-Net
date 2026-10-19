import React from 'react';

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-white/[0.04] text-text-secondary border-white/[0.08]',
    security: 'bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/20',
    blue: 'bg-[#60A5FA]/10 text-[#60A5FA] border-[#60A5FA]/20',
    critical: 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/25',
    high: 'bg-[#FB923C]/10 text-[#FB923C] border-[#FB923C]/25',
    medium: 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/25',
    subtle: 'bg-bg-card text-text-muted border-white/[0.06]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono tracking-wide border uppercase ${
        variants[variant] || variants.default
      } ${className}`}
    >
      {children}
    </span>
  );
}
