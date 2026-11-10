# iOS Weather Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the visual language and animations across UV GO to match the iOS Weather app: a live WebGL sky, a central hero showing the best time, glass cards, and a toolbar with sheets.

**Architecture:** Replace the presentation layer in place. `src/domain/`, `src/data/`, `src/app/state.ts`, and loading hooks remain unchanged; new components live in `src/app/{hero,cards,sheet,toolbar,pager,sky}`. Colors no longer depend on a theme: everything is white on glass, with the sky determining the glass tint (CSS variables `--glass-rgb`/`--glass-alpha`, initially based on the phase in CSS, later from the WebGL layer).

**Tech Stack:** Astro 7 (static), React 19 island, Motion (`motion/react`, `LazyMotion` + `m`, `domMax`), Tailwind CSS v4, raw WebGL 1, Vitest + RTL, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-28-ios-weather-redesign-design.md` (hereafter the “spec,” with references such as §4.3). Original requirements: `docs/superpowers/specs/2026-10-27-uv-go-design.md`.

## Global Constraints

- Do not change `src/domain/**` (except new files `skyPalette.ts`, `contrast.ts`, `glass.ts`, `skyUniforms.ts`, `skyUniforms.config.ts`), `src/data/**`, `src/app/state.ts`, article and FAQ text, or JSON-LD.
- Animate only through `m.*` from `motion/react` (`LazyMotion strict` throws on `motion.*`); animate only `transform`, `opacity`, `filter`, and `clip-path`.
- The best time must be readable within ≤ 1.0 s after data arrives; the entire initial choreography must take ≤ 1.8 s.
- Initial-load JS on `/` ≤ 130 000 B gzip; on other pages ≤ 2 000 B (`npm run check:bundle` after `npm run build`).
- axe: 0 serious/critical issues on `/`, `/uv-index`, `/uv-risks`, `/sun-protection`, `/404`.
- Contrast: white and secondary (`rgb(255 255 255 / 0.72)`) text ≥ 4.5:1 on glass; large text ≥ 3:1; graphics ≥ 3:1.
- Tap targets ≥ 44×44px; always label the verdict with text.
- Reduced motion: everything except scroll-linked hero collapse becomes a crossfade ≤ 150 ms (§5.7).
- Desktop breakpoint: `(min-width: 1024px)`.
- Verdict colors: green `#4cd964`, yellow `#ffd60a`, red `#ff6961`, night `#8e9cc9`; rain `#64d2ff`; scale gradient `#4cd964 → #ffd60a → #ff9f0a → #ff6961`.
- Each task ends with passing `npm run lint`, `npm run check`, and `npm test`; tasks changing page markup also require `npm run test:e2e`.
- Use Conventional Commits (`feat:`, `refactor:`, `test:`, `docs:`, `chore:`), as in the repository history. Work takes place on branch `redesign/ios-weather`.

## Review Focus

1. **Polar day/night or invalid `sunrise`/`sunset`** — the hourly strip must not show sunrise/sunset cells and must not crash (test in Task 5, `stripItems`).
2. **`null` in hourly data (UV, rain, feels-like)** — show `–` in the strip, table, and “Now” line, never `null`/`NaN` (tests in Task 4, Task 5, Task 6).
3. **Crossing 1024px with the Plan sheet open** (tablet rotation, window resize) — close the sheet, remove `inert`, and show the Plan card (test in Task 12).
4. **Long city name at 320px width** — no horizontal page scrolling; wrap/truncate the city; the `15:00–16:00` label fits (e2e in Task 12).
5. **WebGL context loss during a session** — remove the canvas, keep the CSS background, revert glass to phase-based values, and throw no exceptions (test in Task 21).

---

## Phase 1. Foundation

### Task 1: One sky-driven token system, removing themes

**Files:**
- Create: `src/domain/skyPalette.ts`, `src/domain/contrast.ts`, `src/domain/glass.ts`
- Create: `src/domain/__tests__/glass.test.ts`, `src/test/skyCss.test.ts`
- Modify: `src/styles/global.css` (tokens, `.glass`, phase gradients and glass, typography; remove both theme palettes, `@custom-variant dark`, and theme view-transition rules)
- Modify: `src/components/BaseLayout.astro` (remove `ThemeScript`)
- Modify: `src/components/Header.astro` (remove `ThemeToggle`)
- Delete: `src/components/ThemeScript.astro`, `src/components/ThemeToggle.astro`, `src/app/theme.ts`, `src/app/__tests__/theme.test.ts`, `src/app/__tests__/skyContrast.test.ts`
- Modify: `e2e/a11y.spec.ts` (remove the theme loop and “theme persists after reload” test), `e2e/app.spec.ts` (remove theme tests, if any)

**Interfaces:**
- Produces:
  - `type Rgb = [number, number, number]` (in `contrast.ts`)
  - `hexToRgb(hex: string): Rgb`, `luminance(c: Rgb): number`, `contrastRatio(a: Rgb, b: Rgb): number`, `over(top: Rgb, alpha: number, bottom: Rgb): Rgb` — move formulas from the deleted `skyContrast.test.ts`
  - `SKY_PALETTE: Record<SkyPhase, { top: string; bottom: string }>` (hex), `MAX_SKY_LUMA = 0.3`, `TEXT_SECONDARY_ALPHA = 0.72`, `GLASS = { baseAlpha: 0.38, darken: 0.35 }` (in `skyPalette.ts`)
  - `interface Glass { rgb: Rgb; alpha: number }`; `glassFor(base: Rgb): Glass` (in `glass.ts`)

- [ ] **Step 1: Test `src/domain/__tests__/glass.test.ts`**

```ts
const WHITE: Rgb = [255, 255, 255];
const worstBehind = grayWithLuminance(MAX_SKY_LUMA); // test helper: binary search over gray levels
it.each(PHASES)('glass for %s keeps white and secondary text AA over the brightest allowed sky', (phase) => {
  const { top, bottom } = SKY_PALETTE[phase];
  const base = over(hexToRgb(top), 0.5, hexToRgb(bottom));
  const g = glassFor(base);
  const surface = over(g.rgb, g.alpha, worstBehind);
  expect(contrastRatio(WHITE, surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(over(WHITE, TEXT_SECONDARY_ALPHA, surface), surface)).toBeGreaterThanOrEqual(4.5);
  expect(g.alpha).toBeGreaterThanOrEqual(GLASS.baseAlpha);
  expect(g.alpha).toBeLessThanOrEqual(0.8);
});
it('every palette stop stays within MAX_SKY_LUMA', () => { /* luminance(hexToRgb(stop)) <= MAX_SKY_LUMA for top and bottom of each phase */ });
```

- [ ] **Step 2: Run — FAIL** (`npx vitest run src/domain/__tests__/glass.test.ts`: modules not found)

- [ ] **Step 3: Implement `contrast.ts`, `skyPalette.ts`, `glass.ts`**

`glassFor`: `rgb = base × GLASS.darken` per channel (round); `alpha` is the smallest value in 0.01 increments starting at `GLASS.baseAlpha` for which both test conditions hold over a gray background with luminance `MAX_SKY_LUMA`. Use the iOS palette tones from §6.8 (day `#2f6fd0 → #5b97dc`, night `#0b1530 → #1d2c55`, dawn/morning/golden hour/dusk are warm, but every stop ≤ `MAX_SKY_LUMA`).

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Test `src/test/skyCss.test.ts`** — reads `global.css` (like the former `skyContrast.test.ts`):
  - for each phase, `--sky-<phase>` is `linear-gradient(180deg, <top> 0%, <bottom> 100%)` with colors exactly matching `SKY_PALETTE`;
  - the `html[data-sky-phase='<phase>']` rule sets `--glass-rgb: r g b` and `--glass-alpha: a` equal to `glassFor(...)` for that phase (alpha to 2 decimal places);
  - CSS contains no `data-theme` or `@custom-variant dark`.

- [ ] **Step 6: Run — FAIL**

- [ ] **Step 7: Rewrite tokens in `global.css`**
  - One set on `:root`:
    - `--uv-text: #ffffff`;
    - `--uv-text-muted: rgb(255 255 255 / 0.72)`;
    - `--uv-surface: rgb(var(--glass-rgb) / var(--glass-alpha))`;
    - `--uv-surface-strong: rgb(255 255 255 / 0.12)`;
    - `--uv-border: rgb(255 255 255 / 0.14)`;
    - `--uv-focus: #ffffff`;
    - verdict fill and verdict text use the colors from Global Constraints;
    - `--uv-night: #8e9cc9`;
    - `--uv-bg` = the top of the night palette.
  - Default glass uses day-phase values.
  - `.glass` follows §3.2. `.sky-panel` becomes an alias for `.glass`: existing markup immediately gets the new look.
  - No separate fallback without `backdrop-filter` (§3.2) is needed: `glassFor` calculates `alpha` without accounting for blur, against the worst permitted background.
  - Phase-based glass is set by `html[data-sky-phase=…]` rules triggered by the existing `SkyScript`. This replaces the script-based glass update from §6.6 with the same result.
  - Focus follows §3.1.
  - `--font-sans` uses the stack from §3.3.
  - Add `.tabular { font-variant-numeric: tabular-nums }`.
  - Keep the `html::before` rule below `@layer base`, with gradients based on `data-sky-phase`.
  - Remove dark values for `--sky-glow-*` / `--sky-veil-*`, etc. Keep the light values as a single set: `SkyLayer` remains until Task 21.

