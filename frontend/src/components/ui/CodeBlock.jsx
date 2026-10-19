import React, { useState } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';

export function CodeBlock({
  code,
  language = 'javascript',
  filename = '',
  highlightLines = [],
  className = '',
  maxHeight = 'none'
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.trim().split('\n');

  return (
    <div className={`rounded-lg border border-white/[0.08] bg-[#0D0F12] overflow-hidden text-xs font-mono ${className}`}>
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#111419] border-b border-white/[0.06] text-text-secondary">
          <div className="flex items-center gap-2">
            <FileCode className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span className="text-[11px] font-medium tracking-wide text-text-primary">{filename}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">{language}</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-white/[0.06] text-text-muted hover:text-text-primary transition-colors"
              title="Copy code"
              aria-label="Copy code to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      <div
        className="p-4 overflow-x-auto text-[12px] leading-relaxed select-text"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = highlightLines.includes(lineNum);
              return (
                <tr
                  key={idx}
                  className={`${
                    isHighlighted
                      ? 'bg-[#F87171]/10 border-l-2 border-[#F87171]'
                      : 'hover:bg-white/[0.02]'
                  } transition-colors`}
                >
                  <td className="pr-4 pl-1 text-right select-none text-text-muted/50 w-8 font-mono text-[11px]">
                    {lineNum}
                  </td>
                  <td className="font-mono whitespace-pre text-[#F5F7FA]">
                    {renderSyntaxHighlight(line)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Lightweight syntax token colorizer without heavy external libraries
function renderSyntaxHighlight(line) {
  // Comments
  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return <span className="text-text-muted italic">{line}</span>;
  }

  // Basic token replacement for demo aesthetic
  // Keywords
  const parts = line.split(/(\b(?:const|let|var|function|async|await|return|import|export|from|def|if|else|router|subroutine|try|catch)\b|"[^"]*"|'[^']*'|`[^`]*`|\b\d+\b)/g);

  return parts.map((part, i) => {
    if (/^(const|let|var|function|async|await|return|import|export|from|def|if|else|router|try|catch)$/.test(part)) {
      return <span key={i} className="text-[#60A5FA] font-medium">{part}</span>;
    }
    if (/^["'`].*["'`]$/.test(part)) {
      if (part.includes('SELECT') || part.includes('ffmpeg') || part.includes('AKIA')) {
        return <span key={i} className="text-[#F87171]">{part}</span>;
      }
      return <span key={i} className="text-[#4ADE80]">{part}</span>;
    }
    if (/^\d+$/.test(part)) {
      return <span key={i} className="text-[#FBBF24]">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}
