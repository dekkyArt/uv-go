# UV GO — iOS Weather-style redesign

**Status:** awaiting author review
**Date:** 2026-10-28
**Basis:** `docs/superpowers/specs/2026-10-27-uv-go-design.md` (original specification, still applies wherever this document does not change it), screenshots `docs/samples/ios1–5.jpeg`

---

## 1. Goal

Completely redesign the visual language and animations of the UV GO site so that it immediately reads as the iOS Weather app: a full-screen living sky, a large central answer, translucent glass cards, and a floating toolbar with sheets.

**Unchanged:** functionality from `IDEA.md`, domain logic (`src/domain/`), data (`src/data/`), reducer (`src/app/state.ts`), rules in `rules.config.ts`, article and FAQ copy, JSON-LD, and page SEO structure.

**The main motion rule remains:** animation helps people read the answer. The best time is readable ≤ 1.0 s after data arrives; the entire initial choreography takes ≤ 1.8 s.

**Success criteria:**
- the homepage at 390×844 visually matches the structure of `ios1–3.jpeg`, and at 1280×800 the structure of `ios4–5.jpeg`;
- the answer to “when to go outside” is visible above the fold without scrolling or opening sheets;
- axe: 0 serious/critical issues on all pages; AA text contrast verified by a test;
- initial JS on `/` ≤ 130 KB gzip; articles ≤ 2 KB; CLS ≈ 0;
- green CI after every stage (section 11).

## 2. Decisions made during brainstorming

| Question | Decision |
|---|---|
| Scope | Entire site: app, header, footer, How it works, FAQ, articles, 404 |
| Main hero number | Best time (`15:00–16:00`) |
| Themes | Remove light/dark themes and toggle. The sky determines color; text is always white |
| Sky | Procedural WebGL fragment shader without libraries, lazy chunk, CSS backdrop as fallback |
| Settings | Floating bottom toolbar: Plan (sheet), Today/Tomorrow dots, Cities (sheet). On desktop, Plan is a card in the grid |
| Approach | Replace the presentation layer in place (leave domain/data/state untouched) |

## 3. Visual system

### 3.1 Color and text

- Text: primary `#ffffff`; secondary `rgba(255,255,255,0.72)`; tertiary (labels, units) `rgba(255,255,255,0.55)` — only for large or nonessential text.
- Verdict colors (on dark glass, inspired by iOS system colors): green `#4cd964`, yellow `#ffd60a`, red `#ff6961`; night `#8e9cc9`. Never convey the verdict through color alone: always include text alongside it.
- Score scale gradient (bars in “Your free time”): `#4cd964 → #ffd60a → #ff9f0a → #ff6961` from left to right.
- Rain percentage accent: `#64d2ff` (like the blue percentages in iOS).
- Focus: `outline: 2px solid #ffffff; outline-offset: 2px` plus shadow `0 0 0 4px rgba(0,0,0,0.35)` so the ring is visible against any sky.

### 3.2 Glass

One `.glass` utility (in `global.css`):

```css
.glass {
  background: rgb(var(--glass-rgb) / var(--glass-alpha));
  backdrop-filter: blur(24px) saturate(1.5);
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 22px;
}
```

- The sky layer sets `--glass-rgb` and `--glass-alpha` on `<html>` (section 6.6) based on the current phase and weather: blue by day, graphite in rain, dark blue at night. `SkyScript` sets initial values before first paint.
- Dividers inside cards: `1px rgb(255 255 255 / 0.15)`.
- Without `backdrop-filter` (older browsers): increase `--glass-alpha` to the value that meets contrast without blur (same test, section 10).
- Toolbar buttons and switch pills use the same material, radius 999px.

### 3.3 Typography

- Stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Inter Variable', sans-serif`. Inter is already loaded and remains the fallback for non-Apple devices. All numbers use `font-variant-numeric: tabular-nums`.
- Scale:

| Role | Size / weight |
|---|---|
| Best time in hero | `min(16vw, 104px)`, weight 200, line-height 1, letter-spacing −0.02em |
| City | 32px / 400 (mobile), 40px on desktop |
| Verdict line | 20px / 500 |
| Secondary hero lines | 17px / 500 |
| Eyebrow (H1, “➤ MY LOCATION”) | 12px / 600, uppercase, letter-spacing 0.06em |
| Card title | 15px / 600 |
| Card subtitle | 13px / 400, secondary color |
| Card body, rows | 17px / 500 |
| Hourly strip values | 17px / 500; hour label 15px / 600 |

