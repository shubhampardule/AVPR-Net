/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderRadius: { lg: "0.5rem", xl: "0.625rem", "2xl": "0.75rem" },
      colors: {
        "on-accent": "var(--on-accent)",
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          elevated: 'var(--bg-elevated)',
          card: 'var(--bg-elevated)',
          subtle: 'var(--bg-subtle)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          light: 'var(--border-light)',
          highlight: 'var(--border-highlight)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          security: 'var(--accent-security)',
          blue: 'var(--accent-blue)',
          cyan: 'var(--accent-blue)',
          indigo: '#8C93B4',
        },
        severity: {
          critical: 'var(--severity-critical)',
          high: 'var(--severity-high)',
          medium: 'var(--severity-medium)',
          low: 'var(--severity-low)',
          info: 'var(--severity-info)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'subtle-glow': '0 0 0 1px rgba(120, 168, 139, 0.14)',
        'blue-glow': '0 0 0 1px rgba(138, 167, 178, 0.14)',
        'card': 'var(--shadow-card)',
        'elevated': '0 16px 40px -18px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-subtle': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 6s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        },
      },
    },
  },
  plugins: [],
};
