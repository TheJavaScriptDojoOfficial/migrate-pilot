---
name: Nexus Direct Dark
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#c0c7d4'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#8b919d'
  outline-variant: '#414752'
  surface-tint: '#a2c9ff'
  primary: '#a2c9ff'
  on-primary: '#00315c'
  primary-container: '#58a6ff'
  on-primary-container: '#003a6b'
  inverse-primary: '#0060aa'
  secondary: '#c1c7d0'
  on-secondary: '#2b3138'
  secondary-container: '#41474f'
  on-secondary-container: '#b0b5be'
  tertiary: '#c2c7d0'
  on-tertiary: '#2c3138'
  tertiary-container: '#9fa3ac'
  on-tertiary-container: '#353a41'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d3e4ff'
  primary-fixed-dim: '#a2c9ff'
  on-primary-fixed: '#001c38'
  on-primary-fixed-variant: '#004882'
  secondary-fixed: '#dde3ec'
  secondary-fixed-dim: '#c1c7d0'
  on-secondary-fixed: '#161c23'
  on-secondary-fixed-variant: '#41474f'
  tertiary-fixed: '#dee2ec'
  tertiary-fixed-dim: '#c2c7d0'
  on-tertiary-fixed: '#171c23'
  on-tertiary-fixed-variant: '#42474f'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  code-sm:
    fontFamily: monospace
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

This design system is engineered for high-productivity environments, drawing inspiration from developer-centric tools like VS Code and GitHub. The aesthetic is rooted in **Modern Minimalism** with a technical, utilitarian edge. It prioritizes clarity, information density, and reduced eye strain through a refined dark-mode palette.

The target audience consists of power users, developers, and data analysts who require a focused environment. The UI evokes a sense of precision, reliability, and modern efficiency. Surfaces are differentiated by subtle shifts in value rather than heavy shadows, creating a sophisticated "layered-flat" appearance.

## Colors

The color palette is built on a "Deep Charcoal" foundation to ensure maximum contrast for syntax-like highlighting of interface elements. 

- **Backgrounds:** Use the neutral base (#0D1117) for the primary application canvas.
- **Surfaces:** Use the secondary container (#161B22) for sidebars, cards, and modal backgrounds to create depth.
- **Accents:** The Primary Blue (#58a6ff) is reserved for interactive states, progress indicators, and primary actions. 
- **Borders:** Structural integrity is maintained through a subtle border (#30363D) which replaces the need for heavy drop shadows.
- **Status:** Semantics follow standard developer patterns, utilizing high-chroma but desaturated tones to remain legible against dark backgrounds.

## Typography

The design system utilizes **Inter** exclusively to leverage its exceptional legibility in digital interfaces. 

- **Headings:** Use Semi-Bold (600) or Bold (700) weights with slightly tighter letter-spacing to create a strong visual anchor.
- **Body Text:** Standard body text should use the crisp white (#F0F6FC) to ensure AAA accessibility.
- **Secondary Text:** Use the muted gray (#8B949E) for hints, timestamps, and metadata to establish clear information hierarchy.
- **Technical Content:** For data-heavy views or configuration strings, fallback to system monospaced fonts to reinforce the developer-centric aesthetic.

## Layout & Spacing

The design system employs a **Fluid Grid** model with a base-4 unit system. 

- **Layout:** Use a 12-column grid for desktop views. Content should be organized into logical "Panels" (e.g., Navigation, Activity Bar, Editor, Inspector) reminiscent of an IDE.
- **Density:** Information density should be medium-to-high. Use 8px (sm) and 16px (md) for internal component padding.
- **Breakpoints:** 
  - **Mobile (<768px):** Single column, full-width components, 16px side margins.
  - **Tablet (768px - 1024px):** Multi-pane layout with collapsible sidebars.
  - **Desktop (>1024px):** Fixed-width sidebars with a fluid central staging area.

## Elevation & Depth

Depth is achieved through **Tonal Layering** rather than traditional shadows. This creates a clean, technical interface that feels integrated into the screen.

- **Level 0 (Base):** #0D1117 — The primary background.
- **Level 1 (Surface):** #161B22 — Used for cards, panels, and sidebars. Should be separated from the base by a 1px border (#30363D).
- **Level 2 (Overlay):** #1C2128 — Used for tooltips, dropdown menus, and modals. These may utilize a very subtle, large-radius black shadow (0 8px 24px rgba(0,0,0,0.5)) to distinguish them from the underlying UI layers.
- **Active States:** Interactive items (like selected tabs) should use a left-edge or bottom-edge 2px border in the primary color (#58a6ff) to denote focus.

## Shapes

The design system uses a consistent **8px (Rounded)** radius for almost all UI elements to balance the technical aesthetic with modern approachability.

- **Standard Components:** Buttons, Input fields, and Cards utilize the 8px base radius.
- **Small Components:** Tags and Chips should use a 4px radius (Soft) to maintain visual balance at smaller scales.
- **Interactive States:** Focus rings should follow the shape of the component with a 2px offset.

## Components

- **Buttons:**
  - **Primary:** Solid #58a6ff background with dark text for high contrast.
  - **Secondary:** Transparent background with a #30363D border and #F0F6FC text.
  - **Ghost:** No background or border, primary color text.
- **Input Fields:** Dark background (#0D1117) with a subtle #30363D border. On focus, the border changes to the primary color with a subtle outer glow.
- **Cards:** Use the Level 1 surface color (#161B22) with a 1px #30363D border. No box-shadow.
- **Chips/Tags:** Used for categorization. High-contrast labels on a slightly lighter gray background or a desaturated version of the status colors.
- **Lists:** Use subtle zebra-striping or hover-states using #21262D to help users track rows in high-density data tables.
- **Navigation Rails:** Inspired by VS Code, use a narrow vertical bar (48px - 64px) on the far left for top-level application switching, using icons with active-state indicators.