- [ ] **Step 8: Remove the theme**: files listed under Delete, the `ThemeScript` import in `BaseLayout.astro`, `ThemeToggle` in `Header.astro`, and theme e2e checks. `grep -rn "data-theme\|uvgo:theme\|ThemeToggle" src e2e` returns nothing.

- [ ] **Step 9: Verify** — `npm test && npm run lint && npm run check && npm run test:e2e` — PASS.

- [ ] **Step 10: Commit** — `git commit -m "refactor: replace light/dark themes with one sky-driven glass token set"`

---

## Phase 2. Building blocks and static layout

### Task 2: Weather icons

**Files:**
- Create: `src/app/icons/weather/weatherIcon.ts`, `src/app/icons/weather/WeatherIcon.tsx`, `src/app/icons/weather/glyphs.tsx`
- Test: `src/app/__tests__/weatherIcon.test.tsx`

**Interfaces:**
- Consumes: `weatherGroup(code, cloudCover)` from `src/domain/sky.ts`
- Produces:
  - `type WeatherIconName = 'sun' | 'moon' | 'partly-sun' | 'partly-moon' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'heavy-rain' | 'snow' | 'thunder' | 'sunrise' | 'sunset'`
  - `weatherIcon(code: number | null, cloudCover: number | null, isDay: boolean): WeatherIconName`
  - `WeatherIcon({ name, className }: { name: WeatherIconName; className?: string })` — inline SVG, `aria-hidden="true"`, `data-icon={name}`, default `size-7`

- [ ] **Step 1: Test** — table:

| code | cloudCover | isDay | expected icon |
|---|---|---|---|
| 0 | — | true | `sun` |
| 0 | — | false | `moon` |
| 2 | — | true | `partly-sun` |
| 2 | — | false | `partly-moon` |
| 3 | — | — | `cloud` |
| 45 | — | — | `fog` |
| 51, 53, 55, 56, 57 | — | — | `drizzle` |
| 61, 63, 80, 81 | — | — | `rain` |
| 65, 67, 82 | — | — | `heavy-rain` |
| 71, 85 | — | — | `snow` |
| 95 | — | — | `thunder` |
| `null` | 10 | — | `sun` |
| `null` | 90 | — | `cloud` |

  Also test rendering: each of the 13 icons has `svg[data-icon]` with `aria-hidden`.
- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement.** Glyphs use the colorful iOS style (§4.7): sun `#ffd60a`, clouds `#ffffff`, drops `#64d2ff`, snowflakes `#ffffff`, viewBox `0 0 28 28`.
- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit** — `feat: add iOS-style weather icons`

### Task 3: `GlassCard`

**Files:**
- Create: `src/app/cards/GlassCard.tsx`
- Test: `src/app/__tests__/glassCard.test.tsx`

**Interfaces:**
- Produces: `GlassCard({ title, subtitle, action, children, className, cardRef }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string; cardRef?: Ref<HTMLElement> })` — `<section class="glass" aria-labelledby>`; header `<header data-card-header>` with `h2` (15px/600), subtitle (13px, secondary), and `action` on the right; body `<div data-card-body>`. Header: `position: sticky; top: var(--hero-collapsed-h, 0px)`.

