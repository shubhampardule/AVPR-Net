import React, { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../ui/ThemeToggle';
import { BrandLockup } from '../ui/BrandLogo';

const navLinks = [
  { label: 'Workflow', href: '#workflow' },
  { label: 'Example', href: '#playground' },
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'AI assistant', href: import.meta.env.DEV ? '/assistant-demo' : '/assistant' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${scrolled ? 'border-white/[0.08] bg-[#101416]/95 backdrop-blur-md' : 'border-transparent bg-[#101416]/70'}`}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link to="/" aria-label="SecurePatch home" className="group inline-flex items-center gap-2.5">
          <BrandLockup wordmarkClassName="text-lg" />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="text-[13px] font-medium text-[#AFBAB4] transition-colors hover:text-[#E8EEEB]">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link to="/login" className="text-[13px] font-medium text-[#AFBAB4] transition-colors hover:text-[#E8EEEB]">Sign in</Link>
          <ThemeToggle />
          <Link to="/login" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#78A88B] px-3.5 text-[13px] font-semibold text-[#101916] transition-colors hover:bg-[#8DB89C]">
            Connect a repository <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.12] text-[#E8EEEB] transition-colors hover:bg-white/[0.05]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-navigation" className="border-t border-white/[0.08] bg-[#151B1D] px-5 pb-5 pt-3 lg:hidden">
          <nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl flex-col">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} onClick={() => setMobileMenuOpen(false)} className="border-b border-white/[0.06] py-3 text-sm font-medium text-[#C6D0CA] transition-colors hover:text-white">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mx-auto flex max-w-7xl gap-3 pt-4">
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-white/[0.12] text-sm font-medium text-[#E8EEEB]">Sign in</Link>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-[#78A88B] text-sm font-semibold text-[#101916]">Connect a repository <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      )}
    </header>
  );
}