### 3.4 Grid and spacing

- Mobile: side margin 16px, card gap 12px, card padding 16px.
- Desktop (≥ 1024px): container up to 1200px; two columns `minmax(320px, 4fr) | 8fr`, gap 24px.
- Bottom content padding: toolbar height + 24px + `env(safe-area-inset-bottom)`.

## 4. Layout

### 4.1 Homepage, mobile (< 1024px), top to bottom

1. **Top bar** (Astro `Header`): over the sky, no background. “UV GO” on the left, UV Index / Risks / Protection links on the right. Both logo and links sit on small glass pills so their contrast does not depend on the sky (the upper area may contain bright sun, section 6.4). No theme toggle.
2. **Hero** (centered, ~300px tall):
   - eyebrow-H1: “Know the best time to go outside”;
   - “➤ MY LOCATION” (only for a place obtained through geolocation);
   - city;
   - best time `15:00–16:00` (window label from the domain, including `17:00–17:30`);
   - verdict line: verdict-colored dot + text (`Good to go`, `OK with protection`, `Not recommended` — from `rules.verdictLabels`) + “· 1 h”;
   - reason (`evaluation.reason`);
   - “now” line, analogous to H:L: “Now UV 6 · Feels 24°” (for Tomorrow: “Peak UV 7 · Feels 18–24°”).
   - Below the hero, if the automatic switch to tomorrow occurred, a glass pill: “Your free time today has passed — showing tomorrow”.
3. **Hourly card** (section 4.3).
4. **Your free time card** (section 4.4).
5. **What to take** (section 4.5).
6. **How it works** — glass card; rule tables still render from `rules.config.ts`.
7. **FAQ** — glass card, questions as an accordion using `<details>`/`<summary>` (no JS).
8. **Footer** — small secondary text directly over the sky on a glass backdrop; same content (Open-Meteo attribution is mandatory).
9. **Toolbar** — fixed at the bottom, section 4.6.

### 4.2 Homepage, desktop (≥ 1024px)

Like `ios4.jpeg`: hero in the left column, left-aligned, `position: sticky; top: 96px`. Right column: full-width Hourly; below it a two-column grid: Your free time on the left, a stack of What to take and the Plan card on the right (same `PlanControls` as in the sheet). How it works and FAQ sit below the grid, spanning the container width. No Plan button in the toolbar.

### 4.3 Hourly card

- Header: “Hourly” title, subtitle with the current metric (“UV index”, “Chance of rain (%)”, “Feels like (°C)”). On the right, UV / Rain / Feels metric switch: three icons on a glass pill, like cloud/drop/wind in iOS; `role="radiogroup"`, each icon has a text name.
- Body: horizontal strip covering all 24 hours, `overflow-x: auto`, scroll-snap by cell, hidden scrollbar.
- Cell (56px wide): hour label (“Now” for the current hour Today, otherwise `14`), 28px weather icon (section 4.7), metric value, 6px verdict dot beneath it.
- Night hours: moon icon, night-colored dot. Past hours Today: `opacity: 0.45`.
- Sunrise and sunset appear as separate cells between hours at their exact times: “06:42” + icon + “Sunrise” instead of a value (like “Sunset” in `ios2.jpeg`). These are not buttons.
- Free time: lighter backdrop `rgb(255 255 255 / 0.08)` with rounded corners beneath the cells in this range, shared across the range.
- Best window: 1.5px white outline with 14px corner radius around its cells.
- Initial scroll: to “Now” for Today, to the start of free time for Tomorrow.
- Tap (or Enter/Space) on an hour expands a details panel inside the card (existing `HourDetails` content: factor points, reason, values). Another tap or the “Close” button collapses it.

### 4.4 Your free time card

