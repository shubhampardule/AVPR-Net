import React, { useState, useEffect } from 'react';
import { ShieldCheck, Menu, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Navbar({ onOpenAuthModal }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Product', href: '#product' },
    { label: 'How it works', href: '#workflow' },
    { label: 'Security', href: '#security' },
    { label: 'Playground', href: '#playground' },
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'AI assistant', href: import.meta.env.DEV ? '/assistant-demo' : '/assistant' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
        ? 'bg-[#08090B]/85 backdrop-blur-md border-b border-white/[0.06] py-3 shadow-elevated'
        : 'bg-transparent py-5'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Wordmark Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#111419] border border-white/[0.1] flex items-center justify-center transition-all group-hover:border-[#4ADE80]/50 group-hover:bg-[#4ADE80]/10">
            <ShieldCheck className="w-4 h-4 text-[#4ADE80] transition-transform group-hover:scale-110" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-semibold tracking-tight text-[#F5F7FA]">
              Secure<span className="text-[#4ADE80]">Patch</span>
            </span>
            <span className="hidden sm:inline-flex text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] text-text-muted border border-white/[0.06]">
              v1.0
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 rounded-full px-4 py-1.5 border border-white/[0.06] bg-[#0D0F12]/60 backdrop-blur-sm">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors tracking-wide"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="px-3.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors font-mono"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium text-[#08090B] bg-[#4ADE80] hover:bg-[#3ecf74] transition-all shadow-subtle-glow"
          >
            <span>Start scanning</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-[#111419] border border-white/[0.08] text-text-secondary hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-[#0D0F12]/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-3">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2">
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2 text-center text-xs font-mono text-text-secondary hover:text-white bg-[#111419] rounded-lg border border-white/[0.08] block"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2 text-center text-xs font-mono font-semibold text-[#08090B] bg-[#4ADE80] rounded-lg shadow-subtle-glow flex items-center justify-center gap-1.5"
            >
              <span>Start scanning</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
