# GraphyFi Design System - Implementation Guide
## CSS Tokens & React Component Specifications

---

## SECTION 1: CSS CUSTOM PROPERTIES (Design Tokens)

```css
/* ============================================
   COLOR TOKENS - Primary Brand
   ============================================ */

:root {
  /* Accent - Ethereum Blue (Primary Actions) */
  --color-accent-50: #f0f6ff;
  --color-accent-100: #e0ecff;
  --color-accent-200: #c1dfff;
  --color-accent-300: #a2d2ff;
  --color-accent-400: #5590ff;
  --color-accent-500: #3d7fff;      /* Primary */
  --color-accent-600: #2e5acc;
  --color-accent-700: #1f3a99;
  --color-accent-800: #152a73;
  --color-accent-900: #0c194d;

  /* Secondary - Teal (Secondary Actions, Info) */
  --color-secondary-50: #f0fdfc;
  --color-secondary-100: #e0fbf9;
  --color-secondary-200: #c1f7f3;
  --color-secondary-300: #a2f3ed;
  --color-secondary-400: #64ede7;
  --color-secondary-500: #06b6d4;  /* Primary */
  --color-secondary-600: #0891b2;
  --color-secondary-700: #066d90;
  --color-secondary-800: #044d6d;
  --color-secondary-900: #032d4a;

  /* Success - Emerald (Positive, Growth, Approvals) */
  --color-success-50: #f0fdf4;
  --color-success-100: #dcfce7;
  --color-success-200: #bbf7d0;
  --color-success-300: #86efac;
  --color-success-400: #4ade80;
  --color-success-500: #22c55e;     /* Primary */
  --color-success-600: #16a34a;
  --color-success-700: #15803d;
  --color-success-800: #166534;
  --color-success-900: #145231;

  /* Warning - Amber (Pending, Caution, Review) */
  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-200: #fde68a;
  --color-warning-300: #fcd34d;
  --color-warning-400: #fbbf24;
  --color-warning-500: #f59e0b;     /* Primary */
  --color-warning-600: #d97706;
  --color-warning-700: #b45309;
  --color-warning-800: #92400e;
  --color-warning-900: #78350f;

  /* Danger - Red (Losses, Rejections, Errors) */
  --color-danger-50: #fef2f2;
  --color-danger-100: #fee2e2;
  --color-danger-200: #fecaca;
  --color-danger-300: #fca5a5;
  --color-danger-400: #f87171;
  --color-danger-500: #ef4444;      /* Primary */
  --color-danger-600: #dc2626;
  --color-danger-700: #b91c1c;
  --color-danger-800: #991b1b;
  --color-danger-900: #7f1d1d;

  /* Neutral - Grayscale (UI Elements, Text) */
  --color-neutral-50: #f9fafb;
  --color-neutral-100: #f3f4f6;
  --color-neutral-200: #e5e7eb;
  --color-neutral-300: #d1d5db;
  --color-neutral-400: #9ca3af;
  --color-neutral-500: #6b7280;
  --color-neutral-600: #4b5563;
  --color-neutral-700: #374151;
  --color-neutral-800: #1f2937;
  --color-neutral-900: #111827;

  /* ============================================
     DARK MODE OVERRIDES (Midnight Professional)
     ============================================ */
}

[data-theme="midnight-professional"] {
  /* Primary Colors (adjusted for dark mode) */
  --color-accent-500: #3d7fff;
  --color-secondary-500: #06b6d4;
  --color-success-500: #22c55e;
  --color-warning-500: #f59e0b;
  --color-danger-500: #ef4444;

  /* Neutral Colors (inverted) */
  --color-neutral-50: #0a0d14;     /* Darkest */
  --color-neutral-100: #0f1420;
  --color-neutral-200: #141926;
  --color-neutral-300: #1a2035;
  --color-neutral-400: #1e2640;
  --color-neutral-500: #243255;
  --color-neutral-600: #2d3d5f;
  --color-neutral-700: #3d5080;
  --color-neutral-800: #4d64a0;
  --color-neutral-900: #8892aa;    /* Lightest (for text) */
}

/* ============================================
   TYPOGRAPHY TOKENS (Fibonacci-Based)
   ============================================ */

:root {
  --font-family-primary: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-mono: 'JetBrains Mono', monospace;

  /* Font Sizes (Fibonacci: 13, 21, 34, 55) */
  --font-size-xs: 11px;           /* Captions, badges */
  --font-size-sm: 13px;           /* Body, form labels */
  --font-size-base: 16px;         /* Paragraph text */
  --font-size-md: 18px;           /* Subsection headings */
  --font-size-lg: 21px;           /* Section headings */
  --font-size-xl: 34px;           /* Page subtitles */
  --font-size-2xl: 55px;          /* Page titles */

  /* Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;

  /* Line Heights (1.5 × font-size for readability) */
  --line-height-xs: 1.2;          /* Headings */
  --line-height-sm: 1.4;          /* Subheadings */
  --line-height-base: 1.6;        /* Body text */
  --line-height-relaxed: 1.8;     /* Long-form content */

  /* Letter Spacing */
  --letter-spacing-tight: -0.5px;   /* Headings (tighter) */
  --letter-spacing-normal: 0px;     /* Default */
  --letter-spacing-wide: 0.5px;     /* Labels (clarity) */
  --letter-spacing-wider: 0.6px;    /* Badges, all-caps */
}

/* ============================================
   SPACING TOKENS (4px Grid, Fibonacci)
   ============================================ */

:root {
  --spacing-1: 4px;              /* 1×4 */
  --spacing-2: 8px;              /* 2×4 */
  --spacing-3: 12px;             /* 3×4 */
  --spacing-5: 20px;             /* 5×4 */
  --spacing-8: 32px;             /* 8×4 */
  --spacing-13: 52px;            /* 13×4 */
  --spacing-21: 84px;            /* 21×4 */
  --spacing-34: 136px;           /* 34×4 */

  /* Gap shortcuts for flex/grid */
  --gap-xs: var(--spacing-1);
  --gap-sm: var(--spacing-2);
  --gap-md: var(--spacing-3);
  --gap-lg: var(--spacing-5);
  --gap-xl: var(--spacing-8);
  --gap-2xl: var(--spacing-13);
}

/* ============================================
   BORDER RADIUS TOKENS
   ============================================ */

:root {
  --radius-sm: 6px;               /* Small elements */
  --radius-base: 10px;            /* Default */
  --radius-md: 12px;              /* Cards, modals */
  --radius-lg: 14px;              /* Larger cards */
  --radius-full: 999px;           /* Pills, badges */
}

/* ============================================
   SHADOW TOKENS (Elevation)
   ============================================ */

:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-base: 0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.25);

  /* Dark mode shadows */
}

[data-theme="midnight-professional"] {
  --shadow-base: 0 4px 16px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.6);
}

/* ============================================
   TRANSITION TOKENS
   ============================================ */

:root {
  --transition-fast: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slower: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);

  /* Easing functions (cubic-bezier) */
  --easing-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --easing-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --easing-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* ============================================
   SEMANTIC COLOR MAPPINGS
   ============================================ */

:root {
  /* Background Surfaces */
  --surface-primary: var(--color-neutral-50);      /* Main background */
  --surface-secondary: var(--color-neutral-100);   /* Cards, panels */
  --surface-tertiary: var(--color-neutral-200);    /* Hover states */
  --surface-overlay: rgba(0, 0, 0, 0.65);          /* Modals, overlays */

  /* Text Colors */
  --text-primary: var(--color-neutral-900);
  --text-secondary: var(--color-neutral-600);
  --text-muted: var(--color-neutral-500);
  --text-disabled: var(--color-neutral-400);

  /* Border Colors */
  --border-primary: var(--color-neutral-200);
  --border-secondary: var(--color-neutral-300);
  --border-accent: rgba(61, 127, 255, 0.3);        /* Accent borders */

  /* Interactive Colors */
  --interactive-primary: var(--color-accent-500);
  --interactive-primary-hover: var(--color-accent-400);
  --interactive-secondary: var(--color-secondary-500);
  --interactive-disabled: var(--color-neutral-400);

  /* Status Colors */
  --status-success: var(--color-success-500);
  --status-warning: var(--color-warning-500);
  --status-danger: var(--color-danger-500);
  --status-info: var(--color-secondary-500);
}

[data-theme="midnight-professional"] {
  --surface-primary: var(--color-neutral-50);      /* #0a0d14 */
  --surface-secondary: var(--color-neutral-100);   /* #0f1420 */
  --surface-tertiary: var(--color-neutral-200);    /* #141926 */
  --surface-overlay: rgba(13, 18, 30, 0.96);

  --text-primary: var(--color-neutral-900);        /* #e8eaf0 */
  --text-secondary: var(--color-neutral-600);      /* #8892aa */
  --text-muted: var(--color-neutral-500);          /* #4a5570 */

  --border-primary: var(--color-neutral-300);      /* #1f2d4a */
  --border-secondary: var(--color-neutral-400);    /* #243255 */
  --border-accent: rgba(61, 127, 255, 0.2);
}
```

