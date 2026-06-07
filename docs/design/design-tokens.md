# Design Tokens — Talos OS v8.0

Linear-themed design token system for the Mission Control UI (`@talos/ui`).

## 1. Purpose

Talos OS uses a unified design token system derived from Linear.app's public design references.
Tokens ensure visual consistency across all components: panels, buttons, status indicators, and the workflow canvas.

The token system is the single source of truth for colors, typography, spacing, radii, and shadows.
It is defined in three layers that mirror each other:

| Layer | Location | Consumed by |
|-------|----------|-------------|
| JSON tokens | `tokens/linear.json` | `scripts/apply-design-system.js` |
| Tailwind config | `packages/ui/tailwind.config.js` | Tailwind utility classes |
| CSS variables | `packages/ui/src/app/globals.css` | Raw CSS, component layer classes |

---

## 2. Linear Tokens (`tokens/linear.json`)

The canonical token file. Hand-curated from Linear.app public design references.

```json
{
  "meta": {
    "name": "Linear (Talos MVE)",
    "version": "1.0.0",
    "mode": "dark"
  },
  "color": { ... },
  "typography": { ... },
  "radius": { ... },
  "spacing": { ... },
  "shadow": { ... },
  "animation": { ... },
  "components": { ... }
}
```

### 2.1 Color Tokens

#### Background

| Token | Hex | Usage |
|-------|-----|-------|
| `color.background.default` | `#08090A` | Page background, body |
| `color.background.subtle` | `#0D0E10` | Inset panels, subtle depth |
| `color.background.elevated` | `#161719` | Cards, panels (`.panel` class) |
| `color.background.overlay` | `#1B1C1F` | Modals, dropdowns, tooltips |

#### Border

| Token | Hex | Usage |
|-------|-----|-------|
| `color.border.default` | `#22232680` | Standard borders (50% opacity) |
| `color.border.subtle` | `#1A1B1E` | Inset dividers |
| `color.border.strong` | `#2A2B2F` | Emphasized borders, focus rings |

#### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `color.text.primary` | `#F7F8F8` | Body text, headings |
| `color.text.secondary` | `#B4B8BE` | Descriptions, meta text |
| `color.text.tertiary` | `#62666D` | Placeholders, hints |
| `color.text.disabled` | `#3D4046` | Disabled labels |
| `color.text.accent` | `#5E6AD2` | Links, highlighted text |

#### Accent

| Token | Hex | Usage |
|-------|-----|-------|
| `color.accent.primary` | `#5E6AD2` | Primary buttons, active states |
| `color.accent.primaryHover` | `#7170FF` | Hover state for primary actions |
| `color.accent.secondary` | `#9F8FEF` | Secondary accent, tags |

#### Status

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `color.status.success` | `#4CB782` | `linear-status-success` | Healthy, completed, online |
| `color.status.warning` | `#E2B203` | `linear-status-warning` | Degraded, attention needed |
| `color.status.danger` | `#EB5757` | `linear-status-danger` | Failed, error, offline |
| `color.status.info` | `#3D8BFD` | `linear-status-info` | Informational, neutral status |

#### Gradient

| Token | Value | Usage |
|-------|-------|-------|
| `color.gradient.panelTop` | `linear-gradient(180deg, rgba(94,106,210,0.04) 0%, transparent 30%)` | Panel top glow overlay |
| `color.gradient.panelBottom` | `linear-gradient(0deg, rgba(61,139,253,0.03) 0%, transparent 30%)` | Panel bottom glow overlay |

### 2.2 Typography

| Category | Token | Value |
|----------|-------|-------|
| **Font families** | `sans` | Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif |
| | `mono` | JetBrains Mono, Fira Code, ui-monospace, monospace |
| | `display` | Cinzel, Inter Display, serif |
| **Font sizes** | `xs` | 11px |
| | `sm` | 12px |
| | `base` | 13px |
| | `md` | 14px |
| | `lg` | 16px |
| | `xl` | 20px |
| | `2xl` | 24px |
| | `3xl` | 32px |
| **Line heights** | `tight` | 1.2 |
| | `normal` | 1.5 |
| | `loose` | 1.75 |
| **Font weights** | `regular` | 400 |
| | `medium` | 500 |
| | `semibold` | 600 |
| | `bold` | 700 |
| **Letter spacing** | `tight` | -0.01em |
| | `normal` | 0 |
| | `wide` | 0.05em |

