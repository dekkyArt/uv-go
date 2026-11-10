# UV GO — Technical Specification

**Status:** awaiting author review
**Date:** 2026-10-27
**Sources:** `IDEA.md` (product specification), `.agents/product-marketing.md` v4 (positioning, audience, voice)

---

## 1. Goal and context

UV GO is the author's own project, with two layers:

1. **Product.** A website with a web app answering one question: *when within my available time is it best to go outside, and what should I take*. Functionality strictly follows `IDEA.md`.
2. **Portfolio case study (primary goal).** A flagship motion case study for freelance marketplaces: demonstrate that the author builds beautiful, richly animated websites that are also fast, functional, and accessible.

**Core motion rule:** animation helps users understand the answer and does not hide it. If animation prevents users from seeing “when to go outside” within a couple of seconds, that is a bug.

The author is a programmer, not a motion designer. Animations are primarily code-based (SVG + Motion). Use Lottie only where it truly fits (see 10.9). Custom Lottie assets are made using AI tools.

## 2. Scope

**In scope for v1:**
- UV GO app (an island on the homepage): location, inputs, scoring, verdict card, day timeline, checklist;
- “live sky”: a background driven by time of day and weather;
- light and dark themes;
- content pages: `/uv-index`, `/uv-risks`, `/sun-protection`;
- “How it works” and FAQ sections on the homepage;
- technical SEO;
- README with AI usage note, live link, public repository.

**Out of scope:**
- login, backend, database, payments, notifications, native apps (from `IDEA.md`);
- runtime server, API routes, on-demand SSR (the site is fully static);
- i18n / Russian version (route structure must allow adding `/ru/` later);
- analytics;
- multi-day forecasts (Today / Tomorrow only);
- marketplace case-study assets (cover, video, GIF, EN/RU copy): a separate task after release.

## 3. Stack and platform

| Area | Decision |
|---|---|
| Site framework | Astro, latest stable major version at project start, `output: 'static'` |
| App | React 19 as a single Astro island (`@astrojs/react`) |
| Animation | Motion (`motion` package, imports from `motion/react`; formerly Framer Motion), via `LazyMotion` + `m` components |
| Lottie | `@lottiefiles/dotlottie-react`, only if Lottie passes the suitability check (10.9), lazy-loaded |
| Styles | Tailwind CSS v4 (`@tailwindcss/vite`), CSS-variable tokens |
| Content | `@astrojs/mdx`, content collections |
| SEO | `@astrojs/sitemap`, hand-written JSON-LD |
| Language | TypeScript strict |
| Tests | Vitest, React Testing Library, Playwright |
| Quality | ESLint, Prettier, `astro check` |
| CI / hosting | GitHub Actions; Vercel (static build, preview deployments) |
| Data | Open-Meteo Forecast API and Geocoding API (no key) |

Pin dependency versions in `package.json` and the lockfile.

In the README and case study, call the library “Motion (Framer Motion)” so it can be found under either search term.

## 4. Site map

| URL | Content | JS |
|---|---|---|
| `/` | Hero (H1), app island, How it works, FAQ | app island + inline theme script |
| `/uv-index` | Article: what the UV index is | inline theme and sky scripts only |
| `/uv-risks` | Article: UV risks | same |
| `/sun-protection` | Article: how to protect yourself | same |
| `/404` | “Not found” page linking to the homepage | same |

**Header (all pages):** UV GO logo (link to `/`), “UV Index”, “Risks”, “Protection” links, theme toggle.

