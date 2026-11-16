# O.E — Redesign: Audit + Design System (proposal, awaiting approval)

Status: **concept only**. No site file (index.html, style.css, app.js, admin.*, builder.js) was changed.
Preview: `design/concept.html` (open locally; uses ../assets/logo.svg and banner.png untouched).

## 1. Audit (current state)
- Stack: static HTML/CSS/vanilla JS (hash router), supabase-js via CDN. No React/Tailwind → tokens as CSS variables, components as plain CSS classes. Fonts: Outfit + Cairo (kept).
- Logo colors (extracted from assets/logo.svg): orange `#F79321`, blue `#0F72BA`.
  The site currently uses `#ff8a00` / `#1e8fff` — close but not the logo's values (blue is noticeably brighter than the logo's).
- Weaknesses found:
  1. Home shows the full banner (which already contains the name) and then repeats the name in an H1 → duplicated hierarchy.
  2. Everything is a pill (999px radius) + cards with 18px radius + lift/blue-shadow hover → generic "template" feel.
  3. Mobile nav is a clipped horizontal scroller (item text cut off).
  4. Orange→blue gradient on progress bars; blue glow shadows on buttons.
  5. Flat uniform grids; no editorial hierarchy; labels/captions have no typographic system.
  6. Empty/error/loading states are a single dashed box with no iconography or action.

## 2. Proposed system
- Colors: logo orange = primary/CTA, logo blue = secondary/focus; `#4BA3E3` is a lighter tint of the same blue used only for small text on dark (logo blue gives 3.9:1 on the background, tint ≈ 7:1). Neutrals unchanged in character (ink `#0B0B0F`, surfaces `#101016/#16161E`, hairline `#232330`).
- Type: Outfit/Cairo. Swiss-style: huge tight display name, small uppercase tracked labels, numbered sections (01–05).
- Shape: radius 6/10/16 (no full pills except status dots), 1px hairlines, no glow, no glass, no gradients (single scrim only on the portrait caption).
- Motion: 200–250ms ease-out; arrow nudge on buttons, image scale 1.03 on cards, orange underline on active nav; respects prefers-reduced-motion.
- Icons: Lucide (inline SVG symbols, stroke 1.75) — copied as plain paths, no library dependency.
- Layout: 12-col asymmetric grids (hero 7/5, work 7/5 + 4/4/4), collapsing to one column on mobile; mobile nav → burger menu.
- Home: portrait is a non-destructive CSS crop of the existing banner.png (file untouched).

## 3. Rollout plan after approval (separate commits, portfolio-setup only)
1. tokens + base (style.css) 2. nav/footer/home 3. work + project details 4. brief/contact 5. auth modals + client account 6. admin + builder 7. states (loading/empty/error) 8. Desktop/Mobile test pass.
No DB / RLS / Auth / content changes.