- Header: “Your free time”, subtitle “13:00–19:00 · Active · 1 h”.
- Semantically a `<table>`: one row per free-time hour. Column headers are visually hidden, available to screen readers.
- Columns:
  1. time (`14:00`; best-window rows use weight 600 and a small “Best” label);
  2. weather icon with blue rain percentage beneath it if ≥ 30%;
  3. `UV 5` in the secondary color;
  4. score bar — track `rgb(255 255 255 / 0.12)` spanning the column width, filled from 0 to `min(score, 8) / 8` of its width; the scale gradient is fixed across the full track, so the fill's endpoint color indicates severity. The current-hour row adds a white dot at the fill endpoint, like the current-temperature marker in iOS;
  5. short verdict: `Good` / `OK` / `Avoid` (new short labels in `src/app/ui.ts`; full verdict text in a visually hidden part of the cell).
- Dark hours: moon icon, “Dark” text instead of a bar.
- Past-hour rows (Today): `opacity: 0.45`.

### 4.5 What to take

- Grid of glass tiles, 2 columns on mobile, square (`aspect-ratio: 1`), like “Averages” in `ios4.jpeg`.
- Tile: eyebrow with icon (existing SVGs from `icons/checklist/`, recolored white) and name, large justification line, small explanation line.
- The pure function `tileReason(item, window, activity)` in `src/app/` calculates the justification from the best window's hours:
  - sunscreen — “UV up to 5”;
  - hat-sunglasses — “UV up to 7”;
  - rain-jacket — “Rain up to 60%”;
  - water — “Active plan” for Active, otherwise “Feels up to 27°”;
  - warm-layer — “Feels down to 3°”.
- Empty checklist: one full-width tile, “Nothing extra needed”.

### 4.6 Toolbar, sheets, pager

- **Toolbar:** fixed at bottom center, offset 12px + safe-area. Left: round 48px glass “Plan” button (sliders icon). Center: glass pill with two Today/Tomorrow dots (`role="tablist"`, tabs named “Today” and “Tomorrow”). Right: 48px “Cities” button (list icon). No Plan button on desktop.
- **Plan sheet** (only < 1024px): automatic height. Contains `PlanControls`: Free time (existing `FreeTimePicker`, restyled), Duration and Activity (segmented controls with a sliding pill). Changes apply immediately, visibly updating the hero behind the sheet.
- **Cities sheet:** 92dvh high. Contains a search field (existing `CitySearch` logic, ARIA combobox), “Use my location” button, results list, and current place at the top. Selecting a place closes the sheet.
- **Shared sheet behavior** (`Sheet`): `role="dialog"`, `aria-modal="true"`, heading linked through `aria-labelledby`, rest of page `inert`, focus trapped inside, Esc and backdrop tap close it; closing restores focus to the trigger button. Swipe down on the handle to dismiss (threshold: 30% of height or velocity > 500 px/s). Backdrop dims to `rgb(0 0 0 / 0.35)`.
- **Today/Tomorrow pager:** on `pointer: coarse` devices, hero and card content can be swiped horizontally. Lock direction within the first 10px: if the angle to horizontal is > 30°, pass the gesture to vertical scrolling. Switch at displacement ≥ 25% of width or velocity > 500 px/s; rubber-band resistance at edges (coefficient 0.3). The pager does not intercept gestures starting inside the hourly strip. On desktop, only dots and ←/→ arrows on the `tablist`.

### 4.7 Weather icons

SVG set in `src/app/icons/weather/`, in the colorful iOS style: yellow sun `#ffd60a`, white clouds, blue drops `#64d2ff`, white snowflakes. Variants:
- sun, moon;
- partly-sun, partly-moon;
- cloud, fog;
- drizzle, rain, heavy-rain;
- snow, thunder;
- sunrise, sunset.

The pure function `weatherIcon(code, cloudCover, isDay)` maps WMO weather codes to icons. It uses `skyConfig.weatherGroups` and also distinguishes drizzle from heavy rain by code.

### 4.8 Hero states

| State | City | Large line | Below |
|---|---|---|---|
| No place (first visit) | “Choose a place” | `--:--` | “Use my location” and “Find a city” buttons (opens Cities) |
| Loading | city | `--:--` with pulsing opacity | “Loading forecast…” line (`role="status"`); skeleton cards |
| Error | city | `--:--` | “Couldn't load the forecast” + “Try again” button |
| Empty result (too-short / dark / past) | city | `—` | reason text from the current `EmptyState` + “Show tomorrow” where applicable |
| Result | city | window label | section 4.1 |