---

## SECTION 2: COMPONENT CSS SPECIFICATIONS

### Button Components

```css
/* ============================================
   BUTTONS - Standardized Styles
   ============================================ */

.btn {
  /* Base styles */
  border: none;
  border-radius: var(--radius-base);
  font-family: var(--font-family-primary);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: var(--transition-base);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  white-space: nowrap;

  /* Default sizing (md) */
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  min-height: 40px;
  min-width: 100px;
}

/* Sizing Variants */
.btn-xs {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
  min-height: 24px;
  min-width: 56px;
  border-radius: var(--radius-sm);
}

.btn-sm {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-xs);
  min-height: 32px;
  min-width: 80px;
}

.btn-lg {
  padding: var(--spacing-5) var(--spacing-8);
  font-size: var(--font-size-base);
  min-height: 48px;
  min-width: 120px;
}

.btn-xl {
  padding: var(--spacing-8) var(--spacing-13);
  font-size: var(--font-size-md);
  min-height: 56px;
  min-width: 140px;
}

/* Variant: Primary */
.btn-primary {
  background: linear-gradient(
    135deg,
    var(--color-accent-500),
    var(--color-accent-400)
  );
  color: white;
  box-shadow: 0 4px 12px rgba(61, 127, 255, 0.2);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(
    135deg,
    var(--color-accent-400),
    var(--color-accent-300)
  );
  box-shadow: 0 8px 24px rgba(61, 127, 255, 0.3);
  transform: translateY(-2px);
}

.btn-primary:active:not(:disabled) {
  background: linear-gradient(
    135deg,
    var(--color-accent-600),
    var(--color-accent-500)
  );
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(61, 127, 255, 0.2);
}

/* Variant: Secondary */
.btn-secondary {
  background: var(--surface-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-accent);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--surface-secondary);
  border-color: var(--color-accent-500);
}

/* Variant: Danger */
.btn-danger {
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-danger-500);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: var(--color-danger-500);
}

/* Variant: Ghost (minimal) */
.btn-ghost {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid transparent;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--surface-tertiary);
  border-color: var(--border-secondary);
}

/* Disabled State */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* Icon Button */
.btn-icon {
  padding: var(--spacing-2);
  min-width: 32px;
  min-height: 32px;
  border-radius: var(--radius-sm);
}

.btn-icon svg {
  width: 16px;
  height: 16px;
}
```

