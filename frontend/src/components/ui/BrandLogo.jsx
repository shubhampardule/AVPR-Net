import React from "react";

export function BrandMark({ className = "" }) {
  return (
    <img
      src="/securepatch-favicon.png?v=1"
      alt=""
      aria-hidden="true"
      draggable="false"
      width="96"
      height="96"
      className={`h-6 w-6 shrink-0 object-contain ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export function BrandLockup({
  className = "",
  wordmarkClassName = "",
  descriptor = false,
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <BrandMark />
      <span className="inline-flex min-w-0 flex-col justify-center">
        <span className={`font-sans font-semibold leading-none tracking-[-0.035em] text-text-primary ${wordmarkClassName}`}>
          Secure<span className="text-accent-security">Patch</span>
        </span>
        {descriptor && (
          <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-text-muted">
            Security review
          </span>
        )}
      </span>
    </span>
  );
}
