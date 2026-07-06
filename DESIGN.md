# Design Brief: Cryptocurrency Portfolio Manager

## Tone & Purpose
Premium financial tech tool for professional traders. Editorial layout, high contrast, minimalist interaction patterns, anti-generic aesthetic. Bilingual (Polish/English).

## Color Palette (OKLCH)
| Role | Light | Dark |
|------|-------|------|
| Background | 0.98 0 0 | 0.12 0 0 |
| Card | 1 0 0 | 0.16 0 0 |
| Primary (Purple) | 0.55 0.22 264 | 0.65 0.24 264 |
| Destructive (Red) | 0.577 0.245 27.325 | 0.704 0.191 22.216 |
| Success | Chart-4: 0.828 0.189 84 | Chart-4: 0.627 0.265 303.9 |
| Border | 0.92 0 0 | 0.28 0 0 |

## Schemes (Global)
**Default:** Purple accent (264°). **Gray:** Desaturated neutrals throughout. **Navy:** Deep blue tones.

## Typography
Display: Space Grotesk. Body: Inter (system). Mono: Geist Mono. Hierarchy: 18/16/14px base, weights 500–700.

## Structural Zones
| Zone | Treatment |
|------|----------|
| Header | bg-card, border-b, elevated |
| Content | bg-background, grid layout, card tiles |
| Modals | modal-overlay, modal-content, card elevation, centered |
| Charts | bg-card, clear grid lines, high contrast |
| Footer | bg-muted/40, border-t, subtle |

## Export/Import Modal Components
**Header:** Title + close button. **Body:** Checkbox groups (portfolio/assets/history). **Footer:** Action buttons. **States:** Normal, hover, checked, disabled. **Checkboxes:** accent-primary when checked, accent/10 hover background.

## Confirmation Dialogs
Centered overlay, max-width-sm, bold title, message text, button row (primary + destructive). Backdrop blur on overlay. High z-index (z-50).

## Spacing & Rhythm
Base 4px grid. Padding: 4px (xs), 8px (sm), 12px (md), 16px (lg), 24px (xl). Gaps: 12px (gap-3). Modals: max-width 28rem. Borders: 1px solid. Shadows: shadow-lg on modals.

## Patterns
- **Buttons:** Semantic classes (btn-primary, btn-secondary, btn-destructive, btn-success). Hover opacity-90. No gradients.
- **Checkboxes:** 20px × 20px, border-2, checked:primary. Hover: cursor-pointer + accent/10 background.
- **Forms:** space-y-3 between items. Labels clickable. No floating labels.
- **Modals:** Fixed overlay, backdrop-blur, centered, scrollable body, sticky footer.

## Motion
Transitions: 200–300ms ease-out. Opacity changes for interactive elements. No scale/rotate. Backdrop blur immediate.

## Responsive
Mobile-first. Modals: max-h-[90vh], w-full, mx-4. Checkboxes single column. Buttons full-width on sm. Bilingual text wraps naturally.

## Constraints
- No raw colors; use semantic tokens exclusively (oklch var() only).
- No gradients; use elevation via borders/shadows/background changes.
- Chart colors: chart-1 through chart-5 for visual consistency.
- Modal overlay: always backdrop-blur; never plain overlay.
- Checkboxes: browser native with accent-primary, no custom SVG.
- Light/dark modes: preserve hierarchy (never invert all values).
- No decorative elements; focus on clarity and spacing.

## Signature Detail
Checkbox hover states use subtle accent/10 background for affordance without motion. Modal footer uses muted/20 background for separation. Confirmation dialogs center-aligned for editorial balance.

## Legend: All 3 Schemes Apply Globally
Each scheme (default/purple, gray, navy) defines full color palette. CSS variables switch all colors on theme change. No component-specific overrides. Modal and checkbox styles inherit all scheme colors automatically.
