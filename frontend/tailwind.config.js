/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#08090B',
          secondary: '#0D0F12',
          elevated: '#111419',
          card: '#111419',
          subtle: '#151921',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.08)',
          light: 'rgba(255, 255, 255, 0.12)',
          highlight: 'rgba(255, 255, 255, 0.18)',
        },
        text: {
          primary: '#F5F7FA',
          secondary: 'rgba(245, 247, 250, 0.62)',
          muted: 'rgba(245, 247, 250, 0.42)',
        },
        accent: {
          security: '#4ADE80',
          blue: '#60A5FA',
          cyan: '#38BDF8',
          indigo: '#818CF8',
        },
        severity: {
          critical: '#F87171',
          high: '#FB923C',
          medium: '#FBBF24',
          low: '#4ADE80',
          info: '#60A5FA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'subtle-glow': '0 0 30px -10px rgba(74, 222, 128, 0.15)',
        'blue-glow': '0 0 30px -10px rgba(96, 165, 250, 0.15)',
        'card': '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
        'elevated': '0 16px 48px -12px rgba(0, 0, 0, 0.5)',
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
