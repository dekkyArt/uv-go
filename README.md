# UV GO

Find the best time to go outside today, and what to take with you.

UV GO answers one question: which hour of your free time is the best one to be outside? You pick a place, the hours you are free, how long you want to stay out and what you plan to do. It reads the hourly forecast from Open-Meteo, scores every hour by plain rules (UV, rain, feels-like temperature, wind), and shows one answer: the best window, a green / yellow / red verdict, a one-line reason and a short list of things to take.

It is also a portfolio case for React and Motion (Framer Motion) work: the animation is there to help you read the answer, not to hide it.

- **Live:** https://uv-go.vercel.app (will be live after the first deploy)
- **Screenshot/GIF:** TODO
- **Repository:** https://github.com/dekkyArt/uv-go

The site is fully static. There is no backend, no cookies, no analytics and no third-party scripts. Coordinates go only to Open-Meteo. Your place and inputs are kept in your browser's localStorage and nowhere else.

## Stack

| Area         | Choice                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Site         | Astro (`output: 'static'`), MDX content collections, `@astrojs/sitemap`, JSON-LD written by hand                    |
| App          | React 19 as a single Astro island (`@astrojs/react`)                                                                |
| Animation    | Motion (Framer Motion): the `motion` package, imported from `motion/react`, through `LazyMotion` and `m` components |
| Styles       | Tailwind CSS v4 with CSS-variable tokens                                                                            |
| Language     | TypeScript, strict                                                                                                  |
| Tests        | Vitest, React Testing Library, Playwright, axe                                                                      |
| Quality      | ESLint, Prettier, `astro check`, Lighthouse CI                                                                      |
| Data         | Open-Meteo Forecast and Geocoding APIs (no key)                                                                     |
| CI / hosting | GitHub Actions, Vercel (static build)                                                                               |