- [ ] **Step 1: Test** — `getByRole('region', { name: 'Hourly' })` is found; subtitle and `action` are inside `[data-card-header]`; `children` are inside `[data-card-body]`.
- [ ] **Step 2: FAIL → Step 3: implement → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add GlassCard`

### Task 4: Hero (static) and its text

**Files:**
- Create: `src/app/hero/heroText.ts`, `src/app/hero/Hero.tsx`
- Modify: `src/app/ui.ts` (`GEO_ERROR`), `src/app/components/LocationPicker.tsx` (import `GEO_ERROR` from `ui.ts`)
- Test: `src/app/__tests__/heroText.test.ts`, `src/app/__tests__/hero.test.tsx`

**Interfaces:**
- Consumes: `YOUR_LOCATION_ID` (`src/data/geolocation.ts`), `verdictLabel`, `durationLabel` (`src/app/ui.ts`)
- Produces:
  - `GEO_ERROR = "Can't get your location. Search a city instead."` in `src/app/ui.ts` (move the constant from `LocationPicker.tsx`)
  - `placeTitle(place: Place): { name: string; mine: boolean }` — returns `{ name: 'My location', mine: true }` for `YOUR_LOCATION_ID`. **Spec clarification:** there is no reverse geocoding, so instead of a separate “➤ MY LOCATION” eyebrow above the city, the city line itself becomes “➤ My location”.
  - `nowLine(hours: ScoredHour[], day: 'today' | 'tomorrow', now: NowLocal | null): string`
  - ```ts
    type HeroState =
      | { kind: 'no-place' }
      | { kind: 'loading'; place: Place }
      | { kind: 'error'; place: Place }
      | { kind: 'empty'; place: Place; reason: EmptyReason; duration: DurationMin }
      | { kind: 'result'; place: Place; best: TimeWindow; reason: string | null; duration: DurationMin; nowLine: string };
    ```
  - `Hero(props: { state: HeroState; locating: boolean; geoError: boolean; onUseLocation(): void; onFindCity(): void; onRetry(): void; onShowTomorrow(): void; notice: boolean; intro: boolean; findCityRef?: Ref<HTMLButtonElement> })`
  - `HERO_H1 = 'Know the best time to go outside'` (export from `Hero.tsx`; `Placeholder` renders the same text)

- [ ] **Step 1: Test `heroText.test.ts`**
  - **Today, now.hour = 10**, hour 10 with `uv 5.6`, `feelsLike 23.6` → `'Now UV 6 · Feels 24°'`.
  - **Tomorrow:** use only hours with `isDay`.
    - maximum UV 7, feels-like 18..24 → `'Peak UV 7 · Feels 18–24°'`;
    - all UV values `null` → `'Feels 18–24°'`;
    - all values `null` → `''`.
  - **Today, current hour has `uv: null`** → `'Now Feels 24°'` *(Review Focus 2)*.
  - **`placeTitle`:** for `YOUR_LOCATION_ID` → `{ name: 'My location', mine: true }`; for Lisbon → `{ name: 'Lisbon', mine: false }`.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Implement `heroText.ts`** (round with `roundHalfUp` from `src/domain/scoring.ts`)
- [ ] **Step 4: PASS**
- [ ] **Step 5: Test `hero.test.tsx`** — for each state from §4.8:
  - all states have `getByRole('heading', { level: 1, name: HERO_H1 })`;
  - **no-place:** “Choose a place” text, `--:--`, “Use my location” and “Find a city” buttons; clicks call callbacks; `geoError` produces `role="alert"` with text `"Can't get your location. Search a city instead."`;
  - **loading:** `role="status"` «Loading forecast…»;
  - **error:** `role="alert"` with “Couldn't load the forecast” text and “Try again” button → `onRetry`;
  - **empty:**
    - `too-short` with duration 120 → “Your free time is shorter than 2 h. Extend it or pick a shorter outing.”;
    - `dark` → «It's dark during your free time. Try earlier hours.»;
    - `past` → “No time left today.” and a “Show tomorrow” button;
    - large line `—`;
  - **result:**
    - city, `[data-hero-time]` with `best.label` text;
    - verdict line `Good · 1 h`, dot has `data-verdict="green"`;
    - reason, `nowLine`;
  - **notice=true:** `role="status"` «Your free time today has passed — showing tomorrow».
- [ ] **Step 6: FAIL**
- [ ] **Step 7: Implement `Hero.tsx`**
  - Typography and layout follow §3.3 and §4.1.
  - Large line: `font-size: min(16vw, 104px)`, weight 200, `.tabular`.
  - `.hero-scrim` layer (new class in `global.css`): `radial-gradient(ellipse at center, rgb(0 0 0 / 0.28), transparent 70%)` behind the text, `aria-hidden`.
  - All text lines use `text-shadow: 0 1px 2px rgb(0 0 0 / 0.25)`.
  - Empty-state and error text is copied verbatim from the deleted `EmptyState`/`ErrorState` (see test).
  - `intro` is unused for now: Task 14 will use it.
- [ ] **Step 8: PASS**
- [ ] **Step 9: Commit** — `feat: add Hero with result, empty, loading and error states`

### Task 5: Hourly card

**Files:**
- Create: `src/app/cards/stripItems.ts`, `src/app/cards/HourCell.tsx`, `src/app/cards/MetricSwitch.tsx`, `src/app/cards/HourlyCard.tsx`
- Modify: `src/app/components/HourDetails.tsx` (glass instead of `border bg-surface`; import `KEEP_DETAILS_ATTR` from `src/app/ui.ts`)
- Modify: `src/app/ui.ts` (move `KEEP_DETAILS_ATTR` from `HourStrip.tsx`; add `CELL_W = 56`)
- Test: `src/app/__tests__/stripItems.test.ts`, `src/app/__tests__/hourlyCard.test.tsx`

**Interfaces:**
- Consumes: `GlassCard` (Task 3), `WeatherIcon`, `weatherIcon` (Task 2), `HourDetails`
- Produces:
  - `type Metric = 'uv' | 'rain' | 'feels'`
  - `type StripItem = { kind: 'hour'; hour: ScoredHour } | { kind: 'sun'; event: 'sunrise' | 'sunset'; time: string }` (`time` — `'HH:MM'`)
  - `stripItems(day: DayForecast, hours: ScoredHour[]): StripItem[]`
  - `metricValue(hour: ScoredHour, metric: Metric): string`
  - `cellName(hour: ScoredHour): string`
  - `spanOf(items: StripItem[], fromHour: number, toHourExclusive: number): { left: number; width: number } | null` — in pixels, using `CELL_W`
  - `HourlyCard(props: { day: DayForecast; hours: ScoredHour[]; freeTime: { start: number; end: number }; best: TimeWindow | null; selectedHour: number | null; nowHour: number | null; onSelect(hour: number | null): void; intro: boolean })`

- [ ] **Step 1: Test `stripItems.test.ts`** (fixture `src/data/__fixtures__/lisbon.json` via `src/test/forecastJson.ts` + `evaluate`):
  - **Length and order:** 24 hours + 2 events; `sunrise` immediately follows the hour in which it occurred; `time` equals `'HH:MM'` from `day.sunrise`.
  - **No events** *(Review Focus 1)*: `sunrise === sunset`, `sunrise > sunset`, `''`, or a date from another day → no `kind: 'sun'` in the result, exactly 24 items.
  - **`metricValue`:**
    - `uv 5.4` → `'5'`;
    - `rainProb 30` → `'30%'`;
    - `feelsLike 23.5` → `'24°'`;
    - `null` for each of the three metrics → `'–'` *(Review Focus 2)*.
  - **`cellName`:**
    - regular hour → `'14:00, UV 5, rain 30%, OK with protection'`;
    - nighttime hour → `'03:00, UV 0, rain 0%, Night'`;
    - `null` → `'… UV no data, rain no data …'`.
  - **`spanOf`:** hours 13..16 with sunrise before them → `left` accounts for the event cell, `width = 3 * CELL_W`.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Implement `stripItems.ts`.** Parse time following `parseClock`/`resolveSun` in `src/domain/sky.ts`; skip the event on `null`.
- [ ] **Step 4: PASS**
- [ ] **Step 5: Test `hourlyCard.test.tsx`**
  - `getByRole('group', { name: 'Hourly forecast' })` contains 24 `button` elements.
  - The current hour has “Now” text (only if `nowHour` is provided; no “Now” for `nowHour = null`).
  - The selected hour has `aria-pressed="true"`.
  - **Keyboard:**
    - `ArrowRight` moves focus to the next hour, `End` to the last, `Home` to the first;
    - roving: only one button has `tabIndex` 0 (selected, otherwise “Now,” otherwise the first in the free-time range).
  - **Details:** clicking an hour → `onSelect(14)`; with `selectedHour = 14`, the “Details for 14:00” `region` is visible; clicking the selected hour again → `onSelect(null)`.
  - **Metric:** “Metric” `radiogroup` (selected icon on a sliding `layoutId` pill, as in `SegmentedControl`) with `UV` / `Rain` / `Feels like` radio buttons; selecting `Rain` changes the subtitle to “Chance of rain (%)” and cell values to percentages.
  - **Sunrise and sunset:** cells have no `button`; they have “Sunrise” / “Sunset” text.
  - **Highlights:** `[data-free-band]` and `[data-best-outline]` exist; without a best window (`best = null`), there is no outline.
- [ ] **Step 6: FAIL**
- [ ] **Step 7: Implement.**
  - Strip: `overflow-x-auto`, `scroll-snap-type: x mandatory`, hidden scrollbar. Cells have fixed width `CELL_W`.
  - Free-time background and best-window outline are absolutely positioned blocks based on `spanOf`; the outline is `<svg data-best-outline>` with `<rect rx=14>` and a white 1.5px `stroke`.
  - Past hours have `opacity: 0.45`.
  - Initial scroll (without animation) in `useLayoutEffect`: set `scrollLeft` to the “Now” cell, otherwise to `freeTime.start`.
  - Render `HourDetails` inside the card body.
- [ ] **Step 8: PASS**
- [ ] **Step 9: Commit** — `feat: add Hourly card with metric switch and sun events`

### Task 6: Your free time card

**Files:**
- Create: `src/app/cards/freeTimeRows.ts`, `src/app/cards/ScoreBar.tsx`, `src/app/cards/FreeTimeCard.tsx`
- Modify: `src/app/ui.ts` — `VERDICT_SHORT: Record<Verdict, string> = { green: 'Good', yellow: 'OK', red: 'Avoid' }`, `SCORE_BAR_MAX = 8`, `ROW_H = 44`
- Test: `src/app/__tests__/freeTimeCard.test.tsx`

**Interfaces:**
- Produces:
  - `interface FreeTimeRow { hour: ScoredHour; best: boolean; now: boolean; dark: boolean; fill: number }`
  - `freeTimeRows(hours: ScoredHour[], freeTime: { start: number; end: number }, best: TimeWindow | null, nowHour: number | null): FreeTimeRow[]`
  - `FreeTimeCard(props: { hours: ScoredHour[]; freeTime: { start: number; end: number }; best: TimeWindow | null; nowHour: number | null; duration: DurationMin; activity: Activity; intro: boolean })`
  - `ScoreBar({ fill, now, intro, delay }: { fill: number; now: boolean; intro: boolean; delay: number })`

- [ ] **Step 1: Test**
  - **`freeTimeRows`:**
    - free time 13..19 → 6 rows, hours 13–18;
    - `best` with hours 15–16 → `best: true` only for those hours;
    - `fill = min(score, 8) / 8` (score 4 → 0.5, score 12 → 1);
    - nighttime hour → `dark: true`;
    - `nowHour` → `now: true` for one hour.
  - **Rendering, table:**
    - `getByRole('table', { name: 'Your free time, hour by hour' })`;
    - 5 `columnheader` elements: Time, Weather, UV, Score, Verdict — visually hidden.
  - **Rendering, rows:**
    - visible verdict text `Good` / `OK` / `Avoid`, with full text accessible (`'Good'` / `'OK with protection'` / `'Not recommended'` in `.sr-only`);
    - dark hour: “Dark” text and no `[data-score-bar]`;
    - rain 60%: “60%” text; rain 20%: no percentage;
    - UV `null` → `UV –` *(Review Focus 2)*;
    - “Best” label on best-window rows.
  - **Header:** subtitle `'13:00–19:00 · Relaxed · 1 h'`.
- [ ] **Step 2: FAIL → Step 3: implement** (`ScoreBar`: track `rgb(255 255 255 / 0.12)`, fill `scaleX(fill)` with `transform-origin: left` over the scale gradient spanning the full track width — the gradient sits on the track, and the fill reveals it with mask `clip-path: inset(0 calc((1 - fill) * 100%) 0 0 round 999px)`; with `now`, an 8px white dot at the end of the fill) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add Your free time card with score bars`

### Task 7: What to take tiles

**Files:**
- Create: `src/app/cards/tileReason.ts`, `src/app/cards/TakeTiles.tsx`
- Modify: `src/app/icons/checklist/shared.tsx` (default `className` is `size-4`, color `currentColor` inherits white)
- Test: `src/app/__tests__/takeTiles.test.tsx`

**Interfaces:**
- Consumes: `rules.checklist`, `rules.checklistLabels`, `rules.emptyChecklistText`, icons `src/app/icons/checklist/*`
- Produces:
  - `tileReason(id: ChecklistId, window: TimeWindow, activity: Activity): { title: string; detail: string }`
  - `TakeTiles(props: { items: ChecklistItem[]; window: TimeWindow; activity: Activity; intro: boolean })`

