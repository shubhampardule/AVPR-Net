import React from 'react';

export function Footer() {
  return (
    <footer className="border-t border-text-primary/[0.08] bg-bg-primary py-6 text-xs text-text-muted">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        © {new Date().getFullYear()} AVPR-Net
      </div>
    </footer>
  );
}
