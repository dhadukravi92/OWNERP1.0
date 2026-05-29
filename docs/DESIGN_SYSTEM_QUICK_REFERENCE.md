# GraphyFi Design System - Quick Reference Guide
## For Designers, Developers, and QA Engineers

---

## 🎨 COLOR QUICK REFERENCE

### Brand Colors (Use These!)
```
Primary Action:      #3d7fff (Accent Blue)     Use for buttons, links
Secondary Action:    #06b6d4 (Teal)            Use for secondary CTAs, info
Success/Positive:    #22c55e (Green)           Use for gains, approvals
Warning/Pending:     #f59e0b (Amber)           Use for pending, caution
Error/Negative:      #ef4444 (Red)             Use for losses, errors
Neutral/Disabled:    #8892aa (Gray)            Use for disabled state
```

### Dark Mode Text Colors
```
Primary Text:        #e8eaf0 (Very Light Gray)
Secondary Text:      #8892aa (Medium Gray)
Muted/Hint Text:     #4a5570 (Dark Gray)
```

### Do's and Don'ts
```
✅ DO:
   - Use semantic colors (red for danger, green for success)
   - Apply subtle gradients (135deg angle for depth)
   - Use color overlays with 0.12 opacity for backgrounds

❌ DON'T:
   - Use arbitrary colors (always pick from palette)
   - Mix too many colors (max 4-5 per screen)
   - Use pure black/white (use #0a0d14 / #e8eaf0 instead)
   - Apply color changes without state indication
```

---

## 📏 SPACING & SIZING RULES

### Golden Ratio Grid (4px base unit)
```
xs   =  4px  (icons, micro-padding)
sm   =  8px  (form field gaps)
md   = 12px  (card internal padding)
lg   = 20px  (section padding)
xl   = 32px  (major spacing)
2xl  = 52px  (page sections)
3xl  = 84px  (page margins)
```

### Card Aspect Ratios (Use These!)
```
Square:       1:1          (160px × 160px)
Landscape:    1.618:1      (260px × 160px) ← Golden Ratio
Portrait:     1:1.618      (160px × 260px) ← Golden Ratio
```

### Button Sizes
```
xs  → 6×12px padding, 11px font, 56px min-width
sm  → 8×12px padding, 12px font, 80px min-width
md  → 12×16px padding, 13px font, 100px min-width (default)
lg  → 16×24px padding, 15px font, 120px min-width
xl  → 20×32px padding, 16px font, 140px min-width
```

### Example: Button Spacing
```jsx
<button style={{
  padding: '12px 16px',          // md size
  borderRadius: '10px',          // var(--radius-base)
  gap: '8px',                    // var(--spacing-2)
  minHeight: '40px'
}}>
  Add Item
</button>
```

---

## 🔤 TYPOGRAPHY SCALE (Fibonacci)

### Font Sizes
```
11px  → Captions, badges
13px  → Body text, form labels (default)
16px  → Paragraph text
18px  → Subsection headings
21px  → Section headings
34px  → Page subtitles
55px  → Page titles
```

### Font Weights
```
400  → Regular (body text)
500  → Medium (labels)
600  → Semibold (buttons, strong text)
700  → Bold (headings)
800  → Extrabold (page titles)
```

### Line Heights
```
Headings:     1.2
Subheadings:  1.4
Body text:    1.6
Long-form:    1.8
```

### Example: Heading Hierarchy
```
Page Title:           55px, weight 800, line-height 1.2
Section Heading:      34px, weight 700, line-height 1.2
Subsection Heading:   21px, weight 600, line-height 1.4
Body Text:            13px, weight 400, line-height 1.6
Label/Caption:        11px, weight 600, line-height 1.2, uppercase
```

---

## 🎯 COMPONENT SPECIFICATIONS AT A GLANCE

### Buttons

```
Primary Button (CTA):
  Background:  Linear gradient (135deg)
  Color:       White
  Shadow:      0 4px 12px rgba(61,127,255,0.2)
  Hover:       +20% lightness, +8px shadow, -2px transform
  Active:      -20% lightness, +2px shadow, 0px transform

Secondary Button:
  Background:  var(--surface-tertiary)
  Border:      1px solid var(--border-accent)
  Hover:       darken background, border → accent color

Danger Button:
  Background:  rgba(239,68,68,0.12)
  Border:      1px solid rgba(239,68,68,0.3)
  Color:       #ef4444
  Hover:       Increase opacity of background
```

### Cards

