import React from 'react';

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-text-primary/[0.04] text-text-secondary border-text-primary/[0.08]',
    security: 'bg-accent-security/10 text-accent-security border-accent-security/20',
    blue: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
    critical: 'bg-severity-critical/10 text-severity-critical border-severity-critical/25',
    high: 'bg-severity-high/10 text-severity-high border-severity-high/25',
    medium: 'bg-severity-medium/10 text-severity-medium border-severity-medium/25',
    subtle: 'bg-bg-card text-text-muted border-text-primary/[0.06]',
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
