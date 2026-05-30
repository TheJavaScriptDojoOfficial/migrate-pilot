import type { Config } from 'tailwindcss';

/**
 * Nexus Direct Dark — Migrate Pilot design tokens.
 *
 * Source of truth: apps/desktop/DESIGN.md
 *
 * The palette is a developer-tool "deep charcoal" stack with tonal layering
 * instead of drop shadows. Tokens are exposed as semantic Tailwind colors so
 * screens can stay declarative (e.g. `bg-canvas-raised`, `text-ink-muted`)
 * and the underlying values can be retuned in one place.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces — base canvas + tonal layers (Material You "containers").
        canvas: {
          DEFAULT: '#10141a', // Level 0 — app background
          subtle: '#0d1117', // Level -1 — recessed wells (code, inputs)
          'subtle-2': '#181c22', // Level 0.5 — sidebars
          raised: '#1c2026', // Level 1 — cards, panels
          overlay: '#262a31', // Level 2 — tooltips, dropdowns, modals
          bright: '#31353c', // Level 3 — hover/selected raised
          border: '#2a2f37', // hairline (between Levels)
          'border-strong': '#414752', // outline-variant — visible separators
          'border-emphasis': '#8b919d', // outline — input borders / focus rings
        },

        // Content — on-surface tokens (foreground typography & iconography).
        ink: {
          DEFAULT: '#dfe2eb', // primary text
          muted: '#c0c7d4', // secondary text, body copy
          subtle: '#8b919d', // tertiary text, metadata, timestamps
          faint: '#6e7681', // disabled, placeholders
          inverse: '#0d1117', // text on light backgrounds (badges, primary buttons)
        },

        // Accent — Primary Blue (interactive states, indicators).
        accent: {
          DEFAULT: '#58a6ff', // primary action
          hover: '#79b8ff',
          press: '#388bfd',
          soft: '#a2c9ff', // primary-fixed-dim — secondary accents
          contrast: '#00315c', // on-primary — text on solid accent
          ring: 'rgba(88, 166, 255, 0.35)', // focus ring glow
        },

        // Semantic status — desaturated, dark-mode-friendly Primer-style.
        success: {
          DEFAULT: '#3fb950',
          soft: 'rgba(63, 185, 80, 0.14)',
          ring: 'rgba(63, 185, 80, 0.32)',
        },
        warning: {
          DEFAULT: '#d29922',
          soft: 'rgba(210, 153, 34, 0.14)',
          ring: 'rgba(210, 153, 34, 0.32)',
        },
        danger: {
          DEFAULT: '#f85149',
          soft: 'rgba(248, 81, 73, 0.14)',
          ring: 'rgba(248, 81, 73, 0.32)',
        },
        info: {
          DEFAULT: '#58a6ff',
          soft: 'rgba(88, 166, 255, 0.14)',
          ring: 'rgba(88, 166, 255, 0.32)',
        },
      },

      fontFamily: {
        sans: [
          '"Inter Variable"',
          '"Inter"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono Variable"',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },

      fontSize: {
        // Tighter scale tuned for dense IDE-style layouts.
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        md: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        xl: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em' }],
        '2xl': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        '3xl': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
      },

      borderRadius: {
        // Design system: 8px standard, 4px chip. Override `md` from 6px → 8px.
        xs: '0.25rem', // 4px — chips, tags, compact inputs
        md: '0.5rem', // 8px — buttons, cards, inputs
        lg: '0.75rem', // 12px — panels, modals
        xl: '1rem', // 16px — hero surfaces
      },

      boxShadow: {
        // Depth via tonal layering, not shadow. Reserve shadow for true overlays.
        panel: '0 1px 0 rgba(255,255,255,0.03) inset, 0 1px 2px rgba(0,0,0,0.35)',
        overlay: '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        focus: '0 0 0 2px rgba(88, 166, 255, 0.45)',
        'focus-danger': '0 0 0 2px rgba(248, 81, 73, 0.45)',
      },

      ringColor: {
        DEFAULT: '#58a6ff',
      },

      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      animation: {
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
