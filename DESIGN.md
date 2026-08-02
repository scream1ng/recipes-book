# Recipe Ledger — Design System

iOS-native visual language. Tailwind v4 via `bg-(--color-x)` / `text-(--color-x)`
arbitrary-property syntax — always reference the CSS custom property, never a raw hex.
Source of truth: `src/app/globals.css` and `src/components/ui/*`.

## Color

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#F6EFE9` | Page background |
| `--color-surface` | `#FFFCF9` | Card/list-group/sheet background |
| `--color-surface-alt` | `#E8DED6` | Secondary surface — inactive stepper buttons, inactive segmented-control track, inactive toggle track |
| `--color-ink` | `#2B211E` | Primary text |
| `--color-ink-muted` | `#9A8A85` | Secondary text — captions, meta, muted labels |
| `--color-border` | `rgba(60,40,35,.12)` | Hairlines, dividers, sheet drag handle |
| `--color-accent` | `#C9587A` | Primary action color — buttons, active nav/tab state, links |
| `--color-accent-dark` | `#A8456A` | Errors/warnings (`stale price`, form error text) — not a hover state, a distinct semantic use |
| `--color-accent-soft` | `#F2A9BE` | Action link inside a dark surface (Toast's action button) |
| `--color-good` | `#6F8F73` | Positive/on state — Toggle's checked track |
| `--color-coles` | `#E0402F` | Coles `StoreBadge` |
| `--color-woolies` | `#3E8E4F` | Woolworths `StoreBadge` |

No dark mode. `--color-ink` doubles for text and as a scrim base (`bg-(--color-ink)/95` on Toast).

## Type

| Role | Stack | Notes |
|---|---|---|
| Body / chrome | `var(--font-public-sans)`, `-apple-system, "SF Pro Text", system-ui, sans-serif` | Default `body` font. Screen titles, nav, section headers, all UI chrome. |
| Recipe names | `var(--font-newsreader)`, Georgia, serif | **Only** via the `.recipe-name` class — never a blanket `h1/h2/h3` rule. Applied at recipe list rows and the recipe detail hero title. |
| Numbers | `tabular-nums` (Tailwind utility) | Every money value, count, and stepper digit. |

Scale in use (Tailwind classes, not custom sizes): NavBar title `text-[17px] font-semibold`; SectionHeader `text-xs` (12px) uppercase `tracking-wide`; list row body `text-sm`/default; recipe hero name — check the detail page for the literal size rather than assuming, it's larger than the NavBar title.

## Spacing & radius

| Pattern | Value |
|---|---|
| List row min-height | `48px` (`min-h-[48px]`) |
| List row padding | `px-4 py-2` |
| ListGroup radius | `rounded-xl` (12px) |
| Divider inset | `16px` default, `76px` past a leading avatar (`ListDivider`'s `inset` prop) |
| Section header padding | `pt-6 pb-[7px] pl-4` (24px top, 7px bottom, 16px left) |
| Bottom sheet radius | `rounded-t-3xl` (top corners only) |
| Pill/badge radius | `rounded-full` — every button, tab, badge, stepper control, toggle |
| Tab bar height | `--tabbar-h: 49px` + `env(safe-area-inset-bottom)` (`--tabbar-total`) |
| Nav bar height | `42px` + `env(safe-area-inset-top)` padding |

Every fixed-position UI (StickyActionBar, TabBar, Toast) reads `--tabbar-h`/`--tabbar-total` from `globals.css` rather than hardcoding an offset — extend this pattern for any new fixed element.

## Shadow

Minimal — no shadow scale. `shadow-sm` on the active segment of a segmented control (`ServesStepper`), `shadow-lg` on the Toast, `shadow` on the Toggle's knob. Cards/ListGroups have **no shadow**, only the surface-color change against the page background does the separating.

## Motion

- `motion-safe:` / `motion-reduce:` variants used throughout — never an unconditional transition on a UI element that isn't purely decorative.
- Toast: `@keyframes toast-in` (translateY 8px + fade, 0.2s ease-out), gated `motion-safe:`.
- CostShareBar: fills from 0 via `requestAnimationFrame`, `transition-[width] duration-500 motion-reduce:transition-none`.
- Toggle knob / track color: `transition-colors` / `transition-transform`, both `motion-reduce:transition-none`.

## Components (`src/components/ui/`)

| Component | Shape |
|---|---|
| `NavBar` | Safe-area-padded header, 42px bar, centered title (absolutely positioned so long `left`/`right` content can't push it off-center), `left`/`right` are `ReactNode` slots in accent color — not a fixed icon-button API, so a `<form>` action or a `Link` both work. |
| `TabBar` | Bottom nav, safe-area padded, backdrop-blur, active route = accent color + `usePathname().startsWith()`. Tabs are hardcoded in a `TABS` array — add new tabs there. |
| `ListGroup` / `ListRow` / `ListDivider` | The core list pattern — one rounded surface, borderless rows, hairline dividers between them (add the divider yourself between rows; `ListGroup` doesn't auto-insert them). |
| `SectionHeader` | Uppercase muted caption above a `ListGroup`. |
| `Toast` | Fixed bottom, dark scrim, optional accent-soft action + dismiss ✕. |
| `Stepper` | Circular −/+ buttons around a tabular-nums count, `disabled:opacity-40` at `min`. |
| `Toggle` | `role="switch"`, sage-green on-state, standard iOS knob-slide. |
| `StoreBadge` | Pill: Coles (red), Woolworths (green), fallback "Yours" (muted neutral) for anything else, incl. manual entries. |
| `StickyActionBar` | Fixed bar stacked above the tab bar via `--tabbar-total`, blurred surface, spacer div to prevent content underlap. |
| `Icon` | Single `PATHS` map of raw SVG path data, `currentColor` stroke — add new icons here, don't inline one-off SVGs in pages. |

## Page-level patterns (not shared components — compose per-page)

- **Bottom sheet** (`SwapSheet`): `fixed inset-0` black/40 scrim → `items-end` flex → sheet `rounded-t-3xl` surface, drag-handle bar (`h-1 w-9 bg-(--color-border)`), close ✕ button. Rows inside reuse the `ListRow` min-height/padding convention even though they're plain `<button>`s, not the `ListRow` component itself (they need per-row `onClick`/`disabled`, `ListRow` doesn't expose that — check before assuming `ListRow` fits an interactive-row case).
- **Segmented control** (`ServesStepper`): `rounded-full bg-(--color-surface-alt) p-1` track, active segment gets `bg-(--color-surface) shadow-sm`, inactive segments transparent + muted text.
- **Cost-share bar** (`CostShareBar`): thin (`h-2`) rounded track in `--color-surface-alt`, accent-colored fill, animates in on mount.

## Do / don't

- **Do** reference `--color-*` custom properties via Tailwind's `bg-(--color-x)` syntax. **Don't** write a raw hex in a component — if a new color is needed, add a token to `globals.css` first.
- **Do** keep `.recipe-name` scoped to actual recipe names. **Don't** reintroduce a blanket `h1,h2,h3 { font-family: serif }` rule — that was deliberately removed.
- **Do** route new fixed-position chrome through `--tabbar-h`/`--tabbar-total` and `env(safe-area-inset-*)`. **Don't** hardcode a pixel offset for anything that stacks above the tab bar.
- **Do** give every new interactive element a `motion-reduce:` fallback if it animates. **Don't** ship an unconditional CSS transition on anything non-decorative.
- **Do** use `ListGroup`/`ListRow`/`ListDivider`/`SectionHeader` for any new list-shaped screen. **Don't** hand-roll a bordered-card list — that's the pre-redesign pattern this replaced.
- **Do** use `StoreBadge` for any Coles/Woolworths/manual distinction. **Don't** invent a new store-color scheme per screen.
- **No shadow scale exists.** Don't add `shadow-md`/`shadow-xl` etc. — surfaces separate by color change, not elevation. The three existing shadow usages (`shadow-sm`, `shadow`, `shadow-lg`) are it.
- **No dark mode currently implemented.** If adding one, it needs a full second token pass in `globals.css` — don't half-do it on one component.