### 2.3 Spacing

Base unit: `4px`. Scale: `0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16`.

| Token | Value |
|-------|-------|
| `spacing.0` | 0px |
| `spacing.1` | 4px |
| `spacing.2` | 8px |
| `spacing.3` | 12px |
| `spacing.4` | 16px |
| `spacing.5` | 20px |
| `spacing.6` | 24px |
| `spacing.8` | 32px |
| `spacing.10` | 40px |
| `spacing.12` | 48px |
| `spacing.16` | 64px |

### 2.4 Radii

| Token | Value |
|-------|-------|
| `radius.none` | 0px |
| `radius.sm` | 4px |
| `radius.md` | 6px |
| `radius.lg` | 8px |
| `radius.xl` | 12px |
| `radius.full` | 9999px |

### 2.5 Shadows

| Token | Value |
|-------|-------|
| `shadow.sm` | `0 1px 2px rgba(0, 0, 0, 0.4)` |
| `shadow.md` | `0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)` |
| `shadow.lg` | `0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)` |
| `shadow.glow` | `0 0 0 1px rgba(94, 106, 210, 0.4), 0 0 12px rgba(94, 106, 210, 0.3)` |
| `shadow.glowDanger` | `0 0 0 1px rgba(235, 87, 87, 0.4), 0 0 12px rgba(235, 87, 87, 0.3)` |

### 2.6 Animation

| Token | Value |
|-------|-------|
| `animation.duration.fast` | 120ms |
| `animation.duration.normal` | 200ms |
| `animation.duration.slow` | 320ms |
| `animation.easing.easeOut` | cubic-bezier(0.16, 1, 0.3, 1) |
| `animation.easing.easeInOut` | cubic-bezier(0.4, 0, 0.2, 1) |

---

## 3. Tailwind Config (`packages/ui/tailwind.config.js`)

Tokens are mapped to Tailwind utilities under `theme.extend.colors`.

### 3.1 UPPERCASE DEFAULT Key Requirement (ADR-030)

Every color group that needs a default value **must** use the `DEFAULT` key:

```js
// CORRECT — tailwind generates `bg-linear-bg`, `text-linear-text`, etc.
"linear-bg": {
  DEFAULT: "#08090A",
  subtle: "#0D0E10",
  elevated: "#161719",
  overlay: "#1B1C1F",
}

// WRONG — generates nothing usable as bare class
"linear-bg": {
  default: "#08090A",  // lowercase "default" does NOT work
}
```

This is required because Tailwind treats the `DEFAULT` key (uppercase) as the bare color.
Without it, `bg-linear-bg` resolves to nothing; you would need `bg-linear-bg-default`.

**ADR-030 rationale:** The Tailwind convention is `DEFAULT` (uppercase), not `default` (lowercase).
Lowercase generates a sub-key named `default`, not the bare color.

### 3.2 Linear Color Mapping

```js
colors: {
  "linear-bg": {
    DEFAULT: "#08090A",    // → bg-linear-bg
    subtle: "#0D0E10",     // → bg-linear-bg-subtle
    elevated: "#161719",   // → bg-linear-bg-elevated
    overlay: "#1B1C1F",    // → bg-linear-bg-overlay
  },
  "linear-border": {
    DEFAULT: "#22232680",  // → border-linear-border
    subtle: "#1A1B1E",     // → border-linear-border-subtle
    strong: "#2A2B2F",     // → border-linear-border-strong
  },
  "linear-text": {
    DEFAULT: "#F7F8F8",    // → text-linear-text
    secondary: "#B4B8BE",  // → text-linear-text-secondary
    tertiary: "#62666D",   // → text-linear-text-tertiary
    disabled: "#3D4046",   // → text-linear-text-disabled
    accent: "#5E6AD2",     // → text-linear-text-accent
  },
  "linear-accent": {
    DEFAULT: "#5E6AD2",    // → bg-linear-accent
    hover: "#7170FF",      // → bg-linear-accent-hover
    secondary: "#9F8FEF",  // → bg-linear-accent-secondary
  },
  "linear-status": {
    success: "#4CB782",    // → text-linear-status-success
    warning: "#E2B203",    // → text-linear-status-warning
    danger: "#EB5757",     // → text-linear-status-danger
    info: "#3D8BFD",       // → text-linear-status-info
  },
}
```

