# UV GO

Find the best time to go outside today, and what to take with you.

UV GO answers one question: which hour of your free time is the best one to be outside? You pick a place, the hours you are free, how long you want to stay out and what you plan to do. It reads the hourly forecast from Open-Meteo, scores every hour by plain rules (UV, rain, feels-like temperature, wind), and shows one answer: the best window, a green / yellow / red verdict, a one-line reason and a short list of things to take.

It is also a portfolio case for React, Motion (Framer Motion) and WebGL work, styled after iOS Weather: a live sky behind dark glass cards, a hero that folds into a pinned bar as you scroll, and numbers that roll. The animation is there to help you read the answer, not to hide it. I am a programmer, not a motion designer: all of the motion is written in code (Motion springs, scroll-bound MotionValues and a GLSL shader), with no design-tool animation files.

- **Live:** [uv-go.dekky.dev](https://uv-go.dekky.dev/)
- **Social preview (OG image):** [public/og/home.png](public/og/home.png)
- **Repository:** https://github.com/dekkyArt/uv-go

The site is fully static with no backend. Coordinates go to Open-Meteo. Your place and inputs are kept in your browser's localStorage. Google Analytics is optional: it is disabled unless a GA4 measurement ID is supplied at build time, and loads only after the visitor accepts analytics cookies.

## Stack

| Area         | Choice                                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site         | Astro (`output: 'static'`), MDX content collections, `@astrojs/sitemap`, JSON-LD written by hand                                                                              |
| App          | React 19 as a single Astro island (`@astrojs/react`)                                                                                                                          |
| Animation    | Motion (Framer Motion): the `motion` package, imported from `motion/react`, through `LazyMotion` and `m` components. The sky is a WebGL fragment shader (GLSL), loaded lazily |
| Styles       | Tailwind CSS v4 with CSS-variable tokens                                                                                                                                      |
| Language     | TypeScript, strict                                                                                                                                                            |
| Tests        | Vitest, React Testing Library, Playwright, axe                                                                                                                                |
| Quality      | ESLint, Prettier, `astro check`, Lighthouse CI                                                                                                                                |
| Data         | Open-Meteo Forecast and Geocoding APIs (no key)                                                                                                                               |
| CI / hosting | GitHub Actions, Cloudflare Pages (static Direct Upload)                                                                                                                       |

Weather data by [Open-Meteo.com](https://open-meteo.com/).

## Getting started

Requires Node >=22.23.4 (`package.json`); `.nvmrc` selects the Node 22 line. Use npm with the committed lockfile.

```bash
npm ci
npm run dev
```

| Script                 | What it does                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run dev`          | Astro dev server                                                                                       |
| `npm run build`        | Static build into `dist/`                                                                              |
| `npm run preview`      | Serve the built site locally                                                                           |
| `npm test`             | Vitest unit and component tests                                                                        |
| `npm run test:e2e`     | Playwright functional, layout, motion and accessibility checks (mocked APIs; default 390x844 viewport) |
| `npm run check`        | `astro check` (types)                                                                                  |
| `npm run lint`         | ESLint                                                                                                 |
| `npm run format`       | Prettier, writes files                                                                                 |
| `npm run check:bundle` | Gzip size of the JavaScript each built page loads, against the budget (run after `build`)              |

CI (`.github/workflows/ci.yml`) runs lint, type check, unit tests, e2e, build, the bundle budget and Lighthouse CI on every push and pull request. After all checks pass, pushes to `main` deploy the verified `dist/` artifact to Cloudflare Pages.

See [Cloudflare Pages setup and deployment instructions](docs/cloudflare-pages.md) for project creation, GitHub secrets and variables, the production URL, and rollback.

## Optional Google Analytics

Set `PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in `.env` locally or in the build environment.
Use the GA4 web stream **Measurement ID**, not an account number or a `UA-` ID.
The ID is public. Missing, blank and invalid values disable analytics and its consent banner.
This is a static site: changing the value requires rebuilding and deploying.

Google loads only after explicit acceptance (basic consent mode); rejection sends no Google
analytics requests. Advertising consent stays denied. The English banner offers equally styled
accept/reject buttons and links to `/privacy/`. Visitors can reopen it through **Cookie settings**
in the footer and withdraw consent. Both choices expire after 180 days. Withdrawal disables GA,
removes accessible `_ga` / `_ga_*` cookies and reloads to stop the loaded tag. Changes synchronize
across tabs. No analytics events are added to the weather app.

Before production, review `/privacy/` for your actual operator identity, direct privacy contact,
processing and retention settings, and international transfer arrangements. A banner alone does
not establish GDPR/ePrivacy compliance in every EU jurisdiction. In the GA property, review and
accept the applicable data processing terms; set event data retention to the minimum needed
(e.g. 2 months), disable Google signals, advertising features and unnecessary data sharing.
Disable **Enhanced measurement** in the web stream so automatic events cannot capture additional
URLs or form data beyond this integration's page views. Recheck these settings when changing the
property. Do not add advertising or other purposes without updating disclosures and obtaining
new consent (bump the consent record version/key).

For the GitHub Actions deployment, set repository variable `PUBLIC_GA_MEASUREMENT_ID`.
Only the final production build receives this repository variable. Consent E2E uses a separate
test ID with intercepted Google requests; other E2E and Lighthouse keep analytics disabled.
An empty/unset variable leaves the deployed site without analytics. See
[Google consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
and [CNIL guidance](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications).

## Architecture

The code is organized into the following areas. The domain is independent of React and browser APIs; data and UI code reuse domain types and functions.

| Layer  | Where                                                       | What it holds                                                                                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain | `src/domain/`                                               | Pure TypeScript: scoring rules, windows, reason text, checklist, sky state, sky palette, glass tint and shader uniforms. No React, no DOM, no imports from `data/` or `app/`. Scoring rules live in `rules.config.ts`; sky settings also use `sky.config.ts` and `skyUniforms.config.ts`. |
| data   | `src/data/`                                                 | Open-Meteo forecast and geocoding clients, local time helpers, localStorage wrapper (every access in `try/catch`).                                                                                                                                                                        |
| app    | `src/app/`, `src/motion/`                                   | The React island: one `useReducer`, hooks, components, SVG icons, the WebGL sky, motion tokens and choreography.                                                                                                                                                                          |
| site   | `src/pages/`, `src/components/`, `src/content/`, `src/seo/` | Astro pages and components, MDX articles, FAQ, SEO head and JSON-LD.                                                                                                                                                                                                                      |

Forecast evaluation uses the location's time zone, and `now` is passed into the domain as a parameter, so the scoring is deterministic and easy to test.

Data flow inside the island:

```
Hero, CitiesSheet -> place -> useForecastLoader(place) -> forecast (Today, Tomorrow)
                                                          |
Inputs (Plan) --------------------------------------------+- evaluate(activeDay, inputs, now)   (useMemo)
                                                          |        |
                                                          |        v
                                                          |  EvaluationResult -> heroState -> Hero, CollapsedBar
                                                          |                   -> HourlyCard, FreeTimeCard, TakeChips / TakeStrip
                                                          +- useSkyPair -> skyUniforms(Today, Tomorrow) -> SkyCanvas
```

Island state is a single `useReducer`: `place`, `inputs`, `forecast` (`idle | loading | success | error`), `selectedHour`, the automatic switch to Tomorrow and a retry token. Local React state also controls sheets and lazy sky loading; MotionValues coordinate animation. A shared flag records a failed motion chunk (`src/motion/featuresFailed.ts`), so the page can render at rest. The forecast client has an in-memory cache, and `src/analytics/` manages optional consent separately.

## Changing the rules

Every number and phrase the scoring uses is in `src/domain/rules.config.ts`: UV bands and points, the Long in the sun multiplier, rain bands, heat / cold / wind thresholds, verdict bands, window lengths, reason priority and templates, checklist thresholds and labels. The scoring code has no thresholds of its own.

To change a rule, edit the value in `rules.config.ts` and run `npm test`. The "How it works" section on the home page renders its rule tables from the same config (`src/components/HowItWorks.astro`), so the page follows the rules without a second edit. The boundary tests in `src/domain/__tests__/` will tell you which edge cases moved.

Prose in the articles and FAQ that quotes a rule is written by hand. After changing a rule, check those texts.

## Motion decisions

The rule behind all of them: motion helps you understand the answer. By the choreography constants (`labelVisibleAt()` in `src/motion/choreography.ts`), the best time is readable 0.35 s after the data arrives, and the whole first choreography ends at 1.2 s (`totalDuration()`). These are computed from timing constants, not measured on a device. The spec limits are 1.0 s and 1.8 s.

1. **`LazyMotion strict` with `m` components and a lazy `domMax`.** `src/motion/MotionProvider.tsx` loads the feature set with a dynamic import (`./features`), and `strict` mode makes any full `motion.*` component throw. The app shell is on the page first; layout and drag code arrive after. If the chunk fails to load, the page renders at rest: no intro, and nothing is left at its hidden starting values. The springs live in `src/motion/tokens.ts`: `smooth` (0.5 s, no bounce) for most transitions, `snappy` (0.3 s, bounce 0.15) for presses and pills, `sheet` (0.45 s, bounce 0.08) for sheets and the day pager.
2. **The hero folds into a pinned bar.** `src/app/hero/useHeroCollapse.ts` turns the scroll position into MotionValues (time scale and rise, opacity of the details, eyebrow and bar) over 140 px of scroll, and `CollapsedBar.tsx` is the 56 px bar it ends in. There is no spring in between: the hero is a pure function of `scrollY`, so it follows the finger exactly and can be reversed at any point. Desktop shows no bar.
3. **Cards tuck under the bar.** `src/app/cards/useCardTuck.ts` binds a `clip-path` on each card body to the page scroll, so the body slides under the pinned bar while the sticky header stays. Rects are read in the scroll callback and written to a MotionValue, so scrolling re-renders nothing. The `CARD_TUCK_CLIP` flag in `src/app/ui.ts` turns the clip off if scrolling turns out too slow on a device (only the sticky headers are left); the current value is `true`.
4. **`NumericRoll`.** `src/app/components/NumericRoll.tsx` rolls only the characters that changed, up or down depending on the number, with a short blur and a 0.03 s lag between neighbours (capped at 6). Each character sits in a one-line clipped slot, so the line never changes height or width, and the text lives once in a screen-reader-only node. Nothing rolls on the first render.
5. **The first result is choreographed with numbers.** `src/motion/choreography.ts` holds every delay in one table: the hero time blurs, rises and fades in at 0.05 s, the cards rise in a stagger from 0.25 s, the best-window outline draws, the score bars grow with a capped stagger, and the What to take pills under the hero pop in. `labelVisibleAt()` is 0.35 s and `totalDuration()` is 1.2 s (the end of the last bar and pill).
6. **The sky is a WebGL shader.** `src/app/sky/shader.ts` (GLSL: gradient, sun, moon, stars, clouds, fog, rain, snow, drops on the glass, heat, lightning), `rendererCore.ts` (the shared draw loop), `renderer.worker.ts` (worker entry) and `SkyCanvas.tsx` (React wrapper), fed by uniforms from `src/domain/skyUniforms.ts`. The canvas is its own chunk, fetched only once the page is idle (`requestIdleCallback`, or 200 ms without it): the CSS sky stays visible until the first rendered frame is acknowledged. Where transferable `OffscreenCanvas` and Workers are available, context creation, compilation and every WebGL draw run in a worker; only uniforms, size and visibility cross the thread boundary. This keeps software GPU stalls off the UI thread. Older browsers retain the direct renderer; a failed worker keeps the CSS sky. With `KHR_parallel_shader_compile` the renderer polls the compile status once a frame, without it it checks a frame later. The renderer draws at 0.5 of the CSS size with 4 cloud octaves at 60 fps; if the mean frame interval over 60 frames is above 20 ms it steps down to 0.35 scale, and on the next slow window to 2 octaves at 30 fps. It never goes back up. With no WebGL, a shader that does not compile, or a lost context, the canvas is removed and the CSS phase backdrop (set before first paint by a tiny inline script) and the phase glass values stay. Outside the sun zone (the top 18 % of the screen) a linear-luminance clamp holds the sky under a relative luminance of 0.3, which is what the glass contrast numbers are computed against, so white text keeps 4.5:1. While the pinned bar is shown, its opacity also fades the sun's light inside the sun zone, so the bar and the card titles stuck under it sit on the same capped sky.
7. **Sheets and the day pager.** `src/app/sheet/Sheet.tsx` is a bottom sheet on the `sheet` spring, closed by dragging down (30 % of its height or 500 px/s) or Escape. The page behind shrinks to 0.94 around the middle of the screen and goes `inert`, the toolbar with it; the sky, the pinned bar and the toolbar live outside the page, so they stay put. `src/app/pager/DayPager.tsx` swaps Today and Tomorrow on touch devices below 1024 px: it locks to the horizontal axis after 10 px, switches at a quarter of the width or 500 px/s, resists past the first and last page, and its position (0 to 1) is blended into the sky shader, so the sky follows the swipe. Everywhere else the day is the Today | Tomorrow switch at the top of the Plan card (the Plan sheet on a phone). The toolbar is a phone's only: Plan and Cities. On desktop Cities is a pin next to the hero's place.
8. **Reduced motion is a real mode.** `MotionConfig reducedMotion="user"` plus `useReducedMotion` for custom logic. With `prefers-reduced-motion: reduce` the sky renders single frames (no moving particles, no lightning), there is no pager swipe, day changes fade in 150 ms or less, `NumericRoll` crossfades, and sheets fade. The hero collapse stays, because it is bound to scroll and has no blur. Nothing is lost functionally.

9. **A boot splash instead of a page that settles in steps.** With a stored place the home page would pass through three layouts before the answer: the pre-hydration placeholder, the loading hero and the result, with the hero growing and the cards arriving. `src/app/boot.ts` sets `<html data-boot>` before first paint, which hides the page (`visibility`, so nothing is painted or announced) and shows `src/components/BootSplash.astro`: the place's name and a sun (the moon at night) crossing its day arc, in CSS transforms so it keeps moving while hydration holds the main thread. Its content waits 300 ms, so a fast load never flashes it. Once the app has a settled state (result, empty or error) the splash leaves in 200 ms and the header, hero, Plan card and (on a phone) toolbar come in with a 60 ms stagger, each glass element animated on its own (opacity on an ancestor would stop the glass from blurring the sky), while the cards run the first-result choreography. After 8 s the page is shown whatever the app is doing. A first visit has nothing to load and gets no splash. With a stored place the LCP is now the hand-over, not the placeholder's H1.

## Performance and accessibility

The repository defines automated budgets and checks; these are thresholds, not current device measurements.

**Lighthouse CI** (`lighthouserc.json`) collects three runs each for `/`, `/uv-index/`, `/uv-risks/` and `/sun-protection/` from the built site. It requires:

| Metric         | Home      | Three article pages |
| -------------- | --------- | ------------------- |
| Performance    | ≥ 90      | ≥ 95                |
| Accessibility  | ≥ 95      | ≥ 95                |
| Best Practices | ≥ 95      | ≥ 95                |
| SEO            | 100       | 100                 |
| LCP            | ≤ 2500 ms | ≤ 2500 ms           |
| CLS            | ≤ 0.05    | ≤ 0.05              |

CI uploads reports as `lighthouse-reports` with seven-day retention. Lighthouse does not use the deterministic forecast mocks from Playwright, so these checks do not establish performance of a loaded forecast on a real phone.

**JavaScript budget.** After `npm run build`, run `npm run check:bundle` (add `-- --verbose` for individual files). The script checks initial gzip JavaScript for each built `index.html`: 130,000 bytes for `/`, 2,000 bytes for other pages. It includes executable inline scripts, island entries and static imports. Dynamic imports and their static dependencies are reported separately; lazy and total sizes are informational. Worker assets referenced through URLs and external Google scripts are not included in that import traversal. Sizes depend on the build, including whether analytics is enabled.

**Rendering.** `CARD_TUCK_CLIP` in `src/app/ui.ts` is enabled. The sky renderer starts at scale 0.5, four noise octaves and a 60 fps target, and can reduce quality to scale 0.35, two octaves and a 30 fps target. These are implementation settings, not measured device frame rates.

**Accessibility.** `e2e/a11y.spec.ts` checks for serious and critical axe violations in static pages and app states. Footer colour contrast is explicitly excluded; other footer checks remain active. Lighthouse also uses a custom accessibility configuration (`scripts/lighthouse-config.mjs`). Component and domain tests cover keyboard controls, reduced motion and contrast calculations. City search uses an ARIA combobox, free-time handles use sliders, results use a polite live region, and the decorative sky is hidden from assistive technology. Automated checks do not constitute a complete manual accessibility audit.

## Pages and assets

The static routes are `/`, `/uv-index/`, `/uv-risks/`, `/sun-protection/`, `/about/`, `/methodology/` and `/privacy/`, plus a custom `404.html`, `robots.txt` and generated sitemap. Articles are MDX in `src/content/articles/`; the FAQ is in `src/content/faq.ts`. Site URL, repository and author metadata are in `src/site.config.ts`.

Images for social previews are in `public/og/`; the logo, favicons and self-hosted Inter font are in `public/`. No Lottie player or Lottie animation asset is used. Animation is implemented with Motion, CSS and the GLSL sky.

## Runtime and content

The running site uses fixed scoring rules in `src/domain/rules.config.ts`, with no AI model, prompt or AI service. Articles list their sources; code checks cannot establish independent medical review.

UV GO gives general guidance, not medical advice. Talk to a healthcare professional about your skin.

## License

MIT, copyright 2026 Artem Bakulin. See [LICENSE](LICENSE).