Cards in states without a result: Hourly and Your free time show skeletons (loading) or hide (no place, error); What to take is hidden.

### 4.9 Articles and 404

Glass card containing article text over a static CSS sky: device-time phase gradient from `SkyScript` plus a soft CSS sun glow. WebGL does not load on these pages. The UV scale table (`UvScaleTable`) uses rows styled like “Your free time”. CSS scroll reveal (`animation-timeline: view()` inside `@supports`) remains.

## 5. Animations

### 5.1 Tokens (`src/motion/tokens.ts`, replacing current ones)

```ts
export const springs = {
  smooth: { type: 'spring', duration: 0.5, bounce: 0 },    // most transitions
  snappy: { type: 'spring', duration: 0.3, bounce: 0.15 }, // presses, pills
  sheet:  { type: 'spring', duration: 0.45, bounce: 0.08 },// sheets, pager
} as const;
export const durations = { fast: 0.15, base: 0.3, slow: 0.6 } as const;
export const ease = [0.22, 1, 0.36, 1] as const;
```

### 5.2 Initial choreography (data arrives)

Plays once per “place + day” pair (`useFirstResult` logic remains). Constants in `src/motion/choreography.ts`:

| Step | Start, s | Duration | What happens |
|---|---|---|---|
| `heroIn` | 0.05 | 0.30 | Hero time: `blur(8px) → 0`, `y: 12 → 0`, `opacity 0 → 1`; then verdict line (+0.06) |
| `cardsIn` | 0.25 | 0.30, stagger 0.07 | Cards sequentially: `y: 16 → 0`, `opacity 0 → 1` |
| `hourScroll` | 0.45 | ~0.4 | Strip automatically scrolls to “Now” or the start of free time |
| `bestOutline` | 0.45 | 0.35 | Best-window outline draws around its perimeter (`pathLength`) |
| `barsGrow` | 0.60 | 0.40, stagger 0.03 (total stagger ≤ 0.2) | Bars in “Your free time” grow left to right (`scaleX`, origin left) |
| `tilesIn` | 0.70 | 0.30, stagger 0.05 | What to take tiles: `scale 0.94 → 1`, `opacity 0 → 1` |

`labelVisibleAt() = 0.35` (≤ 1.0), `totalDuration() ≈ 1.2` (≤ 1.8). `choreography.test.ts` checks both limits.

Remove the current searching outline and `layoutId` label flight (`best-window-label`).

### 5.3 Hero collapse

- `useHeroCollapse` uses `useScroll` and `useTransform`. Values map directly to scroll, without springs.
- Over 0–140px of scrolling:
  - large time scales down to 0.38 and moves up;
  - reason and “Now…” lines reach `opacity 0` within the first 60px;
  - eyebrow and verdict line disappear by 100px.
- Over 100–140px, a fixed 56px-high `CollapsedBar` fades in: “Lisbon · 15:00–16:00 | Good”. This replaces `MiniResult`. Tapping smoothly scrolls to the page top (pointer/touch only: the bar is `aria-hidden` and not focusable; keyboard users have the skip-link and Home).
- No collapse on desktop: the hero stays sticky in the left column.

### 5.4 Cards tucking under the hero

- Each `GlassCard` header has `position: sticky; top: <collapsed hero height>`.
- Clip the body from the top with `clip-path: inset(<overlap>px 0 0 0 round 22px)`. Calculate `overlap` from scroll in a single rAF handler for all cards (through `useScroll`, no React rerenders — only `MotionValue`).
- Once the card body is fully gone, the header moves away with the card.
- **Fallback:** if device measurements (section 10) show < 50 fps while scrolling, disable clipping with `CARD_TUCK_CLIP = false` in `src/app/ui.ts`. Only header stickiness remains.

### 5.5 Rolling digits (`NumericRoll`)

- Split the string into characters. Animate changed digits: the old one moves up by 0.6em with `blur(4px)` and `opacity 0`, the new one enters from below. Unchanged characters stay still.
- `smooth` spring over 0.35 s, stagger 0.03 s between neighboring changed characters. Direction: up if the new value is larger, otherwise down.
- Applies to:
  - best time in the hero;
  - values in the strip when changing metrics;
  - the “Now UV…” line.