Weather data by [Open-Meteo.com](https://open-meteo.com/).

## Getting started

Requires Node 22 (see `.nvmrc`) and npm.

```bash
npm i
npm run dev
```

| Script                 | What it does                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev`          | Astro dev server                                                                          |
| `npm run build`        | Static build into `dist/`                                                                 |
| `npm run preview`      | Serve the built site locally                                                              |
| `npm test`             | Vitest unit and component tests                                                           |
| `npm run test:e2e`     | Playwright smoke and accessibility checks (API mocked, 390x844 viewport)                  |
| `npm run check`        | `astro check` (types)                                                                     |
| `npm run lint`         | ESLint                                                                                    |
| `npm run format`       | Prettier, writes files                                                                    |
| `npm run check:bundle` | Gzip size of the JavaScript each built page loads, against the budget (run after `build`) |

CI (`.github/workflows/ci.yml`) runs lint, type check, unit tests, e2e, build, the bundle budget and Lighthouse CI on every push and pull request.

## Architecture

The code is split into four layers. Each one only looks down the list.

| Layer  | Where                                                       | What it holds                                                                                                                                                              |
| ------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain | `src/domain/`                                               | Pure TypeScript: scoring rules, windows, reason text, checklist, sky state. No React, no DOM, no imports from `data/` or `app/`. All thresholds live in `rules.config.ts`. |
| data   | `src/data/`                                                 | Open-Meteo forecast and geocoding clients, local time helpers, localStorage wrapper (every access in `try/catch`).                                                         |
| app    | `src/app/`, `src/motion/`                                   | The React island: one `useReducer`, hooks, components, SVG icons, motion tokens and choreography.                                                                          |
| site   | `src/pages/`, `src/components/`, `src/content/`, `src/seo/` | Astro pages and components, MDX articles, FAQ, theme toggle, SEO head and JSON-LD.                                                                                         |

All time is handled in the location's time zone, and `now` is passed into the domain as a parameter, so the scoring is deterministic and easy to test.

Data flow inside the island:

```
LocationPicker -> location -> useForecast(location) -> DayForecast[2]
                                                       |
Inputs ------------------------------------------------+- evaluate(days[dayIdx], inputs, now)   (useMemo)
                                                       |        |
                                                       |        v
                                                       |  EvaluationResult -> ResultCard, MiniResult,
                                                       |                      DayArcTimeline, WhatToTake
                                                       +- skyState(refHour, day) -> SkyLayer
```

Island state is a single `useReducer`: `location`, `inputs`, `forecast` (`idle | loading | success | error`), `selectedHour`, `autoSwitchDisabled`. There are no global stores.

## Changing the rules

Every number and phrase the scoring uses is in `src/domain/rules.config.ts`: UV bands and points, the Long in the sun multiplier, rain bands, heat / cold / wind thresholds, verdict bands, window lengths, reason priority and templates, checklist thresholds and labels. The scoring code has no thresholds of its own.

To change a rule, edit the value in `rules.config.ts` and run `npm test`. The "How it works" section on the home page renders its rule tables from the same config (`src/components/HowItWorks.astro`), so the page follows the rules without a second edit. The boundary tests in `src/domain/__tests__/` will tell you which edge cases moved.

Prose in the articles and FAQ that quotes a rule is written by hand. After changing a rule, check those texts.

## Motion decisions

The rule behind all of them: motion helps you understand the answer. The best time is readable at 0.95 s after the data arrives, and the whole first choreography finishes at about 1.5 s (1.34 s from the choreography constants plus the 0.15 s loading-card exit). The 0.95 s and 1.34 s come from `src/motion/choreography.ts` (`labelVisibleAt()` and `totalDuration()`); the 0.15 s comes from the loading card leaving before the result card mounts. They are computed from timing constants, not measured on a device. The spec limits are 1.0 s and 1.8 s.

1. **`LazyMotion` with `m` components and a lazy `domMax`.** `MotionProvider` loads the feature set with a dynamic import, and `strict` mode makes any full `motion.*` component throw. The app shell is on the page first; layout and drag code arrive after. `domMax` is needed for layout animation and drag.
2. **One `layoutId` hand-off for the time label.** On the first result the time label rides in the search frame on the timeline and then flows into the ResultCard header (`best-window-label`). The eye follows one object from "where" to "answer". The segmented controls (`SegmentedControl`) use the same mechanism for their sliding indicator.
3. **The search frame.** A frame slides over the free time on a spring and snaps onto the best window with a small overshoot. It shows what the app is choosing from before it shows the choice. It exists only on the first result, never with reduced motion.
4. **A hand-written rAF counter for UV.** `useCountUp` counts the UV value up with a small `requestAnimationFrame` tween. Motion's `animate()` would add several KB to the bundle for one number.
5. **The sky moves only `transform` and `opacity`.** `SkyLayer` stacks six CSS phase gradients (night, dawn, morning, day, golden, dusk) and cross-fades them by opacity. The sun travels on a transform. Particles (rain, snow, wind lines) are capped at 40 on mobile and 80 on desktop. Before React loads, a tiny inline script sets the phase from the device time, so the page does not flash.
6. **Reduced motion is a real mode.** `MotionConfig reducedMotion="user"` plus `useReducedMotion` for custom logic. With `prefers-reduced-motion: reduce` the arc draw, stagger, search frame, drag inertia, sky particles and the theme view transition are off, counters show the final value, and what is left is cross-fades of 150 ms or less. Nothing is lost functionally.
7. **Scroll reveal on content pages is CSS only.** Articles and home sections use `animation-timeline: view()` under `@supports`; without support the content is just there. Articles ship no animation JavaScript (about 1 KB of inline theme and sky scripts in total).
8. **Timeline drag on touch screens.** The hour strip uses `drag="x"` with inertia and snapping to the hour on touch devices, and plain click, hover and arrow keys on desktop. The theme toggle morphs sun and moon in SVG and reveals the new theme with the View Transitions API where it is supported.

## Performance and accessibility

The numbers below come from Lighthouse CI runs and a Chrome DevTools-protocol CLS measurement on the built site. Nothing here is a claim about a real phone yet.

**Lighthouse** (mobile, simulated throttling, 3 runs per page, `lhci autorun`):

| Page               | Performance | Accessibility | Best Practices | SEO | LCP             | CLS | TBT |
| ------------------ | ----------- | ------------- | -------------- | --- | --------------- | --- | --- |
| `/`                | 99, 99, 100 | 100           | 100            | 100 | 1204 to 1959 ms | 0   | 0   |
| `/uv-index/`       | 100         | 100           | 100            | 100 | about 1205 ms   | 0   | 0   |
| `/uv-risks/`       | 100         | 100           | 100            | 100 | about 1205 ms   | 0   | 0   |
| `/sun-protection/` | 100         | 100           | 100            | 100 | about 1204 ms   | 0   | 0   |

Caveat: Lighthouse CI serves the built `dist/` offline, so on `/` the app runs without a real forecast response (it shows the empty or error state). This is not a measurement of the answer rendering.

**JavaScript, gzip** (`npm run check:bundle`):

| Page               | Initial JS | Budget   | Lazy chunks | Initial + lazy |
| ------------------ | ---------- | -------- | ----------- | -------------- |
| `/`                | 118.6 KB   | 130.0 KB | 21.3 KB     | 139.8 KB       |
| `/uv-index/`       | 1.0 KB     | 2.0 KB   | 0.0 KB      | 1.0 KB         |
| `/uv-risks/`       | 1.0 KB     | 2.0 KB   | 0.0 KB      | 1.0 KB         |
| `/sun-protection/` | 1.0 KB     | 2.0 KB   | 0.0 KB      | 1.0 KB         |

The budget applies to the JavaScript loaded up front. The lazy chunks (Motion's `domMax` features and the sky layer) load after it and are listed separately, not budgeted. Initial + lazy on `/` is 139.8 KB, over 130 KB if you count both; the gate counts the initial JavaScript only, and the total is stated here so nothing is hidden.

**Layout shift under load** (Chrome DevTools protocol on the built preview, CPU throttled 4x, network 150 ms and 200 kB/s, cache off): CLS 0.0028 at 390 px with a stored place, 0.0007 at 1024 px with a stored place, 0 on a first visit at both widths.

**Frame rate:**

- Chrome DevTools Performance, CPU throttling 4x: pending, author measurement.
- Real mid-range Android device: pending, author measurement (device model and result to be added here).

**Accessibility.** Checked automatically: axe (Playwright, `e2e/a11y.spec.ts`) finds 0 serious or critical violations on every page in both themes. Checked in tests and code: city search is an ARIA combobox, free-time handles are `role="slider"`, and the result is announced through `aria-live="polite"`. Design rules the code follows (not separately audited): touch targets of at least 44x44 px, verdicts never rely on colour alone, decorative sky layers are `aria-hidden`, and everything is reachable from the keyboard.

## Lottie assets

Lottie is used only where it passes the fit check in the design spec (section 10.9). The code versions are the implementation. Motion is built in SVG and Motion (Framer Motion) first.

Fit check status: no Lottie asset has been produced yet, so none is adopted. The three candidates are recorded below.

- **1. LoadingSun** (`src/app/components/LoadingSun.tsx`): not adopted.
  - Blocked by: conditions 2 (≤ 30 KB) and 4 (palette and both themes) cannot be verified without an asset. Condition 1 is doubtful: a sun rising over the horizon and rocking is primitive motion (a circle moved and rotated), which code handles cheaply.
  - Source: none yet. To be generated by the author with an AI tool or adapted from LottieFiles.
- **2. Rain drops in the sky** (`src/app/components/SkyLayer.tsx`): not adopted.
  - Blocked by: conditions 2 and 4 cannot be verified without an asset. Condition 1 is doubtful: falling drops are repeated primitives moved with transforms, which code handles cheaply.
  - Source: none yet. To be generated by the author with an AI tool or adapted from LottieFiles.
- **3. Verdict icon** (`src/app/icons/VerdictIcon.tsx`): not adopted.
  - Blocked by: conditions 2 and 4 cannot be verified without an asset. Condition 1 is the most open of the three: a richer illustrated icon could justify Lottie, but the current SVG morph already covers the verdict change.
  - Source: none yet. To be generated by the author with an AI tool or adapted from LottieFiles.

The code version of each candidate stays as the implementation. It is also the fallback for reduced motion and for the time before a Lottie file loads.

### How to adopt later

- Install the player with `npm i @lottiefiles/dotlottie-react` and use dotLottie files in `public/lottie/`.
- Load the player with `React.lazy` after the first result, so it stays off the first-screen critical path.
- Keep the code version as the fallback: show it before load and under `prefers-reduced-motion`.
- Check the bundle budget (JS on `/` ≤ 130 KB gzip) and the `.lottie` size (≤ 30 KB) before merging.
- Record the origin of each asset in this section.

## AI usage note

I want this to be plain about what was made with AI and what was checked.

- **Code.** Implemented by Claude Code (an AI coding agent from Anthropic) from my spec and plan, in small tasks. Each task was gated by unit and component tests, type check, lint, e2e and axe checks, plus an AI code-review pass. I have not yet done my own line-by-line review of the code.
- **Article and FAQ drafts.** Drafts of the three articles (`src/content/articles/`) and the FAQ were written with AI from a short list of allowed sources: WHO, Cancer Council Australia, Skin Cancer Foundation, American Academy of Dermatology, NHS and US EPA. Each article lists its sources. Status: verification of every claim against its source by the author is to be done before release. Until then, treat the health content as unverified draft text.
- **Lottie.** No Lottie asset has been made or used yet. See the section below. If I add one, its origin will be recorded there.
- **What AI does not do at runtime.** The scoring is a fixed set of rules in `rules.config.ts`. There is no model, no prompt and no AI service in the running site.
- **What I have not done yet.** Device FPS measurement and the screenshot/GIF above are still to do.

UV GO gives general guidance, not medical advice. Talk to a healthcare professional about your skin.

## License

MIT, copyright 2026 Artem Bakulin. See [LICENSE](LICENSE).