### 3.3 Legacy Bronze-Punk Palette (Backward Compatibility)

The original Bronze-Punk palette is retained for components that still reference it.
New components should use Linear tokens instead.

```js
// Legacy palette — kept for backward compat
gunmetal: {
  50: "#2a2a2a", 100: "#262626", 200: "#222222",
  300: "#1e1e1e", 400: "#1a1a1a", 500: "#161616",
  600: "#121212", 700: "#0e0e0e", 800: "#0a0a0a", 900: "#060606",
},
bronze: {
  50: "#fdf8f0", 100: "#f5e6cc", 200: "#e8c98a",
  300: "#cd7f32", 400: "#b87333", 500: "#a0651f",
  600: "#7d4d12", 700: "#5a3608", 800: "#3d2404", 900: "#1f1202",
},
cyan: {
  400: "#22e5ff", 500: "#00e5ff", 600: "#00b8cc",
},
```

Usage examples in existing components:
- `bg-bronze-400/10` — bronze button background
- `border-bronze-400/30` — bronze button border
- `text-cyan-500` — cyan text accents
- `bg-gunmetal-500` — dark input backgrounds

### 3.4 Extended Utilities

```js
fontFamily: {
  mono: ["JetBrains Mono", "Fira Code", "monospace"],
  display: ["Cinzel", "serif"],
},
animation: {
  "scan-line": "scan-line 8s linear infinite",
  "glow-pulse": "glow-pulse 2s ease-in-out infinite",
  "flicker": "flicker 3s linear infinite",
},
```

---

## 4. CSS Variables (`globals.css`)

CSS custom properties mirror the Tailwind tokens for use in raw CSS and `@layer components`.

```css
:root {
  /* Linear (MVE) design system */
  --linear-bg-default: #08090A;
  --linear-bg-subtle: #0D0E10;
  --linear-bg-elevated: #161719;
  --linear-bg-overlay: #1B1C1F;
  --linear-border-default: #22232680;
  --linear-border-subtle: #1A1B1E;
  --linear-border-strong: #2A2B2F;
  --linear-text-primary: #F7F8F8;
  --linear-text-secondary: #B4B8BE;
  --linear-text-tertiary: #62666D;
  --linear-text-disabled: #3D4046;
  --linear-text-accent: #5E6AD2;
  --linear-accent-primary: #5E6AD2;
  --linear-accent-primary-hover: #7170FF;
  --linear-accent-secondary: #9F8FEF;
  --linear-status-success: #4CB782;
  --linear-status-warning: #E2B203;
  --linear-status-danger: #EB5757;
  --linear-status-info: #3D8BFD;
  --linear-radius-sm: 4px;
  --linear-radius-md: 6px;
  --linear-radius-lg: 8px;
  --linear-radius-xl: 12px;
  --linear-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.32);
  --linear-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.40);
  --linear-shadow-glow: 0 0 12px rgba(94, 106, 210, 0.45);
  --linear-shadow-glow-danger: 0 0 12px rgba(235, 87, 87, 0.50);

  /* Bronze-Punk palette (legacy) */
  --color-gunmetal: #1a1a1a;
  --color-bronze: #b87333;
  --color-bronze-light: #cd7f32;
  --color-cyan: #00e5ff;
}
```

**Naming convention:** CSS variables use `--linear-{category}-{variant}` format.
The `linear-` prefix avoids collisions with Tailwind's internal variables and other CSS libraries.

---

## 5. Component Classes (`@layer components`)

### 5.1 `.panel`

Base card/panel component. Uses Linear elevated background with subtle gradient overlay.