- For screen readers, `NumericRoll` exposes plain text (`aria-label` with final value, animated characters `aria-hidden`).

### 5.6 Other interactions

- Day change: content follows the finger or moves with the `sheet` spring; sky blends by progress (section 6.5); active toolbar dot expands into a 16×6px pill through `layoutId`.
- Sheets: enter with the `sheet` spring. Main page beneath the sheet: `scale 0.94`, `border-radius 16px`, dimming.
- Metric switch and segmented controls: pill through `layoutId` (current `SegmentedControl` mechanism), `snappy` spring.
- Hour details: expansion through `layout` on the card, `smooth` spring.
- Press (button card, tile, toolbar buttons, hour cells): `whileTap={{ scale: 0.97 }}`, `snappy` spring.

### 5.7 Reduced motion

`MotionConfig reducedMotion="user"` + `useReducedMotion` in custom logic.

- Rolling digits, lifts, pop, bar growth, outline drawing → crossfade ≤ 150 ms; values immediately final.
- Sheets and day changes → fade ≤ 150 ms without displacement; pager swipe disabled, dots work.
- Background scaling beneath sheets disabled.
- Scroll-driven hero collapse remains (scroll controls it; it is functionality), but without blur; card clipping remains.
- Sky: one static frame (section 6.7).

## 6. WebGL sky

### 6.1 Modules

| File | Responsibility |
|---|---|
| `src/domain/skyUniforms.ts` | Pure function `skyUniforms(state: SkyState): SkyUniforms` and `glassTint(u: SkyUniforms)` |
| `src/domain/skyUniforms.config.ts` | Phase palettes, weather table, luminance limits, glass parameters |
| `src/app/sky/shader.ts` | Vertex and fragment shader source (strings) |
| `src/app/sky/renderer.ts` | Context creation, compilation, rAF loop, uniform smoothing, adaptive quality, pausing, context-loss handling. No React |
| `src/app/sky/SkyCanvas.tsx` | React wrapper: mounts canvas, supplies target uniforms, sets `--glass-rgb` / `--glass-alpha` on `<html>`, removes `data-sky-live` on fallback |

`SkyCanvas` loads via `React.lazy`, like the current `SkyLayer`. `useSky` (`useSkyRef.ts`) remains the source of `SkyState`.

### 6.2 Uniforms

`uTime`, `uResolution`; `uSkyTop`, `uSkyBottom` (vec3, phase gradient); `uSunPos` (vec2, screen fractions), `uSunIntensity` (0–1, from `uvGlow`); `uMoon` (0–1); `uStars` (0–1); `uCloudCover` (0–1), `uCloudDark` (0–1), `uCloudSpeed`; `uFog` (0–1); `uRain` (0–1), `uSnow` (0–1); `uGlassDrops` (0–1); `uFlash` (0–1, lightning flash); `uHeat` (0–1); `uMaxLuma` (luminance limit outside the sun zone); `uSunZone` (lower edge of the sun zone, fraction of height).

### 6.3 Weather table (initial values, in config)

| Weather | cloudCover | cloudDark | fog | rain | snow | glassDrops |
|---|---|---|---|---|---|---|
| clear | 0.08 | 0 | 0 | 0 | 0 | 0 |
| partly | 0.45 | 0.05 | 0 | 0 | 0 | 0 |
| overcast | 0.85 | 0.35 | 0.1 | 0 | 0 | 0 |
| fog | 0.6 | 0.2 | 0.8 | 0 | 0 | 0 |
| rain | 0.95 | 0.55 | 0.15 | 0.7 | 0 | 0.6 |
| snow | 0.8 | 0.25 | 0.1 | 0 | 0.7 | 0 |
| thunder | 1.0 | 0.75 | 0.1 | 1.0 | 0 | 0.8 |

`wind` from `SkyState` doubles `uCloudSpeed` and rain slant; `heat` gives `uHeat = 1`; night (`phase === 'night'`) gives `uStars = 1 − cloudCover`, `uMoon = 1`, `uSunIntensity = 0`.

### 6.4 Shader layers (in order)