Text (`title` / `detail`), with numbers from the window's hours (`roundHalfUp`) and `rules.checklist`:

| id | title | detail |
|---|---|---|
| sunscreen | `UV up to {maxUv}` | `Needed from UV {sunscreenUv}` |
| hat-sunglasses | `UV up to {maxUv}` | `Needed from UV {hatUv}` |
| rain-jacket | `Rain up to {maxRain}%` | `Needed from {rainJacket}% rain` |
| water | `Active plan` (activity `active`), otherwise `Feels up to {maxFeels}°` | `Needed when active or from {waterFeelsLike}°` |
| warm-layer | `Feels down to {minFeels}°` | `Needed below {warmLayerBelow}°` |

- [ ] **Step 1: Test**
  - **`tileReason`:** one case for each table row.
    - Window with UV 4.6 / 5.2 → `'UV up to 5'`, detail `'Needed from UV 3'`.
    - `water` with `relaxed` and feels-like 27.4 → `'Feels up to 27°'`.
  - **Rendering:**
    - `role="list"` list with a `listitem` for each item;
    - tile contains label from `checklistLabels`, `title`, and `detail`;
    - empty list → one tile with `rules.emptyChecklistText` text.
- [ ] **Step 2: FAIL → Step 3: implement** (`grid-cols-2` grid, `.glass` tile, `aspect-ratio: 1`; empty tile `col-span-2`, without `aspect-ratio`) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add What to take tiles`

### Task 8: `PlanControls` and glass controls

**Files:**
- Create: `src/app/cards/PlanControls.tsx`
- Modify: `src/app/components/SegmentedControl.tsx` (`bg-surface-strong` container → `glass` pill with `rounded-full`, `bg-white/90` indicator, selected text `text-black/85`, other text white)
- Modify: `src/app/components/FreeTimePicker.tsx` (`bg-white/15` track, `bg-white/70` band, handles are white 22px circles with a shadow)
- Test: `src/app/__tests__/planControls.test.tsx` (move `SegmentedControl` and `FreeTimePicker` checks from `controls.test.tsx`; delete `controls.test.tsx` in Task 12)

**Interfaces:**
- Produces: `PlanControls(props: { inputs: Inputs; onFreeTime(v: Inputs['freeTime']): void; onDuration(v: DurationMin): void; onActivity(v: Activity): void })` — three groups with `h3` headings “Free time”, “Duration”, “Activity”; radio groups named “Duration” and “Activity”; sliders “Free time start” and “Free time end”.

- [ ] **Step 1: Test**
  - Click radio `'3 h'` → `onDuration(180)`; `'Long in the sun'` → `onActivity('long-sun')`.
  - `ArrowRight` on the “Free time start” slider → `onFreeTime({ start: 14, end: 19 })`.
  - The line `'13:00 – 19:00'` is visible.
- [ ] **Step 2: FAIL → Step 3: implement → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add PlanControls and restyle segmented and free time controls`

### Task 9: `Sheet`

**Files:**
- Create: `src/app/sheet/Sheet.tsx`
- Modify: `src/motion/tokens.ts` — add `springs.sheet = { type: 'spring', duration: 0.45, bounce: 0.08 }` (leave other tokens unchanged until Task 14)
- Modify: `src/styles/global.css` — page scaling beneath the sheet:

  ```css
  html[data-sheet-open] [data-page] {
    transform: scale(0.94);
    border-radius: 16px;
    transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.45s;
  }
  ```

  Under `prefers-reduced-motion: reduce`, omit `transform`.
- Modify: `src/components/BaseLayout.astro` — `<div data-page>` wrapper around header/main/footer
- Test: `src/app/__tests__/sheet.test.tsx`

**Interfaces:**
- Consumes: `springs.sheet`
- Produces: `Sheet(props: { open: boolean; onClose(): void; title: string; size: 'auto' | 'tall'; returnFocusRef: RefObject<HTMLElement | null>; children: ReactNode })`
  - portal into `document.body` with `data-sheet-root`;
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → visible `h2` with `title`;
  - on opening: `inert` on `[data-page]`, `html[data-sheet-open]`, focus the first focusable element inside;
  - on closing: remove all of these, focus `returnFocusRef.current`.

- [ ] **Step 1: Test**
  - `open=true` → `getByRole('dialog', { name: 'Plan' })`; `[data-page]` has the `inert` attribute; `document.activeElement` is inside the dialog.
  - Esc → `onClose`.
  - Click `[data-sheet-backdrop]` → `onClose`.
  - Rerender with `open=false` → `inert` removed, `data-sheet-open` removed, focus on `returnFocusRef`.
  - Unmounting an open sheet also removes `inert` *(Review Focus 3)*.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Implement.**
  - Panel: `m.div`, `drag="y"`, `dragConstraints={{ top: 0, bottom: 0 }}`, `dragElastic={{ top: 0, bottom: 1 }}`; `onDragEnd` closes when `offset.y > 0.3 * height` or `velocity.y > 500`.
  - Enter/exit animation: `AnimatePresence`, `y: '100%' → 0`, `springs.sheet`; with reduced motion, `opacity` over `durations.fast`.
  - Dim the backdrop with `rgb(0 0 0 / 0.35)`.
  - Height: `tall` is `92dvh`; `auto` fits content up to `92dvh`.
  - Bottom padding: `env(safe-area-inset-bottom)`.
- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add accessible bottom Sheet`

### Task 10: Toolbar and day dots

**Files:**
- Create: `src/app/toolbar/Toolbar.tsx`, `src/app/toolbar/DayDots.tsx`
- Test: `src/app/__tests__/toolbar.test.tsx`

**Interfaces:**
- Produces:
  - `DayDots(props: { day: Inputs['day']; onDay(d: Inputs['day']): void; panelId: string })` — `role="tablist"` `aria-label="Day"`, two `tab` elements (“Today”, “Tomorrow”) with `aria-selected` and `aria-controls={panelId}`; ←/→ switch tabs and move focus
  - `Toolbar(props: { day: Inputs['day']; onDay(d: Inputs['day']): void; panelId: string; onPlan?: () => void; onCities(): void; planRef: Ref<HTMLButtonElement>; citiesRef: Ref<HTMLButtonElement> })` — `nav aria-label="App"`, 48px “Plan” and “Cities” buttons; no Plan button without `onPlan`
  - `TOOLBAR_H = 72` in `src/app/ui.ts` (48px buttons + padding)

- [ ] **Step 1: Test**
  - Tabs: `getByRole('tab', { name: 'Tomorrow' })` → click → `onDay('tomorrow')`; `ArrowRight` on “Today” → `onDay('tomorrow')` and focus on “Tomorrow”.
  - Without `onPlan`, no “Plan” `button`; click “Cities” → `onCities`.
- [ ] **Step 2: FAIL → Step 3: implement** (fixed at bottom center, `bottom: calc(12px + env(safe-area-inset-bottom))`, `.glass` material; 8px dots, active white, inactive `white/40`) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add bottom toolbar with day dots`

### Task 11: Cities sheet and geolocation hook

**Files:**
- Create: `src/app/hooks/useGeolocate.ts`, `src/app/sheet/CitiesSheet.tsx`
- Modify: `src/app/components/CitySearch.tsx` (input style: glass, `rounded-xl`, white text, `white/55` placeholder; preserve behavior)
- Delete: `src/app/components/LocationPicker.tsx` (move its behavior: selection, geolocation, error)
- Test: `src/app/__tests__/citiesSheet.test.tsx` (move `LocationPicker` scenarios from `controls.test.tsx`)

**Interfaces:**
- Consumes: `Sheet` (Task 9), `requestPosition`, `yourLocationPlace`, `formatPlace`, `CitySearch`, `GEO_ERROR` (`src/app/ui.ts`, Task 4)
- Produces:
  - `useGeolocate(onPlace: (p: Place) => void): { locating: boolean; geoError: boolean; locate(): Promise<void>; clearError(): void }`
  - `CitiesSheet(props: { open: boolean; onClose(): void; place: Place | null; onPlace(p: Place): void; returnFocusRef: RefObject<HTMLElement | null> })` — “Cities” heading; current place as `formatPlace(place)` text; “Use my location” button; `CitySearch`; `role="alert"` with `GEO_ERROR`

- [ ] **Step 1: Test**
  - Select “Lisbon, Portugal” in the combobox → `onPlace` with Lisbon and `onClose`.
  - `requestPosition` rejected (`vi.mock('../../data/geolocation')`) → `alert` with `GEO_ERROR`, focus in combobox.
  - Success → `onPlace(yourLocationPlace(lat, lon))`.
  - While locating, the button shows “Locating…” and is `disabled`.
