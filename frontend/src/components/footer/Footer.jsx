import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLockup } from '../ui/BrandLogo';

const productLinks = [
  ['Product', '#product'],
  ['Workflow', '#workflow'],
  ['Example', '#playground'],
  ['Capabilities', '#capabilities'],
  ['Sign in', '/login'],
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#101416] py-10 text-sm text-[#AEB9B3]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
          <div>
            <Link to="/" aria-label="SecurePatch home" className="inline-flex items-center gap-2.5 text-[#E8EEEB]">
              <BrandLockup wordmarkClassName="text-base" />
            </Link>
          </div>

          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 sm:justify-end">
            {productLinks.map(([label, href]) => href.startsWith('/') ? (
              <Link key={label} to={href} className="transition-colors hover:text-white">{label}</Link>
            ) : (
              <a key={label} href={href} className="transition-colors hover:text-white">{label}</a>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.08] pt-5 text-xs text-[#89968F] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SecurePatch</span>
        </div>
      </div>
    </footer>
  );
}