1. Vertical gradient `uSkyTop → uSkyBottom`.
2. Stars: grid hash noise, twinkling with `uTime`, `uStars` mask.
3. Sun: disk, broad glow, ~22° halo ring (thin low-intensity rainbow rim), like `ios1/ios3`. Moon: soft glowing disk.
4. Clouds: fbm (4 octaves, 2 at low quality) with domain warping, drift by `uTime * uCloudSpeed`. Lighting from `uSunPos`, darkening by `uCloudDark`.
5. Fog: uniform veil, denser toward the bottom.
6. Rain: slanted strokes in screen coordinates, 3 depth layers at different speeds. Snow: 3 layers of swaying flakes.
7. Glass drops: cell grid with sparse blurred lenses (background displacement and highlights), some slowly sliding down.
8. Flash: `uFlash` brightens clouds; JS triggers it randomly every 6–14 s during thunderstorms.
9. Heat haze: slight sinusoidal coordinate distortion in the bottom 25% with `uHeat`.
10. **Luminance limit:** outside the sun zone (`y > uSunZone`), scale the final color so relative luminance ≤ `uMaxLuma`. Sun position `uSunPos.y` always lies in the upper zone (`uSunZone`, default top 18% of the screen), where the only text is header links on their own glass backdrop.

### 6.5 Transitions

- `renderer.ts` stores current and target uniforms. Each frame, move current values toward targets: `cur += (target − cur) * (1 − exp(−dt / 0.4))`, i.e. ~1.2 s until nearly matched. No Motion.
- During pager swipe, `SkyCanvas` receives two sets (Today, Tomorrow) and progress 0–1. Targets are a linear blend, so the sky follows the finger.

### 6.6 Glass derived from the sky

- `glassTint(u)` takes the average sky color (blend of `uSkyTop`/`uSkyBottom` adjusted for cloud cover and darkening), dims it toward dark (luminance ×0.35), and returns `{ rgb, alpha }`.
- `alpha` is the maximum of baseline `0.38` and the minimum value at which white text on this glass over a background of luminance `uMaxLuma` achieves ≥ 4.5:1.
- `SkyCanvas` writes the result to `--glass-rgb` / `--glass-alpha` when targets change (not every frame). 600 ms CSS transition on `.glass` `background-color`.
- `SkyScript` (inline, before paint) writes initial glass for the device-time phase. The same module generates the `phase → glass` table at build time (like current `skyRanges.ts`).

### 6.7 Performance and fallback

- Canvas renders at `0.5 × CSS px` resolution (not `devicePixelRatio`) and is stretched with CSS.
- Adaptive quality: rolling average frame time over 60 frames. If > 20 ms, resolution drops to 0.35. If still > 20 ms, clouds drop to 2 octaves and the loop to 30 fps. Quality does not rise again until reload.
- Pause on `visibilitychange: hidden`. Start the loop via `requestIdleCallback` (fallback `setTimeout(…, 200)`) after hydration to avoid affecting LCP and TBT.
- Reduced motion: one frame per target change (with transitions completed), no running loop. Particles (rain, snow, drops, flash, heat haze) are not drawn in the static frame.
- No WebGL, compile/link failure, or `webglcontextlost`: remove canvas, retain the `SkyScript` CSS backdrop; glass retains phase-based values. No console errors apart from one `console.warn`.
- Entrance: canvas fades in over the backdrop for 400 ms after its first rendered frame.
- Expected chunk size: 5–7 KB gzip. It is lazy and excluded from the initial JS budget, but listed in README beside other lazy chunks.

### 6.8 CSS backdrop

Recolor the six phase gradients (`--sky-*` in `global.css`) to the iOS palette: saturated blue day (`#2f6fd0 → #6aa6e8`), dark blue night (`#0b1530 → #1d2c55`), warm dawn and dusk; graphite overcast variants are unnecessary (the backdrop has no weather). Every gradient must stay within `uMaxLuma` (verified by test). Shader and backdrop phase palettes come from one config.

## 7. Code structure

### 7.1 Retained

`src/domain/**`, `src/data/**`, `src/app/state.ts`, hooks `useForecastLoader`, `useNow`, `useCitySearch`, `useFirstResult`, `useSkyRef`, `src/motion/MotionProvider.tsx`, `src/motion/features.ts`, `src/seo/**`, content (`src/content/**`), pages (`src/pages/**`) with markup changes. Reuse `LocationPicker`, `CitySearch`, `FreeTimePicker`, `SegmentedControl`, `HourDetails` logic with new styling.