- [ ] **Step 2: FAIL → Step 3: implement → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add Cities sheet and useGeolocate`

### Task 12: App assembly, old UI removal, e2e

**Files:**
- Create: `src/app/hero/heroState.ts`, `src/app/hooks/useIsDesktop.ts`, `src/app/reserveLayout.ts`
- Modify (rewrite): `src/app/UvGoApp.tsx`
- Modify: `src/pages/index.astro` (remove `Hero.astro`; `reservePlaceLayout` → `reserveLayout`)
- Delete:
  - Components: `src/components/Hero.astro`, `src/app/reservePlaceLayout.ts`, `src/app/components/{ResultCard,MiniResult,DayArcTimeline,HourStrip,LoadingSun,TimelineSkeleton,EmptyState,ErrorState,WhatToTake}.tsx`, `src/app/icons/VerdictIcon.tsx`.
  - Hooks: `src/app/hooks/{useCardOffscreen,useCountUp}.ts`.
  - Their tests: `result.test.tsx`, `timeline.test.tsx`, `states.test.tsx`, `statesReducedMotion.test.tsx`, `whatToTake*.test.tsx`, `controls.test.tsx`, and parts of `hooks.test.tsx` covering the deleted hooks.
  - From `ui.ts`, unused `CARD_CLASS`, `CARD_SLOT_CLASS`, `HOUR_STRIP_MIN_H_CLASS`, `PANEL_CLASS`, `LOCATION_SKELETON_CLASS`, `ADJUST_SKELETON_CLASS`.
- Modify: `src/app/components/SkyLayer.tsx` (import `useIsDesktop` from the new hook)
- Test: `src/app/__tests__/heroState.test.ts`, `src/app/__tests__/reserveLayout.test.ts`, `src/app/__tests__/UvGoApp.test.tsx` (rewrite), `e2e/app.spec.ts`, `e2e/a11y.spec.ts`, `e2e/mocks.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–11; `useForecastLoader`, `useNow`, `useFirstResult`, `useSky`, `reducer`, `evaluate`, `buildChecklist` (via `evaluate`)
- Produces:
  - `heroState(state: AppState, evaluation: EvaluationResult | null, now: NowLocal | null): HeroState`
  - `useIsDesktop(): boolean` (query `(min-width: 1024px)`, `useSyncExternalStore`, `false` on the server)
  - `reserveLayout(win?)`: self-contained function for an inline script. Following `reservePlaceLayout`, sets `data-has-place` and additionally `--free-rows` on `<html>`. Value: `end − start` from `localStorage['uvgo:inputs']`, or 6 on error or invalid data.
  - `DAY_PANEL_ID = 'day-panel'`

**`UvGoApp` layout:**
- Mobile:
  - `Hero`;
  - `div#day-panel role="tabpanel"` with Hourly, Your free time, What to take cards;
  - `Toolbar` with `onPlan`;
  - `PlanSheet` = `Sheet size="auto" title="Plan"` with `PlanControls`;
  - `CitiesSheet`.
- Desktop (`useIsDesktop()`): grid from §3.4/§4.2.
  - Hero in the left column, `lg:sticky lg:top-24`.
  - Right column: Hourly; below it, a grid: Your free time | (What to take + `GlassCard title="Plan"` with `PlanControls`).
  - Toolbar without `onPlan`.
- Bottom content padding: `calc(TOOLBAR_H + 24px + env(safe-area-inset-bottom))`.
- The old `SkyLayer` remains under `Suspense` for now.
- `aria-live`: keep the existing announcement.
- Cards by state (§4.8): for `loading`, `GlassCard` skeletons with `aria-busy`; hidden for `no-place` and `error`. What to take appears only with a result.
- When `useIsDesktop()` becomes `true`, reset `planOpen` to `false`.
- `Placeholder`:
  - fixed-height 300px hero skeleton with `h1` `HERO_H1`;
  - fixed-height Hourly skeleton;
  - free-time skeleton with height `calc(var(--free-rows, 6) * ROW_H + 56px)`.

- [ ] **Step 1: Test `heroState.test.ts`** — one case per `kind`:
  - `place: null` → `no-place`;
  - `forecast.status: 'error'` → `error`;
  - `evaluation: null` → `loading`;
  - `best: null` and `emptyReason: 'dark'` → `empty`;
  - otherwise → `result` with `nowLine` from `heroText.nowLine`.
- [ ] **Step 2: Test `reserveLayout.test.ts`**
  - Stored `{ freeTime: { start: 9, end: 17 } }` → `--free-rows` = `'8'`.
  - Invalid JSON or `getItem` throws → `'6'` and no exception.
  - Valid place → `data-has-place`.
- [ ] **Step 3: Test `UvGoApp.test.tsx`** (rewrite following the existing style: mock `fetch` with the Lisbon fixture, fixed time):
  - first visit: `h1`, “Use my location” / “Find a city” buttons; “Find a city” opens the “Cities” dialog;
  - selecting Lisbon → `[data-hero-time]` with a label matching `\d{2}:00–\d{2}:00`, “Hourly” region, “Your free time, hour by hour” table, list of tiles;
  - “Plan” button → “Plan” dialog → `3 h` radio → hero label changes, window length is 3 h;
  - “Tomorrow” tab → Tomorrow has `aria-selected`, second-day data;
  - stored inputs are restored;
  - **desktop** (mock `matchMedia` → `matches: true`): no “Plan” button, “Plan” region exists;
  - **breakpoint change with a sheet open** *(Review Focus 3)*: open “Plan” on mobile, switch the `matchMedia` mock to desktop and trigger its `change` → `queryByRole('dialog')` is empty, `[data-page]` has no `inert`, “Plan” region is visible.
- [ ] **Step 4: Run — FAIL**
- [ ] **Step 5: Implement** `heroState.ts`, `useIsDesktop.ts`, `reserveLayout.ts`, the new `UvGoApp.tsx`, and changes to `index.astro`; remove files listed under Delete.
- [ ] **Step 6: `npm test`, `npm run lint`, `npm run check` — PASS**; `grep -rn "ResultCard\|DayArcTimeline\|HourStrip\|MiniResult\|LocationPicker" src` returns nothing.
- [ ] **Step 7: Update e2e**
  - `mocks.ts`: `searchLisbon` first clicks the “Find a city” `button` if visible, otherwise “Cities”; then follows the existing steps.
  - **Happy path:** after search, `getByRole('button', { name: 'Plan' }).click()`, then the existing `radio '3 h'` and window-length checks. Read the label from `[data-hero-time]`.
  - **Geolocation:** “Use my location” button in the hero.
  - **New checks:**
    - Esc closes “Plan”, focus returns to the “Plan” button;
    - 1280×800: “Plan” `region` visible without a sheet;
    - 320×640 with place `{ name: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch', … }` in `localStorage` and a mocked forecast: `document.documentElement.scrollWidth <= 320`, `[data-hero-time]` entirely within the viewport *(Review Focus 4)*.
  - `a11y.spec.ts`: wait for the result via `[data-hero-time]`.
- [ ] **Step 8: `npm run test:e2e` — PASS; `npm run build && npm run check:bundle` — PASS**
- [ ] **Step 9: Commit** — `feat: assemble iOS-style app layout with toolbar and sheets`

### Task 13: Header, footer, How it works, FAQ

**Files:**
- Modify: `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/HowItWorks.astro`, `src/components/Faq.astro`, `src/components/BaseLayout.astro`
- Test: `src/test/howItWorks.test.ts` (update selectors if broken), existing e2e tests

**Interfaces:** none new.

- [ ] **Step 1: Header.**
  - No background or `border-b`, `position: absolute` over the sky on the homepage.
  - “UV GO” and the link group each sit on their own `.glass` pill with `rounded-full px-3 min-h-11`, text 15px/600.
- [ ] **Step 2: Footer.** No `bg-surface`; content on one `.glass` background with `rounded-2xl`, 13px, secondary color; bottom padding for the toolbar only on `/` (class via `withToolbar` prop from `index.astro`).
- [ ] **Step 3: How it works and FAQ.**
  - Outer containers: `.glass rounded-[22px]`.
  - Inner `border bg-surface`: replace with `divide-y divide-white/15` dividers (FAQ) and `bg-white/8 rounded-xl` (How it works steps).
  - Rule tables follow the row style in §4.4: 44px rows, `white/15` dividers.
  - Section headings 22px/600.
- [ ] **Step 4:** `npm test && npm run check && npm run test:e2e` — PASS (axe: no violations)
- [ ] **Step 5: Commit** — `feat: restyle header, footer, How it works and FAQ as glass`

---

## Phase 3. Animations

### Task 14: Tokens, choreography, first result

**Files:**
- Modify: `src/motion/tokens.ts`:

  ```ts
  springs = {
    smooth: { type: 'spring', duration: 0.5, bounce: 0 },
    snappy: { type: 'spring', duration: 0.3, bounce: 0.15 },
    sheet: { type: 'spring', duration: 0.45, bounce: 0.08 },
  }
  ```

  Remove `gentle` and `bouncy`; leave `durations` and `ease` unchanged.