```css
.panel {
  @apply bg-linear-bg-elevated border border-linear-border-subtle rounded-md relative overflow-hidden;
}
.panel::before {
  content: "";
  @apply absolute inset-0 pointer-events-none;
  background: linear-gradient(
    180deg,
    rgba(94, 106, 210, 0.04) 0%,
    transparent 30%,
    transparent 70%,
    rgba(94, 106, 210, 0.02) 100%
  );
}
```

Usage:
```tsx
<div className="panel p-4">...</div>
```

### 5.2 `.accent-border`

Highlighted panel with accent glow. Used for active/selected panels.

```css
.accent-border {
  @apply relative border border-linear-accent;
}
.accent-border::after {
  content: "";
  @apply absolute inset-0 pointer-events-none rounded-md;
  box-shadow: 0 0 12px rgba(94, 106, 210, 0.45);
}
```

Usage:
```tsx
<div className="accent-border p-4">Active panel</div>
```

### 5.3 `.btn-primary`

Primary action button. Linear accent background with hover glow.

```css
.btn-primary {
  @apply px-4 py-2 bg-linear-accent text-linear-text font-medium text-sm transition-all rounded-md;
}
.btn-primary:hover {
  @apply bg-linear-accent-hover;
  box-shadow: 0 0 12px rgba(94, 106, 210, 0.45);
}
```

### 5.4 `.btn-secondary`

Secondary/ghost button. Elevated background with subtle border.

```css
.btn-secondary {
  @apply px-4 py-2 bg-linear-bg-elevated border border-linear-border-strong text-linear-text-secondary font-medium text-sm transition-all rounded-md;
}
.btn-secondary:hover {
  @apply bg-linear-bg-overlay text-linear-text border-linear-accent;
}
```

### 5.5 Legacy Buttons (Backward Compatibility)

```css
/* Bronze-Punk cyan button */
.btn-cyan {
  @apply px-4 py-2 bg-cyan-500/10 border border-cyan-500 text-cyan-500 font-mono uppercase tracking-wider text-sm transition-all;
}

/* Bronze-Punk bronze button */
.btn-bronze {
  @apply px-4 py-2 bg-bronze-400/10 border border-bronze-400 text-bronze-300 font-mono uppercase tracking-wider text-sm transition-all;
}
```

---

## 6. Status Indicators

Status indicator classes use the Linear status palette:

```css
.status-healthy  { @apply text-linear-status-success; }   /* #4CB782 */
.status-degraded { @apply text-linear-status-warning; }    /* #E2B203 */
.status-failed   { @apply text-linear-status-danger; }     /* #EB5757 */
.status-offline  { @apply text-linear-text-disabled; }     /* #3D4046 */
```

Usage:
```tsx
<span className="status-healthy">● Online</span>
<span className="status-degraded">● Degraded</span>
<span className="status-failed">● Offline</span>
```

---

## 7. Utility Classes (`@layer utilities`)

### 7.1 `.scanlines`

CRT scanline overlay effect. Adds horizontal lines at 50% transparency.

```css
.scanlines { position: relative; }
.scanlines::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 50%, rgba(0, 0, 0, 0.05) 50%);
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 10;
}
```

### 7.2 `.rune`

Cyan glowing text effect using the display font.

```css
.rune {
  @apply font-display text-cyan-500;
  text-shadow: 0 0 4px #00e5ff, 0 0 8px #00e5ff;
}
```

---

## 8. Component Token Definitions

`tokens/linear.json` also defines component-level tokens that compose the base tokens:

### 8.1 Panel

```json
{
  "components": {
    "panel": {
      "background": "var(--linear-bg-elevated)",
      "border": "1px solid var(--linear-border-default)",
      "borderRadius": "var(--linear-radius-lg)",
      "padding": "var(--linear-spacing-4)",
      "boxShadow": "var(--linear-shadow-sm)"
    }
  }
}
```

### 8.2 Button