```
Base:
  Background:  var(--surface-secondary)
  Border:      1px solid var(--border-primary)
  Border-radius: 14px
  Shadow:      0 4px 12px rgba(0,0,0,0.1)
  Hover:       +shadow, -2px transform

Insight Card (KPI):
  Background:  Linear gradient (accent + secondary, 0.08 opacity)
  Border:      1px solid rgba(61,127,255,0.2)
  Special:     Used for important metrics, highlights

Minimal Card (low importance):
  Border:      1px dashed var(--border-secondary)
  Shadow:      none
  Hover:       border → accent color
```

### Form Inputs

```
Base:
  Padding:     12px (vertical & horizontal)
  Background:  var(--surface-secondary)
  Border:      1px solid var(--border-primary)
  Border-radius: 10px
  Font-size:   13px

Focus:
  Border:      var(--color-accent-500)
  Shadow:      0 0 0 3px rgba(61,127,255,0.12)

Error:
  Border:      #ef4444
  Shadow:      0 0 0 3px rgba(239,68,68,0.12)
  Message:     11px, color: #ef4444

Success:
  Border:      #22c55e
  Shadow:      0 0 0 3px rgba(34,197,94,0.12)
```

### Tables

```
Header:
  Background:  var(--surface-tertiary)
  Text:        Uppercase, 11px, weight 600
  Padding:     12px (vertical), 20px (horizontal)

Rows:
  Padding:     12px (vertical), 20px (horizontal)
  Hover:       Background → var(--surface-tertiary)
  Border:      1px solid var(--border-secondary)

Expanded Rows:
  Background:  var(--surface-tertiary)
  Padding:     20px
  Use for:     Detailed information without navigation
```

---

## 📐 MATHEMATICAL DESIGN PRINCIPLES

### Golden Ratio (φ = 1.618)
**What it is:** A proportion found in nature that humans perceive as beautiful.

**How we use it:**
- Card aspect ratios: 1.618:1 (landscape) or 1:1.618 (portrait)
- Font size progression: each size × 1.618 = next size
- Not mandatory, but creates visual harmony

### Fibonacci Sequence (1, 2, 3, 5, 8, 13, 21, 34, 55...)
**What it is:** A mathematical sequence where each number is the sum of the previous two.

**How we use it:**
- Spacing: 4px × Fibonacci = our spacing scale
- Font sizes: 13px × Fibonacci multiplier = our typography scale
- Grid columns: Fibonacci ratios for flexible layouts

### Hick's Law (Decision Time = log₂(choices))
**What it is:** The more choices, the longer it takes to decide.

**How we apply it:**
- Navigation: 4 primary categories (not 11 modules)
- Form fields: Show only required fields, hide optional
- Buttons: Max 3 action buttons per section
- Filters: Provide presets, not blank canvas

---

## ⚡ QUICK CHECKLIST FOR DESIGNERS

When designing a new screen, ask yourself:

- [ ] **Colors:** Am I using semantic colors (green for success, red for danger)?
- [ ] **Spacing:** Am I using Fibonacci increments (4, 8, 12, 20, 32, 52, 84)?
- [ ] **Typography:** Is my font size hierarchy clear (at least 3 size levels)?
- [ ] **Contrast:** Do text and background meet WCAG AA standards (4.5:1 ratio)?
- [ ] **Cognitive Load:** Are there more than 8 options on this screen? (If yes, group them)
- [ ] **Cards:** Am I using golden ratio aspect ratios where appropriate?
- [ ] **Buttons:** Do I have clear primary (1) and secondary (max 2) actions?
- [ ] **Responsiveness:** Does this work on mobile without horizontal scroll?
- [ ] **State:** Have I designed loading, error, and success states?
- [ ] **Accessibility:** Can someone use this with only keyboard?

---

## ⚡ QUICK CHECKLIST FOR DEVELOPERS

When implementing a component:

- [ ] **CSS Variables:** Did I use `var(--color-*)`, `var(--spacing-*)`, not hardcoded values?
- [ ] **Transitions:** Do interactive elements have smooth transitions (0.2s default)?
- [ ] **Focus States:** Can users navigate with Tab key? Do focus states have visible border?
- [ ] **Disabled State:** Do disabled buttons have opacity: 0.5 and cursor: not-allowed?
- [ ] **Icons:** Are all icons sized correctly (16px, 18px, 20px - not random)?
- [ ] **Grid:** Am I using CSS Grid for layout, not floats?
- [ ] **Responsiveness:** Does this work on 320px (mobile) and 1920px (desktop)?
- [ ] **Performance:** Are animations hardware-accelerated (transform, opacity only)?
- [ ] **Mobile:** On touch devices, are buttons at least 44px × 44px?
- [ ] **Dark Mode:** Have I tested all components in both light and dark themes?