- Modify: `src/motion/choreography.ts` — new `firstResult` (constants below), `labelVisibleAt`, `totalDuration`
- Modify: `src/app/hooks/useFirstResult.ts` — remove `search`/`handoff` stages and `labelInFrame`; return `{ playIntro: boolean }`, with `playIntro` lasting `totalDuration()` seconds
- Modify: `Hero.tsx`, `GlassCard.tsx` (`index` prop for the stagger step), `HourlyCard.tsx`, `ScoreBar.tsx`, `TakeTiles.tsx`, `SegmentedControl.tsx` (`springs.snappy` already exists)
- Test: `src/motion/__tests__/choreography.test.ts` (rewrite), `src/app/__tests__/motion.test.tsx` (rewrite), `src/app/__tests__/hooks.test.tsx` (section covering `useFirstResult`)

**Interfaces:**
- Produces:

  ```ts
  export const firstResult = {
    heroIn: 0.05, heroInDuration: 0.3, verdictLag: 0.06,
    cardsIn: 0.25, cardStagger: 0.07,
    hourScroll: 0.45,
    bestOutline: 0.45, bestOutlineDuration: 0.35,
    barsGrow: 0.6, barsDuration: 0.4, barStagger: 0.03, barStaggerMax: 0.2,
    tilesIn: 0.7, tileStagger: 0.05,
  };
  export function labelVisibleAt(c = firstResult): number; // c.heroIn + c.heroInDuration
  export function totalDuration(c = firstResult): number;   // max over steps; 4 cards, 5 tiles
  ```

- [ ] **Step 1: Test `choreography.test.ts`**
  - `labelVisibleAt()` ≈ 0.35 and ≤ 1.0.
  - `totalDuration()` ≤ 1.8 and ≥ 1.0.
  - Increasing `barStagger` with 24 rows does not exceed `barsGrow + barStaggerMax + barsDuration`.
- [ ] **Step 2: Test `motion.test.tsx`**
  - With `intro=true`, `[data-hero-time]` has `opacity` < 1 in the first frame and 1 after `totalDuration()`.
  - `[data-best-outline] rect` animates `pathLength`.
  - With reduced motion (`vi.mock` `useReducedMotion` → `true`), all final values apply immediately; no `filter: blur` in the DOM.
- [ ] **Step 3: FAIL → Step 4: implement.** Animations follow the table in §5.2:
  - hero: `filter blur(8px)→0`, `y 12→0`, `opacity`;
  - cards: `y 16→0`, `opacity`, delay `cardsIn + index * cardStagger`;
  - hourly strip: scroll to target with `animate(scrollLeft)` from `motion/react` — `animate` is already in the `domMax` bundle; verify the budget in Step 6;
  - best-window outline: `pathLength 0→1`;
  - bars: `scaleX`, delay `barsGrow + min(i * barStagger, barStaggerMax)`;
  - tiles: `scale 0.94→1`, `opacity`.
  - Without `intro`, no entrance animations.
  - Hour-detail expansion: `HourlyCard` body uses `m.div layout` with `springs.smooth`.
  - `whileTap={{ scale: 0.97 }}` + `springs.snappy` on hour cells, tiles, toolbar buttons, and hero buttons.
  - Reduced motion: `opacity` over `durations.fast`, no `layout` or `whileTap`.
- [ ] **Step 5: PASS**
- [ ] **Step 6: `npm run build && npm run check:bundle` — PASS** (if `animate` exceeds the budget, scroll with `element.scrollTo({ left, behavior: 'smooth' })`)
- [ ] **Step 7: Commit** — `feat: new first-result choreography on iOS-style springs`

### Task 15: `NumericRoll`

**Files:**
- Create: `src/app/components/NumericRoll.tsx`
- Modify: `Hero.tsx` (window label and `nowLine`), `HourCell.tsx` (metric value)
- Test: `src/app/__tests__/numericRoll.test.tsx`

**Interfaces:**
- Produces:
  - `rollParts(prev: string, next: string): { char: string; changed: boolean }[]` — character by character, by position; if lengths differ, all characters count as changed
  - `rollDirection(prev: string, next: string): 1 | -1` — compare numbers extracted from strings (`parseInt` of the first digit group); `1` means upward
  - `NumericRoll({ value, className }: { value: string; className?: string })` — outer `span` with `aria-label={value}` and a `role="text"` equivalent (`<span aria-label>` + `aria-hidden` on characters)

- [ ] **Step 1: Test**
  - `rollParts('15:00–16:00', '17:00–18:00')`: `changed` only at indices 1 and 7.
  - `rollDirection('15:00', '13:00') === -1`.
  - Rendering: `getByLabelText('17:00–18:00')` after rerender; each character is `aria-hidden`.
  - Unchanged characters receive no `m` animation: they have no `data-rolling`.
  - Reduced motion: no `transform` / `blur`, only `opacity`.
- [ ] **Step 2: FAIL → Step 3: implement** (§5.5: 0.6em displacement, `blur(4px)`, `springs.smooth`, duration 0.35 s, adjacent-character stagger 0.03 s; changed characters use `AnimatePresence mode="popLayout"` keyed by `${index}-${char}`) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add NumericRoll digit transitions`

### Task 16: Hero collapse

**Files:**
- Create: `src/app/hero/useHeroCollapse.ts`, `src/app/hero/CollapsedBar.tsx`
- Modify: `Hero.tsx`, `UvGoApp.tsx` (sets `--hero-collapsed-h: 56px` on the root on mobile, `0px` on desktop)
- Test: `src/app/__tests__/heroCollapse.test.tsx`

**Interfaces:**
- Produces:
  - `COLLAPSE_DISTANCE = 140`, `COLLAPSED_H = 56`
  - `collapseStyles(y: number): { timeScale: number; timeY: number; detailsOpacity: number; eyebrowOpacity: number; barOpacity: number }` — pure function:
    - `timeScale`: 1 → 0.38 over 0..140;
    - `detailsOpacity`: 1 → 0 over 0..60;
    - `eyebrowOpacity`: 1 → 0 over 0..100;
    - `barOpacity`: 0 → 1 over 100..140.
    - Clamp values outside the range.
  - `useHeroCollapse(enabled: boolean): Record<keyof ReturnType<typeof collapseStyles>, MotionValue<number>>` — via `useScroll().scrollY` + `useTransform(scrollY, collapseStyles)`
  - `CollapsedBar(props: { place: string; label: string; verdict: Verdict; opacity: MotionValue<number> })` — fixed at the top, `aria-hidden`, no `tabIndex`; click → `window.scrollTo({ top: 0, behavior })` (`auto` with reduced motion)

- [ ] **Step 1: Test**
  - `collapseStyles(0)` → `{ timeScale: 1, …, barOpacity: 0 }`.
  - `collapseStyles(140).timeScale` ≈ 0.38; `collapseStyles(60).detailsOpacity === 0`; `collapseStyles(500)` = `collapseStyles(140)`.
  - `CollapsedBar`: `aria-hidden="true"`, not focusable, text `'Lisbon · 15:00–16:00 | Good'`.
  - On desktop (`enabled=false`), `[data-hero-time]` has no scroll-driven `transform`.
- [ ] **Step 2: FAIL → Step 3: implement** (reduced motion does not disable collapse; only `filter` is disabled) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: collapse hero into a pinned bar on scroll`

### Task 17: Tucking cards beneath the hero

**Files:**
- Create: `src/app/cards/useCardTuck.ts`
- Modify: `src/app/ui.ts` — `export const CARD_TUCK_CLIP = true`
- Modify: `GlassCard.tsx` (accepts `tuck?: boolean`)
- Test: `src/app/__tests__/cardTuck.test.tsx`

**Interfaces:**
- Produces:
  - `tuckInset(cardTop: number, headerH: number, collapsedH: number, bodyH: number): number` — pixels to clip from the top of the body: `clamp(collapsedH + headerH − (cardTop + headerH), 0, bodyH)`, where `cardTop` is `getBoundingClientRect().top`
  - `useCardTuck(cardRef: RefObject<HTMLElement | null>, enabled: boolean): MotionValue<string>` — `clip-path` string `inset(<n>px 0 0 0 round 22px)`; subscribe to `useScroll().scrollY.on('change')`, read `getBoundingClientRect` in the same frame, no `setState`

- [ ] **Step 1: Test**
  - `tuckInset(200, 44, 56, 300) === 0`; `tuckInset(20, 44, 56, 300) === 36`; `tuckInset(-400, 44, 56, 300) === 300`.
  - With `CARD_TUCK_CLIP = false` (`vi.mock` the `ui` module) or on desktop, the body has no `clip-path`.