```json
{
  "components": {
    "button": {
      "primary": {
        "background": "var(--linear-accent-primary)",
        "color": "var(--linear-text-primary)",
        "borderRadius": "var(--linear-radius-md)",
        "padding": "6px 12px",
        "fontWeight": 500
      },
      "secondary": {
        "background": "var(--linear-bg-elevated)",
        "color": "var(--linear-text-secondary)",
        "border": "1px solid var(--linear-border-default)",
        "borderRadius": "var(--linear-radius-md)",
        "padding": "6px 12px"
      }
    }
  }
}
```

### 8.3 Badge

```json
{
  "components": {
    "badge": {
      "background": "var(--linear-bg-overlay)",
      "color": "var(--linear-text-secondary)",
      "borderRadius": "var(--linear-radius-full)",
      "padding": "2px 8px",
      "fontSize": "var(--linear-fontSize-xs)"
    }
  }
}
```

---

## 9. Usage Guidelines

### When to Use Linear Tokens

Use Linear tokens for **all new components**. They are the canonical design system.

| Situation | Token | Tailwind Class |
|-----------|-------|----------------|
| Panel background | `color.background.elevated` | `bg-linear-bg-elevated` |
| Panel border | `color.border.subtle` | `border-linear-border-subtle` |
| Primary button | `color.accent.primary` | `bg-linear-accent` |
| Body text | `color.text.primary` | `text-linear-text` |
| Success status | `color.status.success` | `text-linear-status-success` |

### When to Use Bronze-Punk Tokens

Use Bronze-Punk tokens **only** for legacy components that already reference them.
Do not introduce new Bronze-Punk usage. Migrate existing usages opportunistically.

| Token | Tailwind Class | Legacy Context |
|-------|---------------|----------------|
| `bronze-400` | `bg-bronze-400` | Bronze button backgrounds |
| `cyan-500` | `text-cyan-500` | Rune text, cyan accents |
| `gunmetal-500` | `bg-gunmetal-500` | Dark input backgrounds |

### Migration Path

1. New components: use `linear-*` tokens exclusively
2. Existing Bronze-Punk components: migrate to Linear on next edit
3. Do not create new Bronze-Punk component classes (`.btn-cyan`, `.btn-bronze` are frozen)

---

## 10. Adding New Tokens

### Step 1: Update `tokens/linear.json`

Add the new value to the appropriate section:

```json
{
  "color": {
    "status": {
      "maintenance": "#8B5CF6"
    }
  }
}
```

### Step 2: Update Tailwind Config

Add the token to `packages/ui/tailwind.config.js`:

```js
colors: {
  "linear-status": {
    success: "#4CB782",
    warning: "#E2B203",
    danger: "#EB5757",
    info: "#3D8BFD",
    maintenance: "#8B5CF6",  // NEW
  },
}
```

### Step 3: Add CSS Variable

Add to `packages/ui/src/app/globals.css`:

```css
:root {
  --linear-status-maintenance: #8B5CF6;
}
```

### Step 4: Add Component Class (if applicable)

```css
.status-maintenance {
  @apply text-linear-status-maintenance;
}
```

### Step 5: Document

Update this file with the new token in the appropriate table.

---

## 11. File Locations

| File | Purpose |
|------|---------|
| `tokens/linear.json` | Canonical token definitions (JSON) |
| `packages/ui/tailwind.config.js` | Tailwind color/font/animation mapping |
| `packages/ui/src/app/globals.css` | CSS custom properties + component classes |
| `scripts/apply-design-system.js` | Script to inject tokens from JSON into Tailwind/CSS |

---

## 12. Design Principles

1. **Dark-first.** All tokens are defined for dark mode. Light mode is not planned for the MVE.
2. **Subtlety over saturation.** Linear's aesthetic favors muted backgrounds with accent highlights.
3. **Gradient overlays.** Panels use `::before` pseudo-elements for subtle gradient glow, not solid colors.
4. **Consistent radius.** Use `radius-md` (6px) for buttons, `radius-lg` (8px) for panels, `radius-full` for badges.
5. **Monospace for data.** Agent outputs, config, and logs use JetBrains Mono. UI chrome uses Inter.
6. **Bronze-Punk as accent.** The bronze/cyan palette is for identity and accent, not primary UI chrome.