**Footer (all pages):**
- “Weather data by Open-Meteo.com” with a link (required attribution under CC BY 4.0);
- link to the GitHub repository;
- “Designed & built by {author.name}” linking to `author.url` (configured in `src/site.config.ts`, defaults to the author's GitHub profile);
- disclaimer “UV GO gives general guidance, not medical advice.”

**Homepage hero** takes no more than ~30% of the mobile screen height so the app is above the fold. H1 (draft): “Know the best time to go outside”. The hero is the LCP element, and it is text, not an image.

## 5. App: functional requirements

All interface strings are in English. Below, FR means requirement and AC means acceptance criterion.

### FR-1. Location

- The geolocation prompt **does not appear** automatically on the first visit. Show a “Use my location” button and city search field.
- “Use my location” → `navigator.geolocation.getCurrentPosition` (10 s timeout). Display place name: “Your location” (no reverse geocoding).
- Search: Open-Meteo Geocoding, 300 ms debounce, query from 2 characters, up to 5 results formatted “Name, Admin1, Country”. Keyboard operation (arrows, Enter, Esc), ARIA combobox pattern.
- Save the selected location in localStorage. Load the forecast immediately on repeat visits.
- Compact view after selection: “📍 Lisbon, Portugal · Change”.

**AC:**
- no geolocation request without a button click;
- geolocation denial or error → “Can't get your location. Search a city instead.” message, focus moves to the search field;
- search with no results → “No cities found”;
- restore the last location after page reload.

### FR-2. Inputs

| Field | Values | Default | Persisted |
|---|---|---|---|
| Day | Today / Tomorrow | Today | no |
| Free time | start 00–23, end 01–24, 1-hour increments, end > start | 13:00–19:00 | yes |
| Duration | 30 min / 1 h / 2 h / 3 h | 1 h | yes |
| Activity | Active / Relaxed / Long in the sun | Relaxed | yes |

- No “Calculate” button: recalculate the result immediately on any change.
- Input changes make no new network requests; recalculation is local only.
- Free time is a 24-hour track with two draggable handles (see 10.5). Handles cannot cross; the minimum window is 1 hour.
- **Automatic switch to Tomorrow.** If loading a forecast (selecting a location or opening the app) finds no Today window because of `past` (see 6.4), automatically switch to Tomorrow and show “Your free time today has passed — showing tomorrow”. If the user then manually selects Today, disable the automatic switch for the rest of the session and show the `past` empty state.

**AC:**
- any input change updates the result without network requests;
- free-time end cannot be before or equal to the start;
- at 20:00 with free time 13:00–19:00, the app opens on Tomorrow with the notice;
- after manually returning to Today, show “No time left today” without another automatic switch.

### FR-3. Verdict card (ResultCard)

Contains:
- best window: “17:00–18:00”; for 30 min, “17:00–17:30”;
- verdict: **Good** (green) / **OK with protection** (yellow) / **Not recommended** (red), conveyed by text, color, and icon;
- a one-line reason (see 6.5);
- expandable “Why this time?” block: average window score (1 decimal place) and a breakdown of points by factor;
- “What to take” checklist (FR-5).

**AC:**
- the verdict is understandable without color (text and icon are present);
- the best time is readable no later than 1.0 s after data arrives (10.1);
- if there is no window, show an empty state instead of the card (FR-6).

### FR-4. Day timeline (DayArcTimeline)

- Sun arc from sunrise to sunset, with a strip of the selected day's 24 hours beneath it.
- Each hour uses its verdict color (hourly points → rounding → ranges in 6.3). Dark hours appear as “night” (neutral night color). Past hours (Today) are muted but retain their color.
- Highlight free time on the strip and outline the best window.
- **Hour selection:** tap, click, keyboard arrows, or dragging the strip (on mobile) opens HourDetails: UV, rain %, feels like, wind, and points by factor. The sun moves to the selected hour's position on the arc.
- Closing HourDetails (close icon, Esc, tap outside the block) returns the sky focus to the best window (9.3).

**AC:**
- 24 hours in colors matching the domain calculation;
- keyboard-accessible strip: `role="slider"` (0–23), arrows change the hour, `aria-valuetext` such as “15:00, UV 4, OK with protection”;
- HourDetails shows “no data” for missing values.

### FR-5. What to take

Items in fixed order: Sunscreen, Hat & sunglasses, Rain jacket, Water, Warm layer. Rules in 6.6. If there are no items: “Nothing extra needed.”

**AC:** the item set matches the rules in 6.6 for the result window.

### FR-6. States

| State | When | Text (draft) |
|---|---|---|
| `no-location` | no location selected | “Where are you heading out?” + LocationPicker; gray timeline arc |
| `loading` | forecast loading | “sun peeking out” animation (10.2), skeleton card of the same size |
| `result` | best window found | ResultCard + timeline |
| `empty: too-short` | free time shorter than duration | “Your free time is shorter than {duration}. Extend it or pick a shorter outing.” |
| `empty: dark` | no entirely daylight window of the required length within free time | “It's dark during your free time. Try earlier hours.” |
| `empty: past` | (Today) all suitable windows have passed | “No time left today.” + “Show tomorrow” button |
| `error` | network or API error | “Couldn't load the forecast.” + “Try again” |

**AC:**
- state transitions do not shift layout (CLS ≤ 0.05);
- every empty state gives a clear next step.

### FR-7. Layout

- **Mobile (< 1024px)**, one column: Location → ResultCard → Timeline → Inputs (“Adjust your plan”).
- **Sticky mini-result:** when ResultCard leaves the viewport, show a compact “17:00–18:00 · Good” bar at the top (via `AnimatePresence`). Tapping it scrolls to the card. This keeps the answer visible when changing inputs near the bottom of the screen.
- **Desktop (≥ 1024px)**, two columns:
  - full-width Location at the top;
  - ResultCard and Inputs on the left;
  - large timeline and HourDetails on the right.
- Hover states only on devices with `hover: hover`.

## 6. Scoring rules

All numbers and thresholds live only in `src/domain/rules.config.ts`. No “magic numbers” in scoring code.

### 6.1. Hourly points (lower is better)

| Factor | Rule |
|---|---|
| UV | Round `uv` to an integer (half up), then 0–2 → 0; 3–5 → 2; 6–7 → 4; 8+ → 6. For **Long in the sun**, UV points × 1.5 (0 / 3 / 6 / 9) |
| Rain | `precipitation_probability` 30–59% → +2; 60%+ → +5 |
| Heat | `apparent_temperature` ≥ 30°C → +3 (+5 for **Active**) |
| Cold | `apparent_temperature` < 0°C → +2 |
| Wind | `wind_speed_10m` ≥ 40 km/h → +3 |

- Hourly score is the sum of factor points.
- An hour with `is_day = 0` is dark and excluded from windows. If `is_day = null`, the hour is also treated as dark.
- If a factor value is `null`, it contributes 0 points and is marked `noData` (“no data” in HourDetails).
- UV rounding: `Math.round` (5.45 → 5; 5.5 → 6). Use the rounded value for points, display, and checklist alike.

### 6.2. Candidate windows

- Window length in hours: 30 min → 1; 1 h → 1; 2 h → 2; 3 h → 3.
- A window consists of consecutive whole hours `[start, start + n)`, where `freeTime.start ≤ start` and `start + n ≤ freeTime.end` (free-time end is excluded: for 13:00–19:00, candidate hours are 13…18).
- All hours in the window are daylight hours.
- For Today, the window starts no earlier than `nowLocal` rounded up to the next whole hour (14:10 → 15:00; 14:00 → 14:00).

### 6.3. Window score and verdict

- Window score is the arithmetic mean of the window's hourly scores.
- For the verdict, round the score to an integer (half up): 0–2 → **green / Good**; 3–5 → **yellow / OK with protection**; 6+ → **red / Not recommended**. Apply the same ranges to individual hourly scores for timeline colors.
- Show the precise value in “Why this time?” to 1 decimal place.

### 6.4. Best-window selection and empty-result reason

Select the best window using these criteria in order:
1. lowest window score;
2. if tied, lowest maximum hourly score within the window;
3. if still tied, earliest start.

Determine an empty result through sequential filtering:
1. `W0`: all windows from 6.2, ignoring darkness and “now”. Empty → `too-short`.
2. `W1`: windows from `W0` in which all hours are daylight. Empty → `dark`.
3. `W2`: windows from `W1` accounting for “now” (Today only). Empty → `past`.

### 6.5. Reason

- For each factor (uv, rain, heat, cold, wind), sum its points across the window's hours.
- The leading factor has the highest sum. Break ties using the configured priority: uv > rain > heat > wind > cold.
- If the second-largest factor has a sum > 0, append it with “ · ”.
- Templates (in the config):

| Factor | Template | Value |
|---|---|---|
| uv (3–5) | `UV {uv}, use sunscreen` | maximum rounded UV in the window |
| uv (6–7) | `UV {uv}, sunscreen and a hat` | same |
| uv (8+) | `UV {uv}, limit time in the sun` | same |
| rain | `{rain}% chance of rain` | maximum |
| heat | `Feels like {t}°C` | maximum, rounded to an integer |
| cold | `Feels like {t}°C` | minimum, rounded to an integer |
| wind | `Wind up to {w} km/h` | maximum, rounded to an integer |
| no points | `Low UV, low chance of rain` | — |

- Prohibited words in templates: “safe”, “perfect”.

### 6.6. Checklist

Calculated from the result window's hours:

| Item | Condition |
|---|---|
| Sunscreen | max rounded UV ≥ 3 |
| Hat & sunglasses | max rounded UV ≥ 6 |
| Rain jacket | max rain ≥ 30% |
| Water | activity = Active **or** max feels like ≥ 25°C |
| Warm layer | min feels like < 5°C |

Use feels like (`apparent_temperature`) for temperature, as in scoring. The brief says simply “°C” here; this decision is captured in the config.

### 6.7. Config shape (reference)

```ts
export const rules = {
  uv: { round: 'half-up', bands: [{ min: 0, points: 0 }, { min: 3, points: 2 }, { min: 6, points: 4 }, { min: 8, points: 6 }],
        multiplier: { 'long-sun': 1.5 } },
  rain: { bands: [{ min: 30, points: 2 }, { min: 60, points: 5 }] },
  heat: { min: 30, points: 3, pointsByActivity: { active: 5 } },
  cold: { below: 0, points: 2 },
  wind: { min: 40, points: 3 },
  verdict: { round: 'half-up', bands: [{ min: 0, verdict: 'green' }, { min: 3, verdict: 'yellow' }, { min: 6, verdict: 'red' }] },
  durationHours: { 30: 1, 60: 1, 120: 2, 180: 3 },
  reasonPriority: ['uv', 'rain', 'heat', 'wind', 'cold'],
  reasonTemplates: { /* 6.5 */ },
  checklist: { sunscreenUv: 3, hatUv: 6, rainJacket: 30, waterFeelsLike: 25, warmLayerBelow: 5 },
} as const;
```

The homepage “How it works” section imports this same config at build time and generates rule tables from it. Documentation cannot drift from the logic.

## 7. Data

### 7.1. Forecast

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &hourly=uv_index,precipitation_probability,apparent_temperature,wind_speed_10m,is_day,weather_code,cloud_cover
  &daily=sunrise,sunset
  &timezone=auto
  &forecast_days=2
```

Default units: °C, km/h. Use response fields `utc_offset_seconds`, `timezone`, `hourly.*`, `daily.*`.

Map to `DayForecast[2]`: indices 0–23 → Today, 24–47 → Tomorrow (in the location's time zone).

### 7.2. Geocoding

```
GET https://geocoding-api.open-meteo.com/v1/search?name={query}&count=5&language=en&format=json
```

Use `name`, `admin1`, `country`, `latitude`, `longitude` from `results[]`.

### 7.3. Time

- All times use the **location's** time zone, not the browser's.
- `nowLocal` = `Date.now() + utc_offset_seconds × 1000`, interpreted as UTC time to extract the date, hour, and minute. Calculated in `src/data/` and passed to `evaluate` as a parameter.
- Tests do not depend on the machine's time zone.

### 7.4. Caching and storage

- Cache the forecast in memory for the session using `lat,lon` (rounded to 2 decimal places) as the key. Selecting the same location again does not make a request.
- localStorage (every read and write wrapped in `try/catch`; if storage is unavailable, the application works without persistence):
  - `uvgo:location` — `{ name, admin1?, country?, lat, lon }`;
  - `uvgo:inputs` — `{ freeTime, duration, activity }`;
  - `uvgo:theme` — `'light' | 'dark'` (only on manual selection).
- Cancel network requests through `AbortController` when the location changes or the component unmounts.

## 8. Architecture

### 8.1. Structure

```
src/
  site.config.ts          author.name, author.url, site URL, repo URL
  domain/                 pure TypeScript, no React or DOM
    rules.config.ts
    types.ts
    scoring.ts            scoreHour
    windows.ts            buildWindows, pickBestWindow, emptyReason
    reason.ts             buildReason
    checklist.ts          buildChecklist
    sky.ts                skyState (9.3)
    evaluate.ts           evaluate — facade for the UI
  data/
    openMeteo.ts          fetchForecast → { days: DayForecast[2], utcOffsetSeconds, timezone }
    geocoding.ts          searchCities
    time.ts               nowLocal
    storage.ts            load/save with try/catch
  app/
    UvGoApp.tsx           island root, useReducer
    state.ts              reducer, actions
    hooks/                useForecast, useGeolocation, useCitySearch, useSelectedHour
    components/           LocationPicker, CitySearch, DayToggle, FreeTimePicker, DurationPicker,
                          ActivityPicker, DayArcTimeline, HourDetails, ResultCard, MiniResult,
                          WhatToTake, SkyLayer, EmptyState, ErrorState, LoadingSun
    icons/                SVG icons with code-based animations (checklist, verdict)
  motion/
    tokens.ts             springs, durations, easings
    variants.ts
    MotionProvider.tsx    LazyMotion + MotionConfig reducedMotion="user"
  components/             Astro: Header, Footer, ThemeToggle, Hero, HowItWorks, Faq, ArticleLayout, SeoHead
  content/articles/       uv-index.mdx, uv-risks.mdx, sun-protection.mdx
  pages/                  index.astro, [slug].astro, 404.astro
  styles/                 global.css (Tailwind, @theme, theme and sky tokens)
```

ThemeToggle is an Astro component with a vanilla script, not a React island: React must not load on article pages.

### 8.2. Key types

```ts
type Activity = 'active' | 'relaxed' | 'long-sun';
type DurationMin = 30 | 60 | 120 | 180;
type Verdict = 'green' | 'yellow' | 'red';
type Factor = 'uv' | 'rain' | 'heat' | 'cold' | 'wind';

interface HourData {
  time: string;            // 'YYYY-MM-DDTHH:00', local time at the location
  hour: number;            // 0–23
  uv: number | null;
  rainProb: number | null;
  feelsLike: number | null;
  windKmh: number | null;
  isDay: boolean;          // false if is_day = 0 or null
  weatherCode: number | null;
  cloudCover: number | null;
}

interface DayForecast { date: string; hours: HourData[]; sunrise: string; sunset: string; }

interface Inputs {
  day: 'today' | 'tomorrow';
  freeTime: { start: number; end: number };
  duration: DurationMin;
  activity: Activity;
}

interface ScoredHour extends HourData {
  points: Record<Factor, number>;
  noData: Factor[];
  score: number;
  verdict: Verdict | 'night';
  isPast: boolean;
  inFreeTime: boolean;
}

interface TimeWindow {
  startHour: number;
  hours: ScoredHour[];
  score: number;           // exact average
  verdict: Verdict;
  label: string;           // '17:00–18:00' | '17:00–17:30'
}

type EmptyReason = 'too-short' | 'dark' | 'past';

interface EvaluationResult {
  scoredHours: ScoredHour[];   // 24
  best: TimeWindow | null;
  emptyReason: EmptyReason | null;
  reason: string | null;
  checklist: ChecklistItem[];
}

function evaluate(day: DayForecast, inputs: Inputs, now: { hour: number; minute: number } | null,
                  config?: Rules): EvaluationResult;
```

`now = null` for Tomorrow.

### 8.3. Data flow

```
LocationPicker → location ─► useForecast(location) ─► DayForecast[2]
                                                      │
Inputs ──────────────────────────────────────────────►├─ evaluate(days[dayIdx], inputs, now)  (useMemo)
                                                      │        │
                                                      │        ▼
                                                      │  EvaluationResult → ResultCard, MiniResult,
                                                      │                     DayArcTimeline, WhatToTake
                                                      └─ skyState(refHour, day) → SkyLayer
```

Island state uses a single `useReducer`: `location`, `inputs`, `forecast` (`idle | loading | success | error`), `selectedHour`, `autoSwitchDisabled`. Global stores are unnecessary.

### 8.4. Errors

| Situation | Behavior |
|---|---|
| Network / HTTP ≠ 2xx / invalid JSON | `error` state; “Try again” repeats the request |
| Geocoding: network | “Search is unavailable. Try again.” below the search field |
| Geolocation: denied / timeout / unavailable | FR-1 message, focus the search field |
| Missing hourly values | Rules from 6.1 (`null` → 0 points, `noData`) |
| Fewer than 48 hours in the response | Missing day → `error` state |
| localStorage unavailable | Work without persistence, no errors in the user's console |

## 9. Visual system

### 9.1. Themes

- Light and dark. Default to the system setting (`prefers-color-scheme`). Manual selection through ThemeToggle persists in `uvgo:theme` and overrides the system setting.
- An inline script (`is:inline`) in `<head>` sets `data-theme` on `<html>` before the first paint, without flashing. Works on every page.
- All colors are CSS variables in `[data-theme="light"]` and `[data-theme="dark"]` sets. In Tailwind v4, bind the `dark:` variant to the attribute through `@custom-variant`.
- Choose verdict, timeline-hour, and nighttime-hour colors separately for each theme, with contrast ≥ AA (text 4.5:1, large elements and graphics 3:1). Check yellow on light backgrounds separately.

### 9.2. Theme and sky are independent layers

- The theme controls surfaces (cards, panels, header) and text.
- The sky controls only the background. The interface does not change colors during timeline scrubbing.
- Each sky phase has a variant for both themes: deeper and more muted in the dark theme.
- Content sits on surfaces with opaque or translucent backgrounds. Do not use `backdrop-filter` on mobile. Text contrast ≥ AA with every sky.

### 9.3. “Living sky” (SkyLayer)

`skyState(refHour, day)` is a pure function in `src/domain/sky.ts`. Returns `{ phase, weather, uvGlow, heat, wind, sunPosition }`:

- **phase** from the day's `sunrise` / `sunset`. Offsets (minutes) in `sky.config`:
  - `night` — before `sunrise − 45` or after `sunset + 45`;
  - `dawn` — `sunrise ± 45`;
  - `morning` — from `sunrise + 45` to `solarNoon − 120`, where `solarNoon` is the midpoint between `sunrise` and `sunset`;
  - `day` — from `solarNoon − 120` to `sunset − 90`;
  - `golden` — from `sunset − 90` to `sunset − 15`;
  - `dusk` — from `sunset − 15` to `sunset + 45`.
- **weather** from WMO `weather_code`:

| Group | Codes |
|---|---|
| `clear` | 0, 1 |
| `partly` | 2 |
| `overcast` | 3 |
| `fog` | 45, 48 |
| `rain` | 51–67, 80–82 |
| `snow` | 71–77, 85–86 |
| `thunder` | 95–99 |

  If `weather_code = null`, use `cloud_cover`: < 25 → clear, < 70 → partly, otherwise overcast.
- **uvGlow** 0…1 from rounded UV (0 → 0, 11+ → 1).
- **heat** — feels like ≥ 30°C. **wind** — ≥ 40 km/h.
- **sunPosition** 0…1 — fraction of the journey between sunrise and sunset. The same formula as for the sun on the timeline arc.

**Reference hour (refHour):**
- No location selected → current device time, `clear` weather;
- Result available → start of the best window;
- No result → current hour (Today) or 12:00 (Tomorrow);
- HourDetails open or user dragging the timeline → selected hour.

**Visual rules:**
- A prepared gradient layer for each phase. Phase changes crossfade two adjacent layers using `opacity`. Do not interpolate the gradient.
- Weather: overcast and fog use a veil layer that mutes the phase; rain uses drops; snow uses snowflakes; thunder uses occasional flashes (no more than once every 8 s, disabled with reduced motion).
- Sun glow is a radial layer whose `opacity` depends on `uvGlow`. At night, replace the sun with the moon.
- heat: subtle heat haze (texture shifted through `transform`, no SVG filters). wind: drifting lines.
- Particles move only through `transform`. Limit counts: mobile ≤ 40, desktop ≤ 80.
- Article pages: static sky phase based on device time (inline script sets `data-sky-phase`), without weather or JS animation.

## 10. Motion specification

### 10.1. Principles and budgets

- Animate only `transform` and `opacity`. Exception: the color of small elements (icons, verdict badge, hour cells).
- `LazyMotion` with `domMax` (needed for layout and drag), only `m` components.
- Tokens (`src/motion/tokens.ts`): springs `snappy` (fast controls), `gentle` (cards, frame), `bouncy` (snapping); durations 150 / 300 / 600 ms; one shared easing for tweens. Tune concrete values in stage 3 and store them in tokens.
- The best time is readable **≤ 1.0 s** after data arrives. The entire initial choreography takes **≤ 1.8 s**.
- No animation blocks input.

### 10.2. Loading

LoadingSun: the sun “peeks” above the horizon and sways. The skeleton card has the same dimensions as ResultCard. Lottie candidate #1 (10.9). Base implementation: SVG in code.

### 10.3. First result (after selecting a location or changing the day)

1. Draw the day arc: SVG `pathLength` 0 → 1.
2. Hour cells appear along the strip with stagger; colors fill in.
3. The “search” frame slides across free time on a spring and snaps onto the best window with slight overshoot.
4. The time label flows from the frame into the ResultCard heading through `layoutId`. The card expands: the verdict badge changes color, the UV counter counts up to its value, and checklist items appear one by one.
5. The sky crossfades to the reference hour.

Steps 2–4 partially overlap to meet the budget in 10.1.

### 10.4. Recalculation when input changes

No full choreography:
- The frame springs to the new best window;
- Hour colors morph;
- Card values crossfade or count to their new values;
- Checklist items enter and exit through `AnimatePresence`;
- Verdict changes morph the color and icon.

### 10.5. Input controls

- Day, Duration, Activity: segmented controls with a shared indicator (`layoutId`), `snappy` spring.
- Free time: a 24-hour track, two draggable handles with hour snapping. The free-time highlight on the timeline updates synchronously.
- Use `whileTap` on every press (scale ≈ 0.96). Hover only with `hover: hover`.

### 10.6. Timeline

- Mobile: hour strip with `drag="x"`, momentum, and hour snapping. Center the selected hour. The sun moves along the arc, and sky scrubbing follows (9.3).
- Desktop: entire strip visible, click and hover. Slight cell lift on hover.
- Keyboard: arrow keys move the selected hour with the same animation.

### 10.7. ResultCard, MiniResult, What to take

- “Why this time?” expands through a layout animation; neighboring elements move without jumps.
- Verdict icon (sun / cloud-sun / rain): SVG morphing in code. Lottie candidate #3.
- MiniResult slides in from above and back out through `AnimatePresence` when the card leaves or returns to the viewport (IntersectionObserver).
- Each checklist item has its own SVG microanimation on appearance: sunscreen tube compresses, hat lowers, glasses slide into place, rain jacket opens, a drop falls into the bottle, and warm-layer folds straighten.

### 10.8. Theme and site

- ThemeToggle: SVG sun ↔ moon morph. Theme changes through the View Transitions API with a circular reveal from the button. Without API support or with reduced motion, change instantly.
- Site pages: blocks reveal on scroll using pure CSS (`animation-timeline: view()` under `@supports`, otherwise no animation). Do not add JS to articles.

### 10.9. Lottie: fit check

Candidates: #1 LoadingSun, #2 raindrops in the sky, #3 verdict icon. Use Lottie only if **all** conditions are met:
1. Provides something impractical to implement in code (complex illustrative deformation, not movement of primitives);
2. `.lottie` ≤ 30 KB;
3. Loads lazily and stays outside the critical path for the initial viewport;
4. Matches the project palette and has variants for both themes (dotLottie theming or recoloring from code);
5. Has a static fallback (for reduced motion and before loading).

Otherwise, use the code implementation. Lottie sources: generation with AI tools or adapted free LottieFiles assets. Document the provenance of every asset in README.

### 10.10. Reduced motion

`MotionConfig reducedMotion="user"` + `useReducedMotion` hook for custom logic. With `prefers-reduced-motion: reduce`:
- Disable: arc drawing, stagger, “search” frame, drag momentum (snap without a throw), sky particles and flashes, theme View Transition;
- Sky: static reference-phase layer; phase changes crossfade ≤ 150 ms;
- Counters immediately show final values;
- Only crossfades ≤ 150 ms remain;
- Preserve all functionality.

## 11. Content and SEO

### 11.1. Pages

| URL | Title (draft) | Intents |
|---|---|---|
| `/` | Best Time to Go Outside Today — UV & Weather Planner | best time to go outside, uv index today, when is uv lowest |
| `/uv-index` | UV Index Explained: Scale, Colours and What Affects It | what is uv index, uv index scale |
| `/uv-risks` | UV Exposure Risks: Sunburn, Skin Ageing and Eyes | uv exposure risks, high uv index meaning |
| `/sun-protection` | How to Protect Yourself from UV | how to protect skin from sun, how often reapply sunscreen |

Description: 140–160 characters, unique to each page.

### 11.2. Articles

Length: 800–1500 words. Content collection schema: `title`, `description`, `publishedAt`, `updatedAt`, `sources: { title, url, publisher }[]`.

Structure of each article:
1. H1;
2. TL;DR block (3–4 points, immediate answer);
3. H2 sections;
4. Internal links to the other two articles;
5. CTA «Find your best time to go outside» → `/`;
6. «Sources»;
7. «Last updated {date}»;
8. Disclaimer.

Suggested H2 headings:
- **/uv-index:** What the UV index measures · The UV scale (0–11+ table with colors from the application palette) · Why UV peaks around midday · Season, latitude and altitude · Clouds, water, sand and snow · How UV GO uses the UV index.
- **/uv-risks:** Sunburn · Skin ageing · Skin cancer · Eye damage · Who is at higher risk (skin phototypes, children, high altitudes) · UV on cloudy days.
- **/sun-protection:** Timing your time outside · Sunscreen: SPF, amount, reapplying · Clothing and hats · Sunglasses · Shade · Putting it together: what to take (connection to the application checklist).

### 11.3. Content rules

- No “safe,” “perfect,” medical promises, or “AI-powered.”
- Every number and health claim must link to a source. Allowed sources: WHO, Cancer Council Australia, Skin Cancer Foundation, American Academy of Dermatology, NHS, US EPA.
- Disclaimer on articles and in FAQ: “UV GO gives general guidance, not medical advice. Talk to a healthcare professional about your skin.”
- Drafts are written with AI assistance; the author verifies every claim against its source. State this in the AI usage note.
- Follow the Brand Voice from `product-marketing.md`: direct, warm, transparent.

### 11.4. Homepage: How it works and FAQ

- **How it works:** 3 steps (location → your time → one answer) and rules tables generated from `rules.config.ts`. Explain verdicts and the checklist.
- **FAQ** (using `<details>`, 8–10 questions):
  - How does UV GO pick the best time?
  - What do the colours mean?
  - Why are dark hours left out?
  - Where does the weather data come from?
  - Do you store my location?
  - At what UV index should I use sunscreen?
  - Why "feels like" instead of air temperature?
  - Can I check another city?
  - Is this medical advice?

### 11.5. Technical SEO

- `SeoHead.astro`: title, description, canonical, Open Graph, Twitter Card. Each page has its own static 1200×630 OG image (`public/og/*.png`).
- JSON-LD:
  - `/` — `WebApplication` (applicationCategory `UtilitiesApplication`, offers price 0) and `FAQPage`;
  - Articles — `Article` (`headline`, `datePublished`, `dateModified`, `author`) and `BreadcrumbList`.
- `sitemap.xml` (`@astrojs/sitemap`), `robots.txt` linking to the sitemap.
- Semantic HTML, one H1 per page, `lang="en"`.
- Self-hosted woff2 fonts (no more than 2 styles): preload the primary font, `font-display: swap`.
- Search Console and Bing Webmaster verification meta tags: values set in `site.config.ts`; omit empty values.
- Site URL: one `site` value in `astro.config`. v1 uses `*.vercel.app`; move to a custom domain without code changes.

## 12. Nonfunctional requirements

### 12.1. Performance

| Metric | Threshold |
|---|---|
| Lighthouse mobile Performance | `/` ≥ 90; articles ≥ 95 |
| Lighthouse Accessibility | ≥ 95 on all pages |
| Lighthouse SEO | 100 |
| Lighthouse Best Practices | ≥ 95 |
| LCP / CLS / INP | ≤ 2.5 s / ≤ 0.05 / ≤ 200 ms |
| JS on `/` | ≤ 130 KB gzip total |
| JS on articles | ≤ 2 KB (inline theme and sky scripts) |
| Animations | 60 fps during timeline scrubbing and initial choreography; no long tasks > 50 ms during animations |

Verify FPS in Chrome DevTools (Performance, CPU throttling 4×) and on a real midrange Android device. Record results in README.

### 12.2. Accessibility

- All functionality is keyboard accessible; focus is always visible.
- CitySearch is an ARIA combobox. Free-time handles use `role="slider"` with `aria-valuetext="13:00"`. The timeline supports arrow-key control.
- Announce results through `aria-live="polite"`: “Best time 17:00–18:00, Good. UV 5, use sunscreen.”
- Never communicate verdict or hour color through color alone.
- Contrast ≥ AA in both themes at every sky phase.
- Touch targets ≥ 44×44 px.
- Reduced motion follows 10.10.
- Hide decorative layers (sky, particles) from screen readers (`aria-hidden`).

### 12.3. Browsers

Latest 2 versions of Chrome, Edge, Firefox, Safari; iOS Safari 16+; Android Chrome. Disable unsupported progressive enhancements (View Transitions, `animation-timeline`) without losing functionality.

### 12.4. Privacy

No cookies, analytics, or third-party scripts. Send coordinates only to Open-Meteo. Store user data only in the browser's localStorage.

## 13. Testing and CI

**Unit (Vitest), `src/domain`:**
- UV: boundaries 2/3, 5/6, 7/8; rounding 5.45 → 5, 5.5 → 6; Long in the sun multiplier.
- Rain: 29/30/59/60, `null`.
- Feels like: 29.9/30, Active +5; −0.1/0.
- Wind: 39/40.
- Dark hours and `is_day = null`.
- Windows: free-time boundaries (exclusive end), each duration, “now” at 14:00 and 14:10, Tomorrow without “now.”
- Empty reasons: `too-short` / `dark` / `past` and their evaluation order.
- Verdict: window score rounding (2.4 → green, 2.5 → yellow, 5.5 → red).
- Tie-break: both levels.
- Reason: leading factor, second factor, tie priority, zero points.
- Checklist: each item at its threshold.
- `skyState`: phase boundaries, WMO mapping, fallback to `cloud_cover`.

**Data:**
- Open-Meteo mapping against recorded JSON fixtures (`src/data/__fixtures__/`), including `null` and negative and positive `utc_offset_seconds`;
- `nowLocal` with different offsets.

**Components (Testing Library):**
- Search → select city → result shown;
- Every empty state;
- Auto-switch to Tomorrow and disabling it;
- Reduced motion (renders without errors, content present).

**E2E smoke (Playwright):**
- Viewport 390×844, mocked APIs;
- Happy path: search → result → change duration → new result;
- Geolocation denied;
- Theme selection persists after reload.

**CI (GitHub Actions, on push and PR):**
- `lint` → `astro check` → `vitest run` → `playwright test` → `astro build`;
- Vercel preview deployment on PRs, production deployment from `main`.

## 14. Deliverables

1. Live link (Vercel).
2. Public GitHub repository, MIT license.
3. README:
   - What it is and live link, screenshot or GIF;
   - Stack;
   - Installation and scripts (`npm i`, `npm run dev`, `test`, `build`);
   - Architecture (domain / data / app / site layers);
   - `rules.config.ts`: how to change rules;
   - Motion decisions (key animations and their purposes);
   - Performance and accessibility: Lighthouse and FPS measurements;
   - Provenance of Lottie assets (if any);
   - **AI usage note:** which AI tools were used and for what (code, Lottie, text drafts), and what the author verified.

## 15. Stages

Dates are set in the implementation plan.

| # | Stage | Result |
|---|---|---|
| 1 | Foundation | Astro + React + Tailwind + MDX scaffold, tokens, flash-free themes, Header/Footer, CI, Vercel deployment. Live URL works |
| 2 | Logic and data | `rules.config.ts`, domain with full test coverage, Open-Meteo clients, `nowLocal`, storage, minimal UI without motion and a working answer at the live URL (equivalent to Milestone 1 from the brief) |
| 3 | Application and motion | All FR-1…FR-7 components, 10.x choreography, “living sky,” reduced motion, Lottie candidate decisions |
| 4 | Content and SEO | 3 articles, How it works, FAQ, SeoHead, JSON-LD, OG images, sitemap, robots |
| 5 | Polish and evidence | Accessibility, budgets from 12.1, on-device FPS, E2E, README with measurements and AI usage note |

## 16. Decision log

| Decision | Alternatives | Rationale |
|---|---|---|
| Astro + React island (SSG) | Next.js SSG; Vite SPA; React Router prerender | SEO and content without JS on articles, Lighthouse ~100 for content; application is a single island |
| English only in v1 | EN + RU; EN application + RU articles | Largest search market, half as much content; `/ru/` can be added later |
| Core of 3 articles + FAQ | Hub of 8–12 articles; FAQ only | Covers UV, risk, and protection queries without turning content into a separate project |
| Today / Tomorrow with auto-switch | Today only; 3–7 days | Application remains useful in the evening; multiday forecasts serve an anti-persona |
| UV rounded to an integer before band selection | Half-open intervals | UV display standard (WHO); UI number matches the points |
| Window score rounded for the verdict | Strict intervals based on fractional values | No gaps between the brief's intervals (2.5, etc.) |
| Feels like for the checklist | `temperature_2m` | Consistent with scoring, without an extra parameter |
| Motion in code, Lottie only where appropriate | Lottie everywhere; no Lottie | Author is a programmer; code offers data-driven control, low weight, and a consistent style |
| Theme and sky are independent layers | Theme follows the sky | Predictable interface, no recoloring during scrubbing or city changes |
| Tap an hour for details | Colors only | Supports “transparent rules” |
| No analytics in v1 | Vercel Analytics, etc. | Privacy, zero third-party scripts |
