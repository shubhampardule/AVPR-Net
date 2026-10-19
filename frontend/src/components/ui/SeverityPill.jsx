import React from 'react';
import { AlertCircle, AlertTriangle, Info, ShieldCheck } from 'lucide-react';

export function SeverityPill({ severity, size = 'md', className = '' }) {
  const configs = {
    Critical: {
      label: 'Critical',
      badgeClass: 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/25',
      dotClass: 'bg-[#F87171]',
      icon: AlertCircle,
    },
    High: {
      label: 'High',
      badgeClass: 'bg-[#FB923C]/10 text-[#FB923C] border-[#FB923C]/25',
      dotClass: 'bg-[#FB923C]',
      icon: AlertTriangle,
    },
    Medium: {
      label: 'Medium',
      badgeClass: 'bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/25',
      dotClass: 'bg-[#FBBF24]',
      icon: Info,
    },
    Low: {
      label: 'Low',
      badgeClass: 'bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/25',
      dotClass: 'bg-[#4ADE80]',
      icon: ShieldCheck,
    },
    Resolved: {
      label: 'Resolved',
      badgeClass: 'bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30',
      dotClass: 'bg-[#4ADE80]',
      icon: ShieldCheck,
    }
  };

  const config = configs[severity] || configs.Medium;
  const IconComponent = config.icon;

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
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
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass} animate-pulse`} />
      <IconComponent className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
}