### Card Components

```css
/* ============================================
   CARDS - Elevated Surfaces
   ============================================ */

.card {
  background: var(--surface-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-base);
  transition: var(--transition-base);
  display: flex;
  flex-direction: column;
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

/* Card Header */
.card-header {
  padding: var(--spacing-5);
  border-bottom: 1px solid var(--border-secondary);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-3);
}

.card-header h3,
.card-header h4 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
}

.card-header .page-subtitle {
  margin-top: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  line-height: var(--line-height-base);
}

/* Card Body */
.card-body {
  padding: var(--spacing-5);
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

/* Golden Ratio Card Variants */
.card-landscape {
  aspect-ratio: 1.618 / 1;
}

.card-portrait {
  aspect-ratio: 1 / 1.618;
}

.card-square {
  aspect-ratio: 1 / 1;
}

/* Insight Card (KPI) */
.card-insight {
  background: linear-gradient(
    135deg,
    rgba(61, 127, 255, 0.08),
    rgba(6, 182, 212, 0.08)
  );
  border: 1px solid rgba(61, 127, 255, 0.2);
}

.card-insight:hover {
  border-color: rgba(61, 127, 255, 0.4);
  box-shadow: 0 8px 24px rgba(61, 127, 255, 0.12);
}

/* Minimal Card (reduced visual weight) */
.card-minimal {
  border: 1px dashed var(--border-secondary);
  box-shadow: none;
}

.card-minimal:hover {
  border-color: var(--border-accent);
  box-shadow: none;
}
```

