import React from 'react';
import {
  Code2,
  Cpu,
  GitMerge,
  BarChart3,
  FileCode2,
  Boxes,
  Clock,
  Users,
  ShieldCheck,
  Server,
  Lock
} from 'lucide-react';
import { GithubIcon } from '../ui/GithubIcon';
import { ENTERPRISE_CAPABILITIES } from '../../data/scanners';

export function ArchitectureGrid() {
  const iconMap = {
    Cpu: Cpu,
    GitMerge: GitMerge,
    BarChart3: BarChart3,
    FileCode2: FileCode2,
    Boxes: Boxes,
    Clock: Clock,
    Github: GithubIcon,
    Users: Users
  };

  return (
    <section id="capabilities" className="py-24 border-t border-white/[0.06] bg-[#08090B] text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-text-secondary tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
            Architecture & Engineering Principles
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7FA]">
            Engineered for precision. Built for developer trust.
          </h2>
          <p className="text-base text-text-secondary leading-relaxed">
            SecurePatch eliminates scanner alert noise and protects code integrity through isolated sandbox verification and non-destructive Git workflows.
          </p>
        </div>

        {/* 8 Core Capability Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ENTERPRISE_CAPABILITIES.map((cap) => {
            const IconComponent = iconMap[cap.icon] || ShieldCheck;
            return (
              <div
                key={cap.title}
                className="group p-5 rounded-xl bg-[#0D0F12] border border-white/[0.06] hover:border-white/[0.15] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-lg bg-[#111419] border border-white/[0.08] flex items-center justify-center text-[#60A5FA] mb-4 group-hover:text-[#4ADE80] transition-colors">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#F5F7FA] font-mono tracking-tight mb-2">
                    {cap.title}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Server-Side Autonomous Monitoring Banner (Laptop-Off Execution) */}
        <div className="mt-12 p-6 sm:p-8 rounded-2xl bg-[#0D0F12] border border-white/[0.08] relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#60A5FA] bg-[#60A5FA]/10 px-2.5 py-1 rounded border border-[#60A5FA]/20">
                <Clock className="w-3.5 h-3.5" />
                <span>AUTONOMOUS SERVER-SIDE MONITORING</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#F5F7FA]">
                Scheduled scans execute whether your laptop is open or closed.
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Persistent Redis/BullMQ worker pipelines trigger weekly and monthly repository evaluations in the cloud. New commits, vulnerable dependency releases, or reintroduced weaknesses are identified continuously.
              </p>
            </div>

            <div className="lg:col-span-4 p-4 rounded-xl bg-[#111419] border border-white/[0.06] font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-text-muted pb-1 border-b border-white/[0.04]">
                <span>SCHEDULE SPEC</span>
                <span className="text-[#4ADE80]">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Frequency:</span>
                <span className="text-text-primary">Weekly / Monthly</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Execution Host:</span>
                <span className="text-text-primary">Isolated Cloud Worker</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Host Security:</span>
                <span className="text-[#4ADE80]">Hardened Sandbox</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