- [ ] **Step 2: FAIL → Step 3: implement → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: tuck card bodies under the collapsed hero`

### Task 18: Today/Tomorrow pager and dot pill

**Files:**
- Create: `src/app/pager/DayPager.tsx`
- Modify: `DayDots.tsx` (active dot is `m.span layoutId="day-dot"`, 16px wide), `UvGoApp.tsx` (wrap `#day-panel` and hero in `DayPager`; pass `progress` to the sky, used in Task 21)
- Test: `src/app/__tests__/dayPager.test.tsx`

**Interfaces:**
- Produces:
  - `pagerDecision(offsetX: number, velocityX: number, width: number, day: Inputs['day']): Inputs['day']` — switches when `|offset| ≥ 0.25 * width` or `|velocity| > 500`; left (negative) to `tomorrow`, right to `today`; never switches beyond an edge
  - `lockAxis(dx: number, dy: number): 'x' | 'y' | null` — `null` while `max(|dx|, |dy|) < 10`; `'y'` if the angle to horizontal is > 30°
  - `rubberBand(offset: number, atEdge: boolean): number` — `atEdge ? offset * 0.3 : offset`
  - `DayPager(props: { day: Inputs['day']; onDay(d): void; enabled: boolean; progress: MotionValue<number>; children: ReactNode })` — `progress` from 0 (today) to 1 (tomorrow) during a swipe; the gesture does not start if `pointerdown` originates inside `[data-hourly-strip]`

- [ ] **Step 1: Test**
  - `pagerDecision(-100, 0, 390, 'today') === 'tomorrow'`, `pagerDecision(-50, 0, 390, 'today') === 'today'`, `pagerDecision(-20, -600, 390, 'today') === 'tomorrow'`, `pagerDecision(-200, 0, 390, 'tomorrow') === 'tomorrow'`.
  - `lockAxis(4, 3) === null`, `lockAxis(12, 3) === 'x'`, `lockAxis(10, 8) === 'y'`.
  - `rubberBand(100, true) === 30`.
  - `enabled=false` (desktop or reduced motion) → container has no `pointerdown` handlers (`data-pager-enabled="false"`).
  - External `day` change → content changes, `progress` = 0 or 1.
- [ ] **Step 2: FAIL → Step 3: implement** (`m.div` content with gesture-driven `x` offset; after the decision, spring to the new page with `springs.sheet`, then `onDay`; reduced motion uses a `durations.fast` fade) **→ Step 4: PASS**
- [ ] **Step 5: e2e:** 390×844 context with `hasTouch: true, isMobile: true` (giving `pointer: coarse`). Send `pointerdown` → 5 × `pointermove` (−40px x steps) → `pointerup` to `#day-panel` with `pointerType: 'touch'` via `locator.dispatchEvent`. Expect the “Tomorrow” tab to have `aria-selected="true"`.
- [ ] **Step 6: Commit** — `feat: swipe between Today and Tomorrow`

---

## Phase 4. WebGL sky

### Task 19: `skyUniforms` and sky-derived glass

**Files:**
- Create: `src/domain/skyUniforms.config.ts`, `src/domain/skyUniforms.ts`
- Test: `src/domain/__tests__/skyUniforms.test.ts`

**Interfaces:**
- Consumes: `SkyState`, `SkyPhase`, `WeatherGroup` (`sky.ts`); `SKY_PALETTE`, `MAX_SKY_LUMA` (Task 1); `glassFor`, `Glass` (Task 1); `hexToRgb`, `over`
- Produces:
  - ```ts
    interface SkyUniforms {
      skyTop: Rgb; skyBottom: Rgb; sunPos: [number, number]; sunIntensity: number;
      moon: number; stars: number; cloudCover: number; cloudDark: number; cloudSpeed: number;
      fog: number; rain: number; snow: number; glassDrops: number; heat: number;
      thunder: number; maxLuma: number; sunZone: number;
    }
    ```
  - `WEATHER_TABLE: Record<WeatherGroup, { cloudCover; cloudDark; fog; rain; snow; glassDrops }>` — values from §6.3
  - `SUN_ZONE = 0.18`, `BASE_CLOUD_SPEED = 0.02`
  - `skyUniforms(s: SkyState): SkyUniforms`
  - `mixUniforms(a: SkyUniforms, b: SkyUniforms, t: number): SkyUniforms` (linear interpolation across all fields)
  - `glassTint(u: SkyUniforms): Glass` = `glassFor(base)`, where `base = over(over(skyTop, 0.5, skyBottom) mixed with gray #8a96a8 by cloudCover × 0.6, then × (1 − 0.5 × cloudDark))`

- [ ] **Step 1: Test**
  - For each weather type, fields match `WEATHER_TABLE`.
  - Night → `sunIntensity 0`, `moon 1`, `stars = 1 − cloudCover`; day → `stars 0`.
  - `wind: true` doubles `cloudSpeed`; `heat: true` → `heat 1`; weather `thunder` → `thunder 1`, others → `thunder 0`.
  - `sunPos[1]` ≤ `SUN_ZONE` for any `sunPosition` in 0..1 (y measured from the top of the screen).
  - `skyTop`/`skyBottom` = `SKY_PALETTE[phase]`.
  - `mixUniforms(a, b, 0.5).rain` is the mean.
  - **Contrast:** for all 6 × 7 phase/weather combinations and `mixUniforms` of any two adjacent phases at `t = 0.5`, white and secondary text on `glassTint(u)` over gray with luminance `MAX_SKY_LUMA` has contrast ≥ 4.5; `alpha` ≤ 0.8.
