/** @type {import('tailwindcss').Config} */
import type { Config } from 'tailwindcss';
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        canvas:  'var(--bg-canvas)',
        surface: 'var(--surface)',
        ink:        { DEFAULT: 'var(--ink)', muted: 'var(--ink-muted)' },
        accent:     { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)' },
        border:  'var(--border)',
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