### Form Components

```css
/* ============================================
   FORMS - Inputs, Labels, Validation
   ============================================ */

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-5);
}

.form-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wider);
}

/* Input Fields */
.form-control {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-3);
  background: var(--surface-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-base);
  font-family: var(--font-family-primary);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  transition: var(--transition-base);
  line-height: 1.5;
}

.form-control::placeholder {
  color: var(--text-muted);
}

.form-control:focus {
  outline: none;
  border-color: var(--color-accent-500);
  box-shadow: 0 0 0 3px rgba(61, 127, 255, 0.12);
  background: var(--surface-secondary);
}

.form-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--surface-tertiary);
}

/* Validation States */
.form-control.is-invalid {
  border-color: var(--color-danger-500);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.form-control.is-invalid:focus {
  border-color: var(--color-danger-600);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.form-control.is-success {
  border-color: var(--color-success-500);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.12);
}

.form-control.is-success:focus {
  border-color: var(--color-success-600);
}

/* Form Messages */
.form-error {
  font-size: var(--font-size-xs);
  color: var(--color-danger-500);
  margin-top: var(--spacing-1);
  line-height: 1.4;
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  margin-top: var(--spacing-1);
}

.form-success {
  font-size: var(--font-size-xs);
  color: var(--color-success-500);
  margin-top: var(--spacing-1);
}

/* Select Dropdown */
select.form-control {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234a5570' d='M1 3l5 6 5-6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--spacing-3) center;
  padding-right: var(--spacing-8);
}

/* Textarea */
textarea.form-control {
  resize: vertical;
  min-height: 100px;
  font-family: var(--font-family-primary);
}

/* Grid Layout */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-5);
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-5);
}

@media (max-width: 768px) {
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
```

### Table Components

```css
/* ============================================
   TABLES - Data Display
   ============================================ */

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.table thead {
  background: var(--surface-tertiary);
  border-bottom: 2px solid var(--border-primary);
  position: sticky;
  top: 0;
  z-index: 5;
}

.table th {
  padding: var(--spacing-3) var(--spacing-5);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  font-size: var(--font-size-xs);
}

.table td {
  padding: var(--spacing-3) var(--spacing-5);
  border-bottom: 1px solid var(--border-secondary);
  vertical-align: middle;
  color: var(--text-primary);
}

.table tbody tr {
  transition: background-color var(--transition-fast);
}

.table tbody tr:hover {
  background: var(--surface-tertiary);
}

/* Expandable Rows */
.table tr.expandable {
  cursor: pointer;
  position: relative;
}

.table tr.expandable::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: transparent;
  transition: background-color var(--transition-fast);
}

.table tr.expandable:hover::before {
  background: var(--color-accent-500);
}

.table-expand-toggle {
  cursor: pointer;
  user-select: none;
  font-weight: bold;
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}

.table-expand-toggle.open {
  transform: rotate(180deg);
}

/* Expanded Content Row */
.table-expand-content {
  background: var(--surface-tertiary);
  padding: var(--spacing-5);
  border-top: 1px solid var(--border-secondary);
  display: none;
}

.table-expand-content.open {
  display: table-row;
}
```

### Badge & Status Components

```css
/* ============================================
   BADGES - Inline Status Indicators
   ============================================ */

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wider);
  white-space: nowrap;
}

/* Status Badges */
.badge-success {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-success-500);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge-danger {
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-danger-500);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-warning {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning-500);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.badge-info {
  background: rgba(6, 182, 212, 0.12);
  color: var(--color-secondary-500);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.badge-neutral {
  background: rgba(136, 146, 170, 0.12);
  color: var(--text-secondary);
  border: 1px solid rgba(136, 146, 170, 0.3);
}

/* Pulse Animation */
.badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Status Badge (filled) */
.status-badge {
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-base);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-align: center;
}

.status-badge-completed {
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success-600);
  border: 1px solid var(--color-success-500);
}

.status-badge-pending {
  background: rgba(245, 158, 11, 0.2);
  color: var(--color-warning-700);
  border: 1px solid var(--color-warning-500);
}

.status-badge-failed {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-danger-600);
  border: 1px solid var(--color-danger-500);
}

.status-badge-in-progress {
  background: rgba(6, 182, 212, 0.2);
  color: var(--color-secondary-600);
  border: 1px solid var(--color-secondary-500);
}
```