- [ ] **Step 2: FAIL → Step 3: implement → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: map sky state to shader uniforms and glass tint`

### Task 20: Shader and renderer

**Files:**
- Create: `src/app/sky/shader.ts`, `src/app/sky/renderer.ts`
- Test: `src/app/__tests__/renderer.test.ts`

**Interfaces:**
- Consumes: `SkyUniforms` (Task 19)
- Produces:
  - `VERTEX_SRC: string`, `FRAGMENT_SRC: string` (GLSL ES 1.0, `precision mediump float`, uniform names are `u` + PascalCase `SkyUniforms` field name, e.g. `uSkyTop`, `uCloudCover`; plus `uTime`, `uResolution`, `uFlash`, `uOctaves`)
  - `smoothStep(cur: SkyUniforms, target: SkyUniforms, dt: number): SkyUniforms` — `cur + (target − cur) × (1 − exp(−dt / 0.4))` for all fields
  - `type Quality = { scale: 0.5 | 0.35; octaves: 4 | 2; fps: 60 | 30 }`
  - `nextQuality(q: Quality, avgFrameMs: number): Quality` — at `> 20`: first `scale 0.35`, then `octaves 2` + `fps 30`; never increases again
  - `nextFlashDelay(rand: () => number): number` — 6..14 s
  - `createRenderer(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; onLost(): void }): SkyRenderer | null` — `null` if `getContext('webgl')` returns `null` or the shader fails to compile (`console.warn` once)
  - `interface SkyRenderer { setTarget(u: SkyUniforms): void; start(): void; stop(): void; destroy(): void }` — with `reducedMotion`, `start()` draws one frame with `cur = target` and no particles (`uRain = uSnow = uGlassDrops = uHeat = uFlash = 0`), then one more frame on each `setTarget`; otherwise a rAF loop paused on `visibilitychange`

- [ ] **Step 1: Test**
  - `smoothStep(a, b, 0)` = a; `smoothStep(a, b, 10)` ≈ b (tolerance 1e-3); at `dt = 0.4`, ≈ 63% of the transition is complete.
  - `nextQuality({ scale: 0.5, octaves: 4, fps: 60 }, 25)` → `scale 0.35`; repeat → `octaves 2, fps 30`; at 10 ms, unchanged.
  - `nextFlashDelay(() => 0) === 6`, `nextFlashDelay(() => 0.999)` ≈ 14.
  - `createRenderer` with a canvas whose `getContext` → `null` returns `null`.
  - **Uniform names:** every `SkyUniforms` key except `thunder` appears in `FRAGMENT_SRC` as `u` + PascalCase. `thunder` is not passed to the shader: when `cur.thunder > 0.5`, the renderer triggers `uFlash` itself — a 0 → 1 → 0 pulse over 0.3 s, the next after `nextFlashDelay`.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Implement `shader.ts`** using the layers from §6.4:
  - Noise: value noise using hash `fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453)`.
  - Clouds: fbm with `uOctaves` octaves, distortion `p + 0.6 * fbm(p + t)`.
  - Sun: `smoothstep` disk, `exp(−d * 6)` glow; halo is a ring with radius 0.22 of the screen height and a low-intensity rainbow rim.
  - Rain: 3 layers of slanted `fract` streaks in rotated coordinates.
  - Snow: 3 layers of dots with `sin` swaying.
  - Glass drops: 8×14 grid, random cells, UV displacement beneath the lens.
  - Luminance limit as the final step: `if (uv.y > uSunZone) col *= min(1.0, uMaxLuma / max(luma(col), 1e-4))`, where `luma` is linear relative luminance.
- [ ] **Step 4: Implement `renderer.ts`.**
  - One fullscreen triangle.
  - Canvas size = CSS size × `quality.scale`.
  - Average frame time: rolling average over 60 frames.
  - `webglcontextlost` listener → `stop()` and `onLost()`.
- [ ] **Step 5: PASS**
- [ ] **Step 6: Manual shader check:** no temporary page needed — the sky is visible with `npm run dev` in Task 21; here, it is enough that `createRenderer` in Playwright-Chromium (SwiftShader) emits no `warn`, verified by e2e in Task 21.
- [ ] **Step 7: Commit** — `feat: add procedural sky shader and renderer`

### Task 21: `SkyCanvas`, integration, removing `SkyLayer`

**Files:**
- Create: `src/app/sky/SkyCanvas.tsx`
- Modify: `src/app/UvGoApp.tsx` (`lazy(() => import('./sky/SkyCanvas'))` instead of `SkyLayer`; pass Today and Tomorrow sky states and `progress` from `DayPager`)
- Modify: `src/app/hooks/useSkyRef.ts` — `useSky` additionally returns the second day's sky: `useSkyPair(state, evaluation, now): { today: SkyState; tomorrow: SkyState }`. Keep the same `refFor` logic for each day; apply `selectedHour` only to the active day.
- Modify: `src/styles/global.css` — remove `.sky-layer`, `.sky-phase*`, `.sky-glow`, `.sky-moon`, `.sky-veil`, `.sky-heat`, `.sky-drop`, `.sky-flake`, `.sky-wind`, `.sky-flash`, their `@keyframes` and `--sky-glow-*`/`--sky-veil-*`/`--sky-flash-*`/`--sky-moon-*`/`--sky-rain`/`--sky-snow`/`--sky-streak`/`--sky-shimmer`; add `.sky-canvas` (fixed, inset 0, z-index −1, `width: 100%; height: 100%`, `opacity` 0 → 1 over 400 ms based on `[data-ready]`); `.glass { transition: background-color 0.6s }`
- Delete: `src/app/components/SkyLayer.tsx`, `src/app/__tests__/sky.test.tsx` (particle and veil content), `src/app/__tests__/skyApp.test.tsx` → rewrite as `skyCanvas.test.tsx`
- Modify: `scripts/check-bundle.mjs` — comment “lazy SkyLayer” → “lazy SkyCanvas”
- Test: `src/app/__tests__/skyCanvas.test.tsx`, e2e `e2e/app.spec.ts`

**Interfaces:**
- Consumes: `createRenderer`, `SkyRenderer` (Task 20); `skyUniforms`, `mixUniforms`, `glassTint` (Task 19); `progress: MotionValue<number>` (Task 18)
- Produces: `default function SkyCanvas(props: { today: SkyState; tomorrow: SkyState; progress: MotionValue<number>; reducedMotion: boolean })`
  - render target: `mixUniforms(skyUniforms(today), skyUniforms(tomorrow), progress.get())`, updated on `progress.on('change')` and prop changes;
  - write `--glass-rgb`/`--glass-alpha` to `document.documentElement.style` from the target's `glassTint` when day or state changes (not on every swipe frame: when `progress` is 0 or 1);
  - wait for `requestIdleCallback` on startup (fallback `setTimeout(start, 200)`);
  - after the first frame, set `data-ready` on canvas and `data-sky-live` on `<html>`;
  - on `null` from `createRenderer` or `onLost`: remove canvas, `style.removeProperty('--glass-rgb' | '--glass-alpha')`, remove `data-sky-live`.

- [ ] **Step 1: Test `skyCanvas.test.tsx`** (jsdom: `getContext` returns `null`)
  - After the idle timer, no `canvas`, no `data-sky-live`, no inline `--glass-*` on `<html>`, no exceptions, `console.warn` called ≤ 1 time.
  - **Context loss** *(Review Focus 5)*: `vi.mock('../sky/renderer')`, `createRenderer` returns a fake `SkyRenderer` and saves `opts.onLost`.
    - After startup, `<html>` has `--glass-rgb` and `data-sky-live`.
    - Calling `onLost()` → canvas removed, inline `--glass-*` removed, `data-sky-live` removed, `destroy` called.
  - **Day change:** `setTarget` called with `skyUniforms(tomorrow)` after rerender with `progress.set(1)`.
- [ ] **Step 2: FAIL → Step 3: implement, remove old code → Step 4: PASS**
- [ ] **Step 5: e2e** in `app.spec.ts`:
  - after the result, `locator('canvas.sky-canvas')` gets `data-ready`;
  - `page.on('console')` sees no `warn`/`error` from the sky;
  - with `emulateMedia({ reducedMotion: 'reduce' })`, canvas also has `data-ready` (one frame).
- [ ] **Step 6:** `npm test && npm run lint && npm run check && npm run test:e2e && npm run build && npm run check:bundle` — PASS. Record the lazy `SkyCanvas` chunk size from `check:bundle` output (expected 5–7 KB gzip).
- [ ] **Step 7: Manual review** with `npm run dev` at 390×844 and 1280×800 using the Lisbon (clear) and `new-york.json` fixtures. Compare with `docs/samples/ios1.jpeg`, `ios4.jpeg`. Tune shader constants without changing interfaces.
- [ ] **Step 8: Commit** — `feat: render the live sky with WebGL, drop the CSS particle sky`

---

## Phase 5. Articles and 404

### Task 22: Articles, UV scale, 404

**Files:**
- Modify: `src/components/ArticleLayout.astro`, `src/components/UvScaleTable.astro`, `src/pages/404.astro`, `src/styles/global.css` (`.article-prose a` → white with `white/60` underline; CSS sun glow `html::after` for pages without the app: `radial-gradient(circle at 70% 8%, rgb(255 236 180 / 0.35), transparent 40%)`, hidden with `data-sky-live`)
- Test: `src/test/content.test.ts` (update if it depends on classes), e2e a11y

**Interfaces:** none new.

- [ ] **Step 1: Article.**
  - `<article>` — `.glass rounded-[22px]`.
  - TL;DR: inner `bg-white/8 rounded-xl` panel without `border`.
  - “Find your best time to go outside” button: white pill with dark text (`bg-white text-black/85 rounded-full`).
  - Links: white, underlined.
- [ ] **Step 2: `UvScaleTable`** — 44px rows with `white/15` dividers, a colored UV-category dot and label (not color alone).
- [ ] **Step 3: 404** — the same glass card and pill button.
- [ ] **Step 4:** `npm test && npm run test:e2e && npm run build && npm run check:bundle` — PASS; article JS ≤ 2 000 B.
- [ ] **Step 5: Commit** — `feat: restyle articles and 404 on the static sky`

---

## Phase 6. Documentation and final verification

### Task 23: README, OG images, final run

**Files:**
- Modify: `README.md`, `scripts/make-og.mjs`, `public/og/*.png`

**Interfaces:** none.

- [ ] **Step 1: `scripts/make-og.mjs`.** Template using the new palette: `SKY_PALETTE.day` daytime gradient, glass card, white text. Read colors from `src/styles/global.css` (`--sky-day` variables, verdict colors), as currently done. Run `node scripts/make-og.mjs`, visually inspect all 4 PNGs.
- [ ] **Step 2: README.**
  - Stack table: “Animation” row with the WebGL sky.
  - Rewrite “Motion decisions” for the new implementation (8 items):
    1. `LazyMotion`;
    2. hero collapse;
    3. card tucking and the `CARD_TUCK_CLIP` flag;
    4. `NumericRoll`;
    5. initial choreography with `labelVisibleAt()` and `totalDuration()` values from `choreography.ts`;
    6. WebGL sky (chunk size, adaptive quality, fallback);
    7. sheets and pager;
    8. reduced motion.
  - Remove references to themes, `ThemeToggle`, view transition, search outline, `useCountUp`.
  - JS table: new figures from `npm run check:bundle`.
  - Lighthouse: rerun `npx lhci autorun` and update the table.
  - In “Frame rate”, keep “pending, author measurement” and add an item about the `CARD_TUCK_CLIP` decision.
  - Screenshot/GIF remains the author's TODO.
- [ ] **Step 3: Final run:** `npm run lint && npm run check && npm test && npm run test:e2e && npm run build && npm run check:bundle && npx lhci autorun` — all PASS; Lighthouse Accessibility 100 on all pages.
- [ ] **Step 4: Commit** — `docs: describe the iOS-style redesign, regenerate OG images`
