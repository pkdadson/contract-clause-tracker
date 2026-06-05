/** @type {import('tailwindcss').Config} */
import type { Config } from 'tailwindcss';
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        canvas:  'var(--bg-canvas)',
        surface: 'var(--surface)',
        sunken:  'var(--surface-sunken)',
        ink:        { DEFAULT: 'var(--ink)', muted: 'var(--ink-muted)', faint: 'var(--ink-faint)' },
        accent:     { DEFAULT: 'var(--accent)', strong: 'var(--accent-strong)', soft: 'var(--accent-soft)' },
        border:  { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        danger:  'var(--danger)',
        success: 'var(--success)',
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;