### 7.2 New

```
src/app/
  hero/Hero.tsx, hero/useHeroCollapse.ts, hero/CollapsedBar.tsx
  cards/GlassCard.tsx, cards/useCardTuck.ts
  cards/HourlyCard.tsx, cards/MetricSwitch.tsx, cards/HourCell.tsx
  cards/FreeTimeCard.tsx, cards/ScoreBar.tsx
  cards/TakeTiles.tsx, cards/tileReason.ts
  cards/PlanControls.tsx
  toolbar/Toolbar.tsx, toolbar/DayDots.tsx
  sheet/Sheet.tsx, sheet/PlanSheet.tsx, sheet/CitiesSheet.tsx
  pager/DayPager.tsx
  components/NumericRoll.tsx
  icons/weather/*.tsx, icons/weather/weatherIcon.ts
  sky/SkyCanvas.tsx, sky/renderer.ts, sky/shader.ts
src/domain/skyUniforms.ts, src/domain/skyUniforms.config.ts
```

### 7.3 Removed

`ResultCard`, `MiniResult`, `DayArcTimeline`, `HourStrip`, `LoadingSun`, `TimelineSkeleton`, `EmptyState` and `ErrorState` (their text moves to `Hero`), `SkyLayer`, `VerdictIcon`, hooks `useCardOffscreen` and `useCountUp`, `src/app/theme.ts`, `src/components/ThemeToggle.astro`, `src/components/ThemeScript.astro`, `src/components/Hero.astro`, light and dark palettes and `@custom-variant dark` in `global.css`, sky particle and veil CSS. Their tests (`theme.test.ts`, `timeline.test.tsx`, etc.) are also removed, with coverage transferred to tests for new components.

### 7.4 UI state

Sheet openness, selected strip metric, and swipe progress are local component state (`useState`/`MotionValue`), not added to the reducer. `selectedHour` and `day` remain in the reducer.

## 8. Accessibility

- **Hourly strip:** `role="group"` container with `aria-label="Hourly forecast"`. Hour cells are `<button>` elements named like “14:00, UV 5, rain 30%, OK with protection” and `aria-pressed` for the selected one. Roving tabindex navigation: ←/→ through hours, Home/End.
- **Metric switch** is a `radiogroup`. Segmented controls remain `radiogroup` (as now; e2e relies on `role="radio"`).
- **“Your free time”** is a `<table>` with `<caption>` and `<th scope="col">`.
- **Day dots** are a `tablist`, “Today”/“Tomorrow” tabs, content panel is `tabpanel`.
- **Sheets** — section 4.6.
- **Announcements:** retain `aria-live="polite"` with result text. Collapsed hero line is `aria-hidden` (duplicates hero).
- **Other:**
  - touch targets ≥ 44×44px;
  - verdict always includes text;
  - decorative sky and weather icons are `aria-hidden` (meaning conveyed by cell names);
  - skip-link remains;
  - everything keyboard-accessible, visible focus against any sky (3.1).

## 9. SEO and layout stability

- H1 “Know the best time to go outside” is the hero eyebrow. Rendered identically in server `Placeholder` and app, so remains a text LCP element without JS.
- Title, description, JSON-LD (WebApplication, FAQPage), sitemap, robots, OG — unchanged. Regenerate OG images in the new style (`scripts/make-og.mjs`) as a separate task in stage 7.
- **`Placeholder`** reserves:
  - hero height (fixed, 300px mobile);
  - Hourly height (fixed);
  - “Your free time” height = `(end − start) × 44px + header`.
- **Inline script** (extension of `reservePlaceLayout`) reads saved place and inputs from localStorage before first paint and sets `data-has-place` and CSS variable `--free-rows`. On read failure, use defaults.
- How it works and FAQ render on the server, as now.

## 10. Testing

**Unchanged:** domain tests `src/domain/__tests__/**`, data tests, `state.test.ts`, SEO tests.