---

## 🧪 QUICK CHECKLIST FOR QA

When testing a new feature:

- [ ] **Visual:** Does UI match design spec (colors, spacing, fonts)?
- [ ] **Responsiveness:** Test on 3 sizes: 320px, 768px, 1920px
- [ ] **Dark Mode:** Both themes render correctly?
- [ ] **Loading States:** Spinners, skeleton screens showing?
- [ ] **Error States:** Error messages clear and actionable?
- [ ] **Keyboard:** Can users Tab through form fields?
- [ ] **Screen Reader:** Does VoiceOver/NVDA read content properly?
- [ ] **Performance:** Page loads in < 3 seconds?
- [ ] **Validation:** Form validation catches errors before submission?
- [ ] **Undo/Redo:** Ctrl+Z works after create/edit/delete?
- [ ] **Cross-Browser:** Tested in Chrome, Firefox, Safari, Edge?

---

## 🔗 IMPORT STATEMENTS

```jsx
// Colors (use CSS variables, not imports)
import { /* not needed, use var(--color-*) */ }

// Icons from Lucide React
import { Plus, Edit2, Trash2, ChevronDown, AlertTriangle } from 'lucide-react';

// Charts from Recharts
import {
  LineChart, AreaChart, BarChart, PieChart,
  Line, Area, Bar, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

// Components from Zustand (state management)
import { useAppStore } from '../store/appStore';

// Database utilities
import db, { formatCurrency, formatDate } from '../utils/database';
```

---

## 🎨 COMMON PATTERNS

### Success Toast Notification
```jsx
// Usage
<div style={{
  background: 'rgba(34, 197, 94, 0.12)',
  border: '1px solid #22c55e',
  color: '#22c55e',
  padding: '12px 16px',
  borderRadius: '10px',
  fontSize: '13px',
  marginBottom: '16px'
}}>
  ✓ Record saved successfully
</div>
```

### Form Validation Error
```jsx
// Usage
<div className="form-group">
  <label className="form-label">Email</label>
  <input 
    className="form-control is-invalid"
    value={email}
  />
  <div className="form-error">
    Please enter a valid email address
  </div>
</div>
```

### Expandable Section
```jsx
const [expanded, setExpanded] = useState(false);

return (
  <div>
    <button 
      onClick={() => setExpanded(!expanded)}
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
    >
      {expanded ? '▼' : '▶'} Advanced Settings
    </button>
    {expanded && (
      <div style={{ paddingTop: '12px', paddingLeft: '20px' }}>
        {/* Expanded content */}
      </div>
    )}
  </div>
);
```

### Loading Skeleton
```jsx
const SkeletonRow = ({ count = 5 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <tr key={i}>
        <td><div style={{
          height: '16px',
          background: 'linear-gradient(90deg, #1a2035, #1e2640, #1a2035)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite',
          borderRadius: '8px'
        }} /></td>
      </tr>
    ))}
  </>
);
```

---

## 📱 RESPONSIVE BREAKPOINTS

```css
/* Mobile First */
@media (min-width: 640px) {  /* Tablets */
  .grid-2 { grid-template-columns: 1fr 1fr; }
}

@media (min-width: 1024px) { /* Desktop */
  .sidebar { width: 240px; }
  .page-content { margin-left: 240px; }
}

@media (min-width: 1440px) { /* Large Desktop */
  .max-width { max-width: 1400px; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

---

## 🚀 PERFORMANCE GUIDELINES

### CSS-Only Animations
```css
/* Good - Uses transform (GPU accelerated) */
@keyframes slideIn {
  from { transform: translateX(-100px); }
  to { transform: translateX(0); }
}

/* Avoid - Uses left (CPU intensive) */
@keyframes slideInBad {
  from { left: -100px; }
  to { left: 0; }
}

/* Good - Uses opacity (GPU accelerated) */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Image Optimization
```jsx
// Use WebP with fallback
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.png" alt="Description" />
</picture>

// Lazy load images
<img src="..." loading="lazy" />

// Responsive images
<img 
  src="small.jpg" 
  srcSet="medium.jpg 768w, large.jpg 1440w"
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

---

## 📞 SUPPORT & QUESTIONS

- **Design System Docs:** `/docs/GRAPHYFI_UI_UX_OVERHAUL.md`
- **Implementation Guide:** `/docs/DESIGN_SYSTEM_IMPLEMENTATION.md`
- **Storybook Component Library:** (set up in Phase 1)
- **Figma Design File:** (to be created)
- **Team Slack Channel:** #design-system

---

*Last Updated: May 2026*  
*Version: 1.0 - Initial Release*
