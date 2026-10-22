import React from 'react';
import { AlertCircle, AlertTriangle, Info, ShieldCheck } from 'lucide-react';

export function SeverityPill({ severity, size = 'md', className = '' }) {
  const configs = {
    Critical: {
      label: 'Critical',
      badgeClass: 'bg-severity-critical/10 text-severity-critical border-severity-critical/25',
      dotClass: 'bg-severity-critical',
      icon: AlertCircle,
    },
    High: {
      label: 'High',
      badgeClass: 'bg-severity-high/10 text-severity-high border-severity-high/25',
      dotClass: 'bg-severity-high',
      icon: AlertTriangle,
    },
    Medium: {
      label: 'Medium',
      badgeClass: 'bg-severity-medium/10 text-severity-medium border-severity-medium/25',
      dotClass: 'bg-severity-medium',
      icon: Info,
    },
    Low: {
      label: 'Low',
      badgeClass: 'bg-severity-low/10 text-severity-low border-severity-low/25',
      dotClass: 'bg-severity-low',
      icon: ShieldCheck,
    },
    Resolved: {
      label: 'Resolved',
      badgeClass: 'bg-severity-low/10 text-severity-low border-severity-low/30',
      dotClass: 'bg-severity-low',
      icon: ShieldCheck,
    }
  };

  const config = configs[severity] || configs.Medium;
  const IconComponent = config.icon;

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-md border ${
        config.badgeClass
      } ${sizeStyles[size]} ${className}`}
      aria-label={`Severity level: ${config.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} aria-hidden="true" />
      <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
}