**New and rewritten unit and component tests (Vitest + RTL):**
- `skyUniforms`: each weather and phase yields table values; night extinguishes the sun; `wind` and `heat` apply.
- Contrast (successor to `skyContrast.test.ts`): for each “phase × weather” combination, white `#fff` and secondary text on `glassTint(...)` glass over a background of luminance `uMaxLuma` ≥ 4.5:1; large hero text over the hero scrim ≥ 3:1, small hero lines ≥ 4.5:1; each CSS backdrop gradient ≤ `uMaxLuma`; glass without `backdrop-filter` also passes.
- `choreography.test.ts`: `labelVisibleAt() ≤ 1.0`, `totalDuration() ≤ 1.8`.
- `NumericRoll`: character splitting, unchanged characters do not animate, accessible name = final text.
- `weatherIcon`: coverage of all WMO code groups, day and night.
- `tileReason`: every checklist item and empty list.
- `HourlyCard`: cell names, keyboard (←/→/Home/End), selecting an hour opens details, changing metrics changes values, sunrise and sunset cells.
- `FreeTimeCard`: row count = free-time length, “Best” label, “Dark” for night hours.
- `Sheet`: focus trapped, Esc closes, focus restored, background `inert`.
- `DayDots`/`DayPager`: keyboard on `tablist`, changing day dispatches `setDay`.
- `Hero`: all states from 4.8.
- `UvGoApp.test.tsx`: integration using new roles.
- `SkyCanvas` in jsdom (no WebGL): backdrop fallback, glass set by phase, no exceptions.
- Reduced motion: final values immediately, no pager swipe.

**e2e (Playwright, mocked APIs, 390×844 and 1280×800):**
- happy path: city search in Cities sheet → hero result → open Plan → “3 h” → window label changes and window length = 3 h;
- geolocation denied: “Use my location” button in hero → fallback message;
- Esc closes sheet, focus on toolbar button;
- swiping content on a touch viewport switches to Tomorrow;
- 1280×800: Plan card visible without a sheet;
- `a11y.spec.ts`: axe on all pages (one theme).

**CI unchanged:** lint, `astro check`, unit, e2e, build, bundle budget, Lighthouse CI.

**Author's manual checks (do not block CI, recorded in README):** scroll and sky FPS in Chrome DevTools with CPU ×4 and on a real midrange Android device; decision on `CARD_TUCK_CLIP` flag (5.4).

## 11. Stages

Every stage ends with green CI and a separate commit (or series).

1. **Foundation:**
   - remove themes (`ThemeToggle`, `ThemeScript`, `theme.ts`, palettes);
   - new tokens, `.glass`, typography;
   - recolor CSS backdrop;
   - header and footer in the new style.
2. **Static app layout:** `Hero` with all states, `GlassCard`, `HourlyCard`, `FreeTimeCard`, `TakeTiles`, weather icons, desktop grid with Plan card. Remove old components. How it works and FAQ in glass.
3. **Navigation:** `Toolbar`, `Sheet`, `PlanSheet`, `CitiesSheet`, `DayDots`, `DayPager`. Update e2e.
4. **Animations:** tokens, choreography, `NumericRoll`, hero collapse, card tucking, sheets, pager, microinteractions, reduced motion.
5. **WebGL sky:** `skyUniforms`, shader, renderer, `SkyCanvas`, sky-derived glass, contrast test.
6. **Articles and 404** in the new style.
7. **Documentation:** README (Stack, Motion decisions, Performance, Lottie — substantively unchanged), regenerate OG images.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Card clipping during scroll slows down low-end Android devices | `CARD_TUCK_CLIP` flag, on-device measurement (5.4) |
| Shader too heavy for low-end GPUs | Lower resolution, adaptive quality, 30 fps, pause outside the tab (6.7) |
| AA contrast of white text against bright sky | `uMaxLuma` limit, sun in upper zone, glass opacity determined by test (6.4, 6.6). Sky will be slightly deeper than iOS: iOS itself does not meet AA; we do |
| `backdrop-filter` costly with many cards | No more than ~6 glass surfaces above the fold; do not keep `will-change` permanently |
| Pager swipe conflicts with vertical scroll and horizontal hourly strip | Direction lock within first 10px; pager does not intercept gestures inside hourly strip |
| CLS from “Your free time” rows | Reserve height from saved data before paint (section 9) |
