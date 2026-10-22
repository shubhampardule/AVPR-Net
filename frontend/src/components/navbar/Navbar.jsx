import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
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
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200 ${scrolled ? 'border-text-primary/[0.08] bg-bg-primary/95 backdrop-blur-md' : 'border-transparent bg-bg-primary/70'}`}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link to="/" aria-label="AVPR-Net home" className="group inline-flex items-center gap-2.5">
          <BrandLockup wordmarkClassName="text-lg" />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link to="/login" className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary">Sign in</Link>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-text-primary/[0.12] text-text-primary transition-colors hover:bg-text-primary/[0.05]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-navigation" className="border-t border-text-primary/[0.08] bg-bg-secondary px-5 pb-5 pt-3 lg:hidden">
          <nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl flex-col">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} onClick={() => setMobileMenuOpen(false)} className="border-b border-text-primary/[0.06] py-3 text-sm font-medium text-text-primary transition-colors hover:text-text-primary">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mx-auto flex max-w-7xl gap-3 pt-4">
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-text-primary/[0.12] text-sm font-medium text-text-primary">Sign in</Link>
          </div>
        </div>
      )}
    </header>
  );
}