---

## SECTION 3: REACT COMPONENT EXAMPLES

### Button Component

```jsx
// src/components/ui/Button.jsx
import React from 'react';

const Button = React.forwardRef(({
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon: Icon = null,
  children,
  className = '',
  ...props
}, ref) => {
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;

  return (
    <button
      ref={ref}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;

// Usage:
// <Button variant="primary" size="lg" icon={Plus}>Add Item</Button>
// <Button variant="danger" size="sm">Delete</Button>
// <Button variant="secondary" disabled>Save (Processing...)</Button>
```

### Card Component

```jsx
// src/components/ui/Card.jsx
import React from 'react';

export const Card = ({ children, className = '', ...props }) => (
  <div className={`card ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`card-header ${className}`} {...props}>
    {children}
  </div>
);

export const CardBody = ({ children, className = '', ...props }) => (
  <div className={`card-body ${className}`} {...props}>
    {children}
  </div>
);

// Usage:
// <Card>
//   <CardHeader>
//     <h3>Revenue Dashboard</h3>
//   </CardHeader>
//   <CardBody>
//     <p>Content here</p>
//   </CardBody>
// </Card>
```

### FormGroup Component

```jsx
// src/components/ui/FormGroup.jsx
import React from 'react';

const FormGroup = ({ label, error, hint, children, required = false }) => {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}
          {required && <span style={{ color: 'var(--color-danger-500)' }}> *</span>}
        </label>
      )}
      {children}
      {error && <div className="form-error">{error}</div>}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
};

export default FormGroup;

// Usage:
// <FormGroup 
//   label="Customer Name" 
//   error={formErrors.name}
//   hint="Full business name"
//   required
// >
//   <input 
//     className="form-control"
//     value={form.name}
//     onChange={(e) => setForm({...form, name: e.target.value})}
//   />
// </FormGroup>
```

### Expandable Table Row

```jsx
// src/components/ui/ExpandableTable.jsx
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ExpandableTableRow = ({ id, data, expandedContent }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <tr 
        className="expandable"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td style={{ width: '40px' }}>
          <span className={`table-expand-toggle ${isExpanded ? 'open' : ''}`}>
            <ChevronDown size={16} />
          </span>
        </td>
        {/* Data cells */}
        {Object.entries(data).map(([key, value]) => (
          <td key={key}>{value}</td>
        ))}
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={Object.keys(data).length + 1}>
            <div className="table-expand-content open">
              {expandedContent}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default ExpandableTableRow;

// Usage:
// <table className="table">
//   <tbody>
//     <ExpandableTableRow
//       id="order-123"
//       data={{ orderId: 'ORD-123', customer: 'ACME', amount: 'Rs 5,200' }}
//       expandedContent={<OrderDetails orderId="ORD-123" />}
//     />
//   </tbody>
// </table>
```

---

## SECTION 4: MIGRATION CHECKLIST

Use this checklist when implementing the design system:

### Phase 1: Foundation (Week 1-2)
- [ ] Update `globals.css` with all CSS tokens
- [ ] Create component library in `src/components/ui/`
- [ ] Update all color references from hardcoded values to CSS variables
- [ ] Test dark mode rendering
- [ ] Verify button accessibility (focus states, keyboard navigation)

### Phase 2: Components (Week 3-4)
- [ ] Refactor all buttons to use new `Button` component
- [ ] Refactor all cards to use new `Card`, `CardHeader`, `CardBody` components
- [ ] Update form inputs with new styling and validation states
- [ ] Implement expandable table rows
- [ ] Add badge components to status displays

### Phase 3: Pages (Week 5-6)
- [ ] Update Dashboard (charts, KPI cards)
- [ ] Update Orders page (timeline, expandable rows)
- [ ] Update Quotations (modal redesign)
- [ ] Update Contacts (form simplification)
- [ ] Update Accounting (voucher entry redesign)

### Phase 4: Testing (Week 7)
- [ ] Visual regression testing
- [ ] Accessibility audit (axe DevTools)
- [ ] Performance testing (Lighthouse)
- [ ] User testing with 10 participants
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

### Phase 5: Launch (Week 8)
- [ ] Update documentation
- [ ] Deploy to production
- [ ] Monitor for bugs
- [ ] Gather user feedback

---

*End of Implementation Guide*
