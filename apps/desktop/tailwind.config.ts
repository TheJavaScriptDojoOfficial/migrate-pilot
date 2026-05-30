import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Developer-tool palette. Neutral, calm, IDE-like.
        canvas: {
          DEFAULT: '#0b0d10',
          subtle: '#11151a',
          raised: '#161b22',
          border: '#1f242c',
        },
        ink: {
          DEFAULT: '#e6edf3',
          muted: '#8b949e',
          subtle: '#6e7681',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#60a5fa',
      },
      fontFamily: {
        sans: [
          '"Inter"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        xs: '0.25rem',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};

export default config;
