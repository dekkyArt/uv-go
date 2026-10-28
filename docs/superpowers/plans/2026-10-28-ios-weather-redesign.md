# iOS Weather Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переделать визуальный язык и анимации всего сайта UV GO под приложение Погода iOS: живое WebGL-небо, центральный герой с лучшим временем, стеклянные карточки, тулбар со шторками.

**Architecture:** Слой представления заменяется на месте. `src/domain/`, `src/data/`, `src/app/state.ts` и хуки загрузки не меняются; новые компоненты лежат в `src/app/{hero,cards,sheet,toolbar,pager,sky}`. Цвета больше не зависят от темы: всё белое на стекле, тон стекла задаёт небо (CSS-переменные `--glass-rgb`/`--glass-alpha`, сначала по фазе из CSS, позже из WebGL-слоя).

**Tech Stack:** Astro 7 (static), React 19 island, Motion (`motion/react`, `LazyMotion` + `m`, `domMax`), Tailwind CSS v4, raw WebGL 1, Vitest + RTL, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-28-ios-weather-redesign-design.md` (дальше — «спека», ссылки вида §4.3). Исходное ТЗ: `docs/superpowers/specs/2026-10-27-uv-go-design.md`.

## Global Constraints

- Не менять `src/domain/**` (кроме новых файлов `skyPalette.ts`, `contrast.ts`, `glass.ts`, `skyUniforms.ts`, `skyUniforms.config.ts`), `src/data/**`, `src/app/state.ts`, тексты статей и FAQ, JSON-LD.
- Анимации только через `m.*` из `motion/react` (`LazyMotion strict` бросает исключение на `motion.*`); анимируются только `transform`, `opacity`, `filter`, `clip-path`.
- Лучшее время читается ≤ 1.0 с после прихода данных; вся первая хореография ≤ 1.8 с.
- JS на `/` ≤ 130 000 B gzip начальной загрузки, на остальных страницах ≤ 2 000 B (`npm run check:bundle` после `npm run build`).
- axe: 0 serious/critical на `/`, `/uv-index`, `/uv-risks`, `/sun-protection`, `/404`.
- Контраст: белый и вторичный (`rgb(255 255 255 / 0.72)`) текст ≥ 4.5:1 на стекле; крупный текст ≥ 3:1; графика ≥ 3:1.
- Цели нажатия ≥ 44×44px; вердикт всегда подписан текстом.
- Reduced motion: всё, кроме скролл-привязанного сворачивания героя, сводится к кроссфейду ≤ 150 мс (§5.7).
- Desktop breakpoint: `(min-width: 1024px)`.
- Цвета вердикта: green `#4cd964`, yellow `#ffd60a`, red `#ff6961`, night `#8e9cc9`; дождь `#64d2ff`; градиент шкалы `#4cd964 → #ffd60a → #ff9f0a → #ff6961`.
- Каждая задача заканчивается зелёными `npm run lint`, `npm run check`, `npm test`; задачи, меняющие разметку страниц, — ещё и `npm run test:e2e`.
- Коммиты — Conventional Commits (`feat:`, `refactor:`, `test:`, `docs:`, `chore:`), как в истории репозитория. Работа идёт в ветке `redesign/ios-weather`.

## Review Focus

1. **Полярный день/ночь или битые `sunrise`/`sunset`** — лента часов не должна показывать ячейки восхода/заката и не должна падать (тест в Task 5, `stripItems`).
2. **`null` в данных часа (UV, дождь, ощущаемая)** — в ленте, таблице и строке «Now» показывается `–`, никогда `null`/`NaN` (тесты в Task 4, Task 5, Task 6).
3. **Переход через 1024px при открытой шторке Plan** (поворот планшета, ресайз окна) — шторка закрывается, `inert` снимается, карточка Plan видна (тест в Task 12).
4. **Длинное название города и ширина 320px** — нет горизонтального скролла страницы, город переносится/обрезается, метка `15:00–16:00` помещается (e2e в Task 12).
5. **Потеря WebGL-контекста посреди сессии** — canvas удаляется, остаётся CSS-подложка, стекло возвращается к значениям по фазе, исключений нет (тест в Task 21).

---

## Этап 1. Основа

### Task 1: Одна система токенов от неба, удаление тем

**Files:**
- Create: `src/domain/skyPalette.ts`, `src/domain/contrast.ts`, `src/domain/glass.ts`
- Create: `src/domain/__tests__/glass.test.ts`, `src/test/skyCss.test.ts`
- Modify: `src/styles/global.css` (токены, `.glass`, фазовые градиенты и стекло, типографика; удалить обе палитры тем, `@custom-variant dark`, правила view-transition темы)
- Modify: `src/components/BaseLayout.astro` (убрать `ThemeScript`)
- Modify: `src/components/Header.astro` (убрать `ThemeToggle`)
- Delete: `src/components/ThemeScript.astro`, `src/components/ThemeToggle.astro`, `src/app/theme.ts`, `src/app/__tests__/theme.test.ts`, `src/app/__tests__/skyContrast.test.ts`
- Modify: `e2e/a11y.spec.ts` (убрать цикл по темам и тест «theme persists after reload»), `e2e/app.spec.ts` (убрать тесты темы, если есть)

**Interfaces:**
- Produces:
  - `type Rgb = [number, number, number]` (в `contrast.ts`)
  - `hexToRgb(hex: string): Rgb`, `luminance(c: Rgb): number`, `contrastRatio(a: Rgb, b: Rgb): number`, `over(top: Rgb, alpha: number, bottom: Rgb): Rgb` — перенос формул из удаляемого `skyContrast.test.ts`
  - `SKY_PALETTE: Record<SkyPhase, { top: string; bottom: string }>` (hex), `MAX_SKY_LUMA = 0.3`, `TEXT_SECONDARY_ALPHA = 0.72`, `GLASS = { baseAlpha: 0.38, darken: 0.35 }` (в `skyPalette.ts`)
  - `interface Glass { rgb: Rgb; alpha: number }`; `glassFor(base: Rgb): Glass` (в `glass.ts`)

- [ ] **Step 1: Тест `src/domain/__tests__/glass.test.ts`**

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

- [ ] **Step 2: Запустить — FAIL** (`npx vitest run src/domain/__tests__/glass.test.ts`: модули не найдены)

- [ ] **Step 3: Реализовать `contrast.ts`, `skyPalette.ts`, `glass.ts`**

`glassFor`: `rgb = base × GLASS.darken` по каналам (округлить); `alpha` — наименьшее значение с шагом 0.01, начиная с `GLASS.baseAlpha`, при котором оба условия из теста выполняются над серым фоном яркостью `MAX_SKY_LUMA`. Палитра — iOS-тона из §6.8 (день `#2f6fd0 → #5b97dc`, ночь `#0b1530 → #1d2c55`, рассвет/утро/золотой час/сумерки — тёплые, но каждый стоп ≤ `MAX_SKY_LUMA`).

- [ ] **Step 4: Запустить — PASS**

- [ ] **Step 5: Тест `src/test/skyCss.test.ts`** — читает `global.css` (как бывший `skyContrast.test.ts`):
  - для каждой фазы `--sky-<phase>` — `linear-gradient(180deg, <top> 0%, <bottom> 100%)` с цветами ровно из `SKY_PALETTE`;
  - правило `html[data-sky-phase='<phase>']` задаёт `--glass-rgb: r g b` и `--glass-alpha: a`, равные `glassFor(...)` той же фазы (alpha — до 2 знаков);
  - в CSS нет `data-theme` и `@custom-variant dark`.

- [ ] **Step 6: Запустить — FAIL**

- [ ] **Step 7: Переписать токены в `global.css`**
  - Один набор на `:root`:
    - `--uv-text: #ffffff`;
    - `--uv-text-muted: rgb(255 255 255 / 0.72)`;
    - `--uv-surface: rgb(var(--glass-rgb) / var(--glass-alpha))`;
    - `--uv-surface-strong: rgb(255 255 255 / 0.12)`;
    - `--uv-border: rgb(255 255 255 / 0.14)`;
    - `--uv-focus: #ffffff`;
    - verdict fill и verdict text — цвета из Global Constraints;
    - `--uv-night: #8e9cc9`;
    - `--uv-bg` = верх ночной палитры.
  - Стекло по умолчанию — значения дневной фазы.
  - `.glass` — по §3.2. `.sky-panel` становится алиасом `.glass`: прежняя разметка сразу выглядит по-новому.
  - Отдельный фолбэк без `backdrop-filter` (§3.2) не нужен: `glassFor` считает `alpha` без учёта размытия, против наихудшего допустимого фона.
  - Стекло по фазам ставится правилами `html[data-sky-phase=…]`, которые срабатывают от уже существующего `SkyScript`. Это заменяет запись стекла скриптом из §6.6, результат тот же.
  - Фокус — по §3.1.
  - `--font-sans` — стек из §3.3.
  - Добавить `.tabular { font-variant-numeric: tabular-nums }`.
  - Ниже `@layer base` правило `html::before` с градиентами по `data-sky-phase` остаётся.
  - Удалить тёмные значения `--sky-glow-*` / `--sky-veil-*` и т.п. Светлые оставить одним набором: `SkyLayer` ещё жив до Task 21.

- [ ] **Step 8: Удалить тему**: файлы из списка Delete, импорт `ThemeScript` в `BaseLayout.astro`, `ThemeToggle` в `Header.astro`, e2e-проверки темы. `grep -rn "data-theme\|uvgo:theme\|ThemeToggle" src e2e` — пусто.

- [ ] **Step 9: Проверка** — `npm test && npm run lint && npm run check && npm run test:e2e` — PASS.

- [ ] **Step 10: Commit** — `git commit -m "refactor: replace light/dark themes with one sky-driven glass token set"`

---

## Этап 2. Строительные блоки и статическая раскладка

### Task 2: Иконки погоды

**Files:**
- Create: `src/app/icons/weather/weatherIcon.ts`, `src/app/icons/weather/WeatherIcon.tsx`, `src/app/icons/weather/glyphs.tsx`
- Test: `src/app/__tests__/weatherIcon.test.tsx`

**Interfaces:**
- Consumes: `weatherGroup(code, cloudCover)` из `src/domain/sky.ts`
- Produces:
  - `type WeatherIconName = 'sun' | 'moon' | 'partly-sun' | 'partly-moon' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'heavy-rain' | 'snow' | 'thunder' | 'sunrise' | 'sunset'`
  - `weatherIcon(code: number | null, cloudCover: number | null, isDay: boolean): WeatherIconName`
  - `WeatherIcon({ name, className }: { name: WeatherIconName; className?: string })` — inline SVG, `aria-hidden="true"`, `data-icon={name}`, по умолчанию `size-7`

- [ ] **Step 1: Тест** — таблица:

| code | cloudCover | isDay | ожидаемая иконка |
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

  Плюс рендер: у каждой из 13 иконок есть `svg[data-icon]` с `aria-hidden`.
- [ ] **Step 2: Запустить — FAIL**
- [ ] **Step 3: Реализовать.** Глифы в цветном стиле iOS (§4.7): солнце `#ffd60a`, облака `#ffffff`, капли `#64d2ff`, снежинки `#ffffff`, viewBox `0 0 28 28`.
- [ ] **Step 4: Запустить — PASS**
- [ ] **Step 5: Commit** — `feat: add iOS-style weather icons`

### Task 3: `GlassCard`

**Files:**
- Create: `src/app/cards/GlassCard.tsx`
- Test: `src/app/__tests__/glassCard.test.tsx`

**Interfaces:**
- Produces: `GlassCard({ title, subtitle, action, children, className, cardRef }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string; cardRef?: Ref<HTMLElement> })` — `<section class="glass" aria-labelledby>`; шапка `<header data-card-header>` с `h2` (15px/600), подзаголовком (13px, вторичный) и `action` справа; тело `<div data-card-body>`. Шапка `position: sticky; top: var(--hero-collapsed-h, 0px)`.

- [ ] **Step 1: Тест** — `getByRole('region', { name: 'Hourly' })` находится; подзаголовок и `action` внутри `[data-card-header]`; `children` — внутри `[data-card-body]`.
- [ ] **Step 2: FAIL → Step 3: реализовать → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add GlassCard`

### Task 4: Герой (статичный) и его тексты

**Files:**
- Create: `src/app/hero/heroText.ts`, `src/app/hero/Hero.tsx`
- Modify: `src/app/ui.ts` (`GEO_ERROR`), `src/app/components/LocationPicker.tsx` (импорт `GEO_ERROR` из `ui.ts`)
- Test: `src/app/__tests__/heroText.test.ts`, `src/app/__tests__/hero.test.tsx`

**Interfaces:**
- Consumes: `YOUR_LOCATION_ID` (`src/data/geolocation.ts`), `verdictLabel`, `durationLabel` (`src/app/ui.ts`)
- Produces:
  - `GEO_ERROR = "Can't get your location. Search a city instead."` в `src/app/ui.ts` (перенос константы из `LocationPicker.tsx`)
  - `placeTitle(place: Place): { name: string; mine: boolean }` — для `YOUR_LOCATION_ID` возвращает `{ name: 'My location', mine: true }`. **Уточнение спеки:** обратного геокодинга нет, поэтому вместо отдельного eyebrow «➤ MY LOCATION» над городом строка города сама становится «➤ My location».
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
  - `HERO_H1 = 'Know the best time to go outside'` (export из `Hero.tsx`, его же рендерит `Placeholder`)

- [ ] **Step 1: Тест `heroText.test.ts`**
  - **Today, now.hour = 10**, час 10 с `uv 5.6`, `feelsLike 23.6` → `'Now UV 6 · Feels 24°'`.
  - **Tomorrow:** берутся только часы с `isDay`.
    - максимальный UV 7, ощущаемая 18..24 → `'Peak UV 7 · Feels 18–24°'`;
    - все UV `null` → `'Feels 18–24°'`;
    - все значения `null` → `''`.
  - **Today, у текущего часа `uv: null`** → `'Now Feels 24°'` *(Review Focus 2)*.
  - **`placeTitle`:** для `YOUR_LOCATION_ID` → `{ name: 'My location', mine: true }`; для Лиссабона → `{ name: 'Lisbon', mine: false }`.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Реализовать `heroText.ts`** (округление — `roundHalfUp` из `src/domain/scoring.ts`)
- [ ] **Step 4: PASS**
- [ ] **Step 5: Тест `hero.test.tsx`** — по состоянию из §4.8:
  - во всех состояниях `getByRole('heading', { level: 1, name: HERO_H1 })`;
  - **no-place:** текст «Choose a place», `--:--`, кнопки «Use my location» и «Find a city»; клики вызывают колбэки; `geoError` даёт `role="alert"` с текстом `"Can't get your location. Search a city instead."`;
  - **loading:** `role="status"` «Loading forecast…»;
  - **error:** `role="alert"` с текстом «Couldn't load the forecast» и кнопка «Try again» → `onRetry`;
  - **empty:**
    - `too-short` с duration 120 → «Your free time is shorter than 2 h. Extend it or pick a shorter outing.»;
    - `dark` → «It's dark during your free time. Try earlier hours.»;
    - `past` → «No time left today.» и кнопка «Show tomorrow»;
    - большая строка `—`;
  - **result:**
    - город, `[data-hero-time]` с текстом `best.label`;
    - строка вердикта `Good · 1 h`, у точки `data-verdict="green"`;
    - причина, `nowLine`;
  - **notice=true:** `role="status"` «Your free time today has passed — showing tomorrow».
- [ ] **Step 6: FAIL**
- [ ] **Step 7: Реализовать `Hero.tsx`**
  - Типографика и раскладка — §3.3 и §4.1.
  - Большая строка: `font-size: min(16vw, 104px)`, weight 200, `.tabular`.
  - Слой `.hero-scrim` (новый класс в `global.css`): `radial-gradient(ellipse at center, rgb(0 0 0 / 0.28), transparent 70%)` под текстом, `aria-hidden`.
  - Все строки текста — `text-shadow: 0 1px 2px rgb(0 0 0 / 0.25)`.
  - Тексты пустых состояний и ошибки — дословно из удаляемых `EmptyState`/`ErrorState` (см. тест).
  - `intro` пока не используется: его получит Task 14.
- [ ] **Step 8: PASS**
- [ ] **Step 9: Commit** — `feat: add Hero with result, empty, loading and error states`

### Task 5: Карточка Hourly

**Files:**
- Create: `src/app/cards/stripItems.ts`, `src/app/cards/HourCell.tsx`, `src/app/cards/MetricSwitch.tsx`, `src/app/cards/HourlyCard.tsx`
- Modify: `src/app/components/HourDetails.tsx` (стекло вместо `border bg-surface`; `KEEP_DETAILS_ATTR` импортировать из `src/app/ui.ts`)
- Modify: `src/app/ui.ts` (перенести `KEEP_DETAILS_ATTR` из `HourStrip.tsx`; добавить `CELL_W = 56`)
- Test: `src/app/__tests__/stripItems.test.ts`, `src/app/__tests__/hourlyCard.test.tsx`

**Interfaces:**
- Consumes: `GlassCard` (Task 3), `WeatherIcon`, `weatherIcon` (Task 2), `HourDetails`
- Produces:
  - `type Metric = 'uv' | 'rain' | 'feels'`
  - `type StripItem = { kind: 'hour'; hour: ScoredHour } | { kind: 'sun'; event: 'sunrise' | 'sunset'; time: string }` (`time` — `'HH:MM'`)
  - `stripItems(day: DayForecast, hours: ScoredHour[]): StripItem[]`
  - `metricValue(hour: ScoredHour, metric: Metric): string`
  - `cellName(hour: ScoredHour): string`
  - `spanOf(items: StripItem[], fromHour: number, toHourExclusive: number): { left: number; width: number } | null` — в пикселях, через `CELL_W`
  - `HourlyCard(props: { day: DayForecast; hours: ScoredHour[]; freeTime: { start: number; end: number }; best: TimeWindow | null; selectedHour: number | null; nowHour: number | null; onSelect(hour: number | null): void; intro: boolean })`

- [ ] **Step 1: Тест `stripItems.test.ts`** (фикстура `src/data/__fixtures__/lisbon.json` через `src/test/forecastJson.ts` + `evaluate`):
  - **Длина и порядок:** 24 часа + 2 события; `sunrise` стоит сразу после часа, в котором он произошёл; `time` равен `'HH:MM'` из `day.sunrise`.
  - **Без событий** *(Review Focus 1)*: `sunrise === sunset`, `sunrise > sunset`, `''` или дата чужого дня → в результате нет `kind: 'sun'`, ровно 24 элемента.
  - **`metricValue`:**
    - `uv 5.4` → `'5'`;
    - `rainProb 30` → `'30%'`;
    - `feelsLike 23.5` → `'24°'`;
    - `null` для каждой из трёх метрик → `'–'` *(Review Focus 2)*.
  - **`cellName`:**
    - обычный час → `'14:00, UV 5, rain 30%, OK with protection'`;
    - ночной час → `'03:00, UV 0, rain 0%, Night'`;
    - `null` → `'… UV no data, rain no data …'`.
  - **`spanOf`:** часы 13..16 при восходе перед ними → `left` учитывает ячейку события, `width = 3 * CELL_W`.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Реализовать `stripItems.ts`.** Разбор времени — по образцу `parseClock`/`resolveSun` в `src/domain/sky.ts`; при `null` событие пропускается.
- [ ] **Step 4: PASS**
- [ ] **Step 5: Тест `hourlyCard.test.tsx`**
  - `getByRole('group', { name: 'Hourly forecast' })` содержит 24 `button`.
  - У текущего часа текст «Now» (только если передан `nowHour`; для `nowHour = null` «Now» нет).
  - У выбранного часа `aria-pressed="true"`.
  - **Клавиатура:**
    - `ArrowRight` переносит фокус на следующий час, `End` — на последний, `Home` — на первый;
    - roving: `tabIndex` 0 только у одной кнопки (выбранной, иначе у «Now», иначе у первой в свободном времени).
  - **Детали:** клик по часу → `onSelect(14)`; при `selectedHour = 14` видна `region` «Details for 14:00»; повторный клик по выбранному часу → `onSelect(null)`.
  - **Метрика:** `radiogroup` «Metric» (выбранная иконка на скользящей «таблетке» `layoutId`, как в `SegmentedControl`) с радио `UV` / `Rain` / `Feels like`; выбор `Rain` меняет подзаголовок на «Chance of rain (%)» и значения ячеек на проценты.
  - **Восход и закат:** у ячеек нет `button`, есть текст «Sunrise» / «Sunset».
  - **Подсветки:** есть `[data-free-band]` и `[data-best-outline]`; без лучшего окна (`best = null`) рамки нет.
- [ ] **Step 6: FAIL**
- [ ] **Step 7: Реализовать.**
  - Лента — `overflow-x-auto`, `scroll-snap-type: x mandatory`, скроллбар скрыт. Ячейки фиксированной ширины `CELL_W`.
  - Подложка свободного времени и рамка лучшего окна — абсолютные блоки по `spanOf`; рамка — `<svg data-best-outline>` с `<rect rx=14>` и `stroke` 1.5px белого.
  - Прошедшие часы `opacity: 0.45`.
  - Начальная прокрутка (без анимации) в `useLayoutEffect`: `scrollLeft` на ячейку «Now», иначе на `freeTime.start`.
  - `HourDetails` рендерится внутри тела карточки.
- [ ] **Step 8: PASS**
- [ ] **Step 9: Commit** — `feat: add Hourly card with metric switch and sun events`

### Task 6: Карточка Your free time

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

- [ ] **Step 1: Тест**
  - **`freeTimeRows`:**
    - free time 13..19 → 6 строк, часы 13–18;
    - `best` с часами 15–16 → `best: true` только у них;
    - `fill = min(score, 8) / 8` (score 4 → 0.5, score 12 → 1);
    - ночной час → `dark: true`;
    - `nowHour` → `now: true` у одного часа.
  - **Рендер, таблица:**
    - `getByRole('table', { name: 'Your free time, hour by hour' })`;
    - 5 `columnheader`: Time, Weather, UV, Score, Verdict — визуально скрыты.
  - **Рендер, строки:**
    - видимый текст вердикта `Good` / `OK` / `Avoid`, полный текст доступен (`'Good'` / `'OK with protection'` / `'Not recommended'` в `.sr-only`);
    - тёмный час — текст «Dark» и нет `[data-score-bar]`;
    - дождь 60% — текст «60%»; дождь 20% — процента нет;
    - UV `null` → `UV –` *(Review Focus 2)*;
    - метка «Best» у строк лучшего окна.
  - **Шапка:** подзаголовок `'13:00–19:00 · Relaxed · 1 h'`.
- [ ] **Step 2: FAIL → Step 3: реализовать** (`ScoreBar`: трек `rgb(255 255 255 / 0.12)`, заливка `scaleX(fill)` с `transform-origin: left` поверх градиента шкалы на всю ширину трека — градиент лежит на треке, заливка его открывает маской `clip-path: inset(0 calc((1 - fill) * 100%) 0 0 round 999px)`; при `now` — белая точка 8px в конце заливки) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add Your free time card with score bars`

### Task 7: Плитки What to take

**Files:**
- Create: `src/app/cards/tileReason.ts`, `src/app/cards/TakeTiles.tsx`
- Modify: `src/app/icons/checklist/shared.tsx` (`className` по умолчанию `size-4`, цвет `currentColor` — белый по наследованию)
- Test: `src/app/__tests__/takeTiles.test.tsx`

**Interfaces:**
- Consumes: `rules.checklist`, `rules.checklistLabels`, `rules.emptyChecklistText`, иконки `src/app/icons/checklist/*`
- Produces:
  - `tileReason(id: ChecklistId, window: TimeWindow, activity: Activity): { title: string; detail: string }`
  - `TakeTiles(props: { items: ChecklistItem[]; window: TimeWindow; activity: Activity; intro: boolean })`

Тексты (`title` / `detail`), где числа — из часов окна (`roundHalfUp`) и из `rules.checklist`:

| id | title | detail |
|---|---|---|
| sunscreen | `UV up to {maxUv}` | `Needed from UV {sunscreenUv}` |
| hat-sunglasses | `UV up to {maxUv}` | `Needed from UV {hatUv}` |
| rain-jacket | `Rain up to {maxRain}%` | `Needed from {rainJacket}% rain` |
| water | `Active plan` (activity `active`), иначе `Feels up to {maxFeels}°` | `Needed when active or from {waterFeelsLike}°` |
| warm-layer | `Feels down to {minFeels}°` | `Needed below {warmLayerBelow}°` |

- [ ] **Step 1: Тест**
  - **`tileReason`:** по строке на каждую строку таблицы.
    - Окно с UV 4.6 / 5.2 → `'UV up to 5'`, detail `'Needed from UV 3'`.
    - `water` при `relaxed` и ощущаемой 27.4 → `'Feels up to 27°'`.
  - **Рендер:**
    - список `role="list"` с `listitem` на каждый пункт;
    - в плитке label из `checklistLabels`, `title` и `detail`;
    - пустой список → одна плитка с текстом `rules.emptyChecklistText`.
- [ ] **Step 2: FAIL → Step 3: реализовать** (сетка `grid-cols-2`, плитка `.glass`, `aspect-ratio: 1`; пустая плитка `col-span-2`, без `aspect-ratio`) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add What to take tiles`

### Task 8: `PlanControls` и стекло для контролов

**Files:**
- Create: `src/app/cards/PlanControls.tsx`
- Modify: `src/app/components/SegmentedControl.tsx` (контейнер `bg-surface-strong` → `glass`-«таблетка» `rounded-full`, индикатор `bg-white/90`, текст выбранного `text-black/85`, остальные белые)
- Modify: `src/app/components/FreeTimePicker.tsx` (трек `bg-white/15`, полоса `bg-white/70`, ручки — белые круги 22px с тенью)
- Test: `src/app/__tests__/planControls.test.tsx` (переносит из `controls.test.tsx` проверки `SegmentedControl` и `FreeTimePicker`; `controls.test.tsx` удаляется в Task 12)

**Interfaces:**
- Produces: `PlanControls(props: { inputs: Inputs; onFreeTime(v: Inputs['freeTime']): void; onDuration(v: DurationMin): void; onActivity(v: Activity): void })` — три группы с `h3` «Free time», «Duration», «Activity»; радиогруппы с именами «Duration» и «Activity»; слайдеры «Free time start» и «Free time end».

- [ ] **Step 1: Тест**
  - Клик по радио `'3 h'` → `onDuration(180)`; `'Long in the sun'` → `onActivity('long-sun')`.
  - `ArrowRight` на слайдере «Free time start» → `onFreeTime({ start: 14, end: 19 })`.
  - Видна строка `'13:00 – 19:00'`.
- [ ] **Step 2: FAIL → Step 3: реализовать → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add PlanControls and restyle segmented and free time controls`

### Task 9: `Sheet`

**Files:**
- Create: `src/app/sheet/Sheet.tsx`
- Modify: `src/motion/tokens.ts` — добавить `springs.sheet = { type: 'spring', duration: 0.45, bounce: 0.08 }` (остальные токены не трогать до Task 14)
- Modify: `src/styles/global.css` — масштаб страницы под шторкой:

  ```css
  html[data-sheet-open] [data-page] {
    transform: scale(0.94);
    border-radius: 16px;
    transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.45s;
  }
  ```

  Под `prefers-reduced-motion: reduce` — без `transform`.
- Modify: `src/components/BaseLayout.astro` — обёртка `<div data-page>` вокруг header/main/footer
- Test: `src/app/__tests__/sheet.test.tsx`

**Interfaces:**
- Consumes: `springs.sheet`
- Produces: `Sheet(props: { open: boolean; onClose(): void; title: string; size: 'auto' | 'tall'; returnFocusRef: RefObject<HTMLElement | null>; children: ReactNode })`
  - портал в `document.body` с `data-sheet-root`;
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → видимый `h2` с `title`;
  - при открытии: `inert` на `[data-page]`, `html[data-sheet-open]`, фокус на первый фокусируемый элемент внутри;
  - при закрытии: всё снять, фокус на `returnFocusRef.current`.

- [ ] **Step 1: Тест**
  - `open=true` → `getByRole('dialog', { name: 'Plan' })`; у `[data-page]` есть атрибут `inert`; `document.activeElement` внутри диалога.
  - Esc → `onClose`.
  - Клик по `[data-sheet-backdrop]` → `onClose`.
  - Ререндер с `open=false` → `inert` снят, `data-sheet-open` снят, фокус на `returnFocusRef`.
  - Размонтирование открытой шторки тоже снимает `inert` *(Review Focus 3)*.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Реализовать.**
  - Панель: `m.div`, `drag="y"`, `dragConstraints={{ top: 0, bottom: 0 }}`, `dragElastic={{ top: 0, bottom: 1 }}`; `onDragEnd` закрывает при `offset.y > 0.3 * height` или `velocity.y > 500`.
  - Анимация входа и выхода — `AnimatePresence`, `y: '100%' → 0`, `springs.sheet`; при reduced motion — `opacity` за `durations.fast`.
  - Фон затемнён `rgb(0 0 0 / 0.35)`.
  - Высота: `tall` — `92dvh`, `auto` — по содержимому до `92dvh`.
  - Отступ снизу — `env(safe-area-inset-bottom)`.
- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add accessible bottom Sheet`

### Task 10: Тулбар и точки дней

**Files:**
- Create: `src/app/toolbar/Toolbar.tsx`, `src/app/toolbar/DayDots.tsx`
- Test: `src/app/__tests__/toolbar.test.tsx`

**Interfaces:**
- Produces:
  - `DayDots(props: { day: Inputs['day']; onDay(d: Inputs['day']): void; panelId: string })` — `role="tablist"` `aria-label="Day"`, две `tab` («Today», «Tomorrow») с `aria-selected` и `aria-controls={panelId}`; ←/→ переключают и переносят фокус
  - `Toolbar(props: { day: Inputs['day']; onDay(d: Inputs['day']): void; panelId: string; onPlan?: () => void; onCities(): void; planRef: Ref<HTMLButtonElement>; citiesRef: Ref<HTMLButtonElement> })` — `nav aria-label="App"`, кнопки «Plan» и «Cities» 48px; без `onPlan` кнопки Plan нет
  - `TOOLBAR_H = 72` в `src/app/ui.ts` (кнопки 48 + отступы)

- [ ] **Step 1: Тест**
  - Вкладки: `getByRole('tab', { name: 'Tomorrow' })` → клик → `onDay('tomorrow')`; на вкладке «Today» `ArrowRight` → `onDay('tomorrow')` и фокус на «Tomorrow».
  - Без `onPlan` нет `button` «Plan»; клик по «Cities» → `onCities`.
- [ ] **Step 2: FAIL → Step 3: реализовать** (фиксирован снизу по центру, `bottom: calc(12px + env(safe-area-inset-bottom))`, материал `.glass`; точки 8px, активная белая, неактивная `white/40`) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add bottom toolbar with day dots`

### Task 11: Шторка Cities и хук геолокации

**Files:**
- Create: `src/app/hooks/useGeolocate.ts`, `src/app/sheet/CitiesSheet.tsx`
- Modify: `src/app/components/CitySearch.tsx` (стиль поля: стекло, `rounded-xl`, белый текст, плейсхолдер `white/55`; поведение не трогать)
- Delete: `src/app/components/LocationPicker.tsx` (поведение переносится: выбор, геолокация, ошибка)
- Test: `src/app/__tests__/citiesSheet.test.tsx` (переносит сценарии `LocationPicker` из `controls.test.tsx`)

**Interfaces:**
- Consumes: `Sheet` (Task 9), `requestPosition`, `yourLocationPlace`, `formatPlace`, `CitySearch`, `GEO_ERROR` (`src/app/ui.ts`, Task 4)
- Produces:
  - `useGeolocate(onPlace: (p: Place) => void): { locating: boolean; geoError: boolean; locate(): Promise<void>; clearError(): void }`
  - `CitiesSheet(props: { open: boolean; onClose(): void; place: Place | null; onPlace(p: Place): void; returnFocusRef: RefObject<HTMLElement | null> })` — заголовок «Cities»; текущее место строкой `formatPlace(place)`; кнопка «Use my location»; `CitySearch`; `role="alert"` с `GEO_ERROR`

- [ ] **Step 1: Тест**
  - Выбор «Lisbon, Portugal» в combobox → `onPlace` с Лиссабоном и `onClose`.
  - `requestPosition` отклонён (`vi.mock('../../data/geolocation')`) → `alert` с `GEO_ERROR`, фокус в combobox.
  - Успех → `onPlace(yourLocationPlace(lat, lon))`.
  - Пока идёт поиск позиции, кнопка показывает «Locating…» и `disabled`.
- [ ] **Step 2: FAIL → Step 3: реализовать → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add Cities sheet and useGeolocate`

### Task 12: Сборка приложения, удаление старого UI, e2e

**Files:**
- Create: `src/app/hero/heroState.ts`, `src/app/hooks/useIsDesktop.ts`, `src/app/reserveLayout.ts`
- Modify (переписать): `src/app/UvGoApp.tsx`
- Modify: `src/pages/index.astro` (убрать `Hero.astro`; `reservePlaceLayout` → `reserveLayout`)
- Delete:
  - Компоненты: `src/components/Hero.astro`, `src/app/reservePlaceLayout.ts`, `src/app/components/{ResultCard,MiniResult,DayArcTimeline,HourStrip,LoadingSun,TimelineSkeleton,EmptyState,ErrorState,WhatToTake}.tsx`, `src/app/icons/VerdictIcon.tsx`.
  - Хуки: `src/app/hooks/{useCardOffscreen,useCountUp}.ts`.
  - Тесты к ним: `result.test.tsx`, `timeline.test.tsx`, `states.test.tsx`, `statesReducedMotion.test.tsx`, `whatToTake*.test.tsx`, `controls.test.tsx`, части `hooks.test.tsx` про удалённые хуки.
  - Из `ui.ts` — неиспользуемые `CARD_CLASS`, `CARD_SLOT_CLASS`, `HOUR_STRIP_MIN_H_CLASS`, `PANEL_CLASS`, `LOCATION_SKELETON_CLASS`, `ADJUST_SKELETON_CLASS`.
- Modify: `src/app/components/SkyLayer.tsx` (импорт `useIsDesktop` из нового хука)
- Test: `src/app/__tests__/heroState.test.ts`, `src/app/__tests__/reserveLayout.test.ts`, `src/app/__tests__/UvGoApp.test.tsx` (переписать), `e2e/app.spec.ts`, `e2e/a11y.spec.ts`, `e2e/mocks.ts`

**Interfaces:**
- Consumes: всё из Tasks 3–11; `useForecastLoader`, `useNow`, `useFirstResult`, `useSky`, `reducer`, `evaluate`, `buildChecklist` (через `evaluate`)
- Produces:
  - `heroState(state: AppState, evaluation: EvaluationResult | null, now: NowLocal | null): HeroState`
  - `useIsDesktop(): boolean` (запрос `(min-width: 1024px)`, `useSyncExternalStore`, на сервере `false`)
  - `reserveLayout(win?)`: самодостаточная функция для inline-скрипта. По образцу `reservePlaceLayout` ставит `data-has-place` и дополнительно `--free-rows` на `<html>`. Значение — `end − start` из `localStorage['uvgo:inputs']`, при ошибке или неверных данных — 6.
  - `DAY_PANEL_ID = 'day-panel'`

**Раскладка `UvGoApp`:**
- Мобильный:
  - `Hero`;
  - `div#day-panel role="tabpanel"` с карточками Hourly, Your free time, What to take;
  - `Toolbar` с `onPlan`;
  - `PlanSheet` = `Sheet size="auto" title="Plan"` с `PlanControls`;
  - `CitiesSheet`.
- Десктоп (`useIsDesktop()`): сетка §3.4/§4.2.
  - Герой в левой колонке, `lg:sticky lg:top-24`.
  - Правая колонка: Hourly; под ней сетка: Your free time | (What to take + `GlassCard title="Plan"` с `PlanControls`).
  - Toolbar без `onPlan`.
- Отступ снизу контента: `calc(TOOLBAR_H + 24px + env(safe-area-inset-bottom))`.
- `SkyLayer` (старый) пока остаётся под `Suspense`.
- `aria-live` — прежнее объявление.
- Карточки по состояниям (§4.8): при `loading` — скелетоны `GlassCard` с `aria-busy`; при `no-place` и `error` — скрыты. What to take — только при результате.
- Когда `useIsDesktop()` становится `true`, `planOpen` сбрасывается в `false`.
- `Placeholder`:
  - герой-скелет фиксированной высоты 300px с `h1` `HERO_H1`;
  - Hourly-скелет фиксированной высоты;
  - free-time-скелет высотой `calc(var(--free-rows, 6) * ROW_H + 56px)`.

- [ ] **Step 1: Тест `heroState.test.ts`** — по одному кейсу на каждый `kind`:
  - `place: null` → `no-place`;
  - `forecast.status: 'error'` → `error`;
  - `evaluation: null` → `loading`;
  - `best: null` и `emptyReason: 'dark'` → `empty`;
  - иначе → `result` с `nowLine` из `heroText.nowLine`.
- [ ] **Step 2: Тест `reserveLayout.test.ts`**
  - Сохранено `{ freeTime: { start: 9, end: 17 } }` → `--free-rows` = `'8'`.
  - Битый JSON или `getItem` бросает → `'6'` и нет исключения.
  - Валидное место → `data-has-place`.
- [ ] **Step 3: Тест `UvGoApp.test.tsx`** (переписать по существующему стилю: мок `fetch` с фикстурой Лиссабона, фиксированное время):
  - первый визит: `h1`, кнопки «Use my location» / «Find a city»; «Find a city» открывает диалог «Cities»;
  - выбор Лиссабона → `[data-hero-time]` с меткой вида `\d{2}:00–\d{2}:00`, region «Hourly», table «Your free time, hour by hour», список плиток;
  - кнопка «Plan» → диалог «Plan» → радио `3 h` → метка героя меняется, длина окна 3 ч;
  - вкладка «Tomorrow» → `aria-selected` у Tomorrow, данные второго дня;
  - сохранённые входные данные восстанавливаются;
  - **десктоп** (мок `matchMedia` → `matches: true`): нет кнопки «Plan», есть region «Plan»;
  - **смена брейкпоинта при открытой шторке** *(Review Focus 3)*: открыть «Plan» на мобильном, переключить мок `matchMedia` на десктоп и вызвать его `change` → `queryByRole('dialog')` пуст, `[data-page]` без `inert`, region «Plan» виден.
- [ ] **Step 4: Запустить — FAIL**
- [ ] **Step 5: Реализовать** `heroState.ts`, `useIsDesktop.ts`, `reserveLayout.ts`, новый `UvGoApp.tsx`, правки `index.astro`; удалить файлы из списка Delete.
- [ ] **Step 6: `npm test`, `npm run lint`, `npm run check` — PASS**; `grep -rn "ResultCard\|DayArcTimeline\|HourStrip\|MiniResult\|LocationPicker" src` — пусто.
- [ ] **Step 7: Обновить e2e**
  - `mocks.ts`: `searchLisbon` сначала кликает `button` «Find a city», если он виден, иначе «Cities»; затем прежние шаги.
  - **Happy path:** после поиска — `getByRole('button', { name: 'Plan' }).click()`, затем прежняя проверка `radio '3 h'` и длины окна. Метка читается из `[data-hero-time]`.
  - **Геолокация:** кнопка «Use my location» в герое.
  - **Новые проверки:**
    - Esc закрывает «Plan», фокус на кнопке «Plan»;
    - 1280×800: `region` «Plan» виден без шторки;
    - 320×640 с местом `{ name: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch', … }` в `localStorage` и замоканным прогнозом: `document.documentElement.scrollWidth <= 320`, `[data-hero-time]` целиком в вьюпорте *(Review Focus 4)*.
  - `a11y.spec.ts`: ожидание результата через `[data-hero-time]`.
- [ ] **Step 8: `npm run test:e2e` — PASS; `npm run build && npm run check:bundle` — PASS**
- [ ] **Step 9: Commit** — `feat: assemble iOS-style app layout with toolbar and sheets`

### Task 13: Хедер, футер, How it works, FAQ

**Files:**
- Modify: `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/HowItWorks.astro`, `src/components/Faq.astro`, `src/components/BaseLayout.astro`
- Test: `src/test/howItWorks.test.ts` (обновить селекторы, если ломаются), e2e — существующие

**Interfaces:** нет новых.

- [ ] **Step 1: Хедер.**
  - Без фона и без `border-b`, `position: absolute` поверх неба на главной.
  - «UV GO» и группа ссылок — каждая на своей `.glass`-«таблетке» `rounded-full px-3 min-h-11`, текст 15px/600.
- [ ] **Step 2: Футер.** Без `bg-surface`; содержимое на одной `.glass`-подложке `rounded-2xl`, 13px, вторичный цвет; нижний отступ под тулбар только на `/` (класс через prop `withToolbar` из `index.astro`).
- [ ] **Step 3: How it works и FAQ.**
  - Внешние контейнеры: `.glass rounded-[22px]`.
  - Внутренние `border bg-surface`: заменить на разделители `divide-y divide-white/15` (FAQ) и `bg-white/8 rounded-xl` (шаги How it works).
  - Таблицы правил в стиле строк §4.4: строки 44px, разделители `white/15`.
  - Заголовки секций 22px/600.
- [ ] **Step 4:** `npm test && npm run check && npm run test:e2e` — PASS (axe — без нарушений)
- [ ] **Step 5: Commit** — `feat: restyle header, footer, How it works and FAQ as glass`

---

## Этап 3. Анимации

### Task 14: Токены, хореография, первый результат

**Files:**
- Modify: `src/motion/tokens.ts`:

  ```ts
  springs = {
    smooth: { type: 'spring', duration: 0.5, bounce: 0 },
    snappy: { type: 'spring', duration: 0.3, bounce: 0.15 },
    sheet: { type: 'spring', duration: 0.45, bounce: 0.08 },
  }
  ```

  `gentle` и `bouncy` удалить; `durations` и `ease` без изменений.
- Modify: `src/motion/choreography.ts` — новый `firstResult` (константы ниже), `labelVisibleAt`, `totalDuration`
- Modify: `src/app/hooks/useFirstResult.ts` — убрать стадии `search`/`handoff` и `labelInFrame`; вернуть `{ playIntro: boolean }`, `playIntro` держится `totalDuration()` секунд
- Modify: `Hero.tsx`, `GlassCard.tsx` (prop `index` для шага), `HourlyCard.tsx`, `ScoreBar.tsx`, `TakeTiles.tsx`, `SegmentedControl.tsx` (`springs.snappy` уже есть)
- Test: `src/motion/__tests__/choreography.test.ts` (переписать), `src/app/__tests__/motion.test.tsx` (переписать), `src/app/__tests__/hooks.test.tsx` (часть про `useFirstResult`)

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

- [ ] **Step 1: Тест `choreography.test.ts`**
  - `labelVisibleAt()` ≈ 0.35 и ≤ 1.0.
  - `totalDuration()` ≤ 1.8 и ≥ 1.0.
  - Увеличение `barStagger` при 24 строках не выводит за `barsGrow + barStaggerMax + barsDuration`.
- [ ] **Step 2: Тест `motion.test.tsx`**
  - При `intro=true` у `[data-hero-time]` в первом кадре `opacity` < 1, через `totalDuration()` — 1.
  - У `[data-best-outline] rect` анимируется `pathLength`.
  - При reduced motion (`vi.mock` `useReducedMotion` → `true`) все финальные значения сразу; в DOM нет `filter: blur`.
- [ ] **Step 3: FAIL → Step 4: реализовать.** Анимации по таблице §5.2:
  - герой: `filter blur(8px)→0`, `y 12→0`, `opacity`;
  - карточки: `y 16→0`, `opacity`, задержка `cardsIn + index * cardStagger`;
  - лента часов: прокрутка к цели через `animate(scrollLeft)` из `motion/react` — `animate` уже входит в `domMax`-бандл, проверить бюджет в Step 6;
  - рамка лучшего окна: `pathLength 0→1`;
  - бары: `scaleX`, задержка `barsGrow + min(i * barStagger, barStaggerMax)`;
  - плитки: `scale 0.94→1`, `opacity`.
  - Без `intro` — никаких входных анимаций.
  - Раскрытие деталей часа: тело `HourlyCard` — `m.div layout` с `springs.smooth`.
  - `whileTap={{ scale: 0.97 }}` + `springs.snappy` на ячейках часов, плитках, кнопках тулбара и кнопках героя.
  - Reduced motion: `opacity` за `durations.fast`, без `layout` и `whileTap`.
- [ ] **Step 5: PASS**
- [ ] **Step 6: `npm run build && npm run check:bundle` — PASS** (если `animate` не влезает в бюджет, прокрутку сделать `element.scrollTo({ left, behavior: 'smooth' })`)
- [ ] **Step 7: Commit** — `feat: new first-result choreography on iOS-style springs`

### Task 15: `NumericRoll`

**Files:**
- Create: `src/app/components/NumericRoll.tsx`
- Modify: `Hero.tsx` (метка окна и `nowLine`), `HourCell.tsx` (значение метрики)
- Test: `src/app/__tests__/numericRoll.test.tsx`

**Interfaces:**
- Produces:
  - `rollParts(prev: string, next: string): { char: string; changed: boolean }[]` — посимвольно по позиции; при разной длине все символы считаются изменёнными
  - `rollDirection(prev: string, next: string): 1 | -1` — сравнение чисел, извлечённых из строк (`parseInt` первой группы цифр); `1` — вверх
  - `NumericRoll({ value, className }: { value: string; className?: string })` — внешний `span` с `aria-label={value}` и `role="text"`-эквивалентом (`<span aria-label>` + `aria-hidden` у символов)

- [ ] **Step 1: Тест**
  - `rollParts('15:00–16:00', '17:00–18:00')`: `changed` только у индексов 1 и 7.
  - `rollDirection('15:00', '13:00') === -1`.
  - Рендер: `getByLabelText('17:00–18:00')` после ререндера; каждый символ `aria-hidden`.
  - Неизменённые символы не получают `m`-анимации: у них нет `data-rolling`.
  - Reduced motion: нет `transform` / `blur`, только `opacity`.
- [ ] **Step 2: FAIL → Step 3: реализовать** (§5.5: сдвиг 0.6em, `blur(4px)`, `springs.smooth`, длительность 0.35 с, сдвиг соседних 0.03 с; изменившиеся символы — `AnimatePresence mode="popLayout"` по ключу `${index}-${char}`) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: add NumericRoll digit transitions`

### Task 16: Сворачивание героя

**Files:**
- Create: `src/app/hero/useHeroCollapse.ts`, `src/app/hero/CollapsedBar.tsx`
- Modify: `Hero.tsx`, `UvGoApp.tsx` (ставит `--hero-collapsed-h: 56px` на корень на мобильном, `0px` на десктопе)
- Test: `src/app/__tests__/heroCollapse.test.tsx`

**Interfaces:**
- Produces:
  - `COLLAPSE_DISTANCE = 140`, `COLLAPSED_H = 56`
  - `collapseStyles(y: number): { timeScale: number; timeY: number; detailsOpacity: number; eyebrowOpacity: number; barOpacity: number }` — чистая функция:
    - `timeScale`: 1 → 0.38 на 0..140;
    - `detailsOpacity`: 1 → 0 на 0..60;
    - `eyebrowOpacity`: 1 → 0 на 0..100;
    - `barOpacity`: 0 → 1 на 100..140.
    - Вне диапазона значения зажимаются.
  - `useHeroCollapse(enabled: boolean): Record<keyof ReturnType<typeof collapseStyles>, MotionValue<number>>` — через `useScroll().scrollY` + `useTransform(scrollY, collapseStyles)`
  - `CollapsedBar(props: { place: string; label: string; verdict: Verdict; opacity: MotionValue<number> })` — фиксирован сверху, `aria-hidden`, без `tabIndex`; клик → `window.scrollTo({ top: 0, behavior })` (`auto` при reduced motion)

- [ ] **Step 1: Тест**
  - `collapseStyles(0)` → `{ timeScale: 1, …, barOpacity: 0 }`.
  - `collapseStyles(140).timeScale` ≈ 0.38; `collapseStyles(60).detailsOpacity === 0`; `collapseStyles(500)` = `collapseStyles(140)`.
  - `CollapsedBar`: `aria-hidden="true"`, не фокусируется, текст `'Lisbon · 15:00–16:00 | Good'`.
  - На десктопе (`enabled=false`) у `[data-hero-time]` нет `transform` от скролла.
- [ ] **Step 2: FAIL → Step 3: реализовать** (сворачивание не отключается при reduced motion, отключается только `filter`) **→ Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: collapse hero into a pinned bar on scroll`

### Task 17: «Заезд» карточек под героя

**Files:**
- Create: `src/app/cards/useCardTuck.ts`
- Modify: `src/app/ui.ts` — `export const CARD_TUCK_CLIP = true`
- Modify: `GlassCard.tsx` (принимает `tuck?: boolean`)
- Test: `src/app/__tests__/cardTuck.test.tsx`

**Interfaces:**
- Produces:
  - `tuckInset(cardTop: number, headerH: number, collapsedH: number, bodyH: number): number` — сколько px тела срезать сверху: `clamp(collapsedH + headerH − (cardTop + headerH), 0, bodyH)`, где `cardTop` — `getBoundingClientRect().top`
  - `useCardTuck(cardRef: RefObject<HTMLElement | null>, enabled: boolean): MotionValue<string>` — `clip-path` строка `inset(<n>px 0 0 0 round 22px)`; подписка на `useScroll().scrollY.on('change')`, чтение `getBoundingClientRect` в том же кадре, без `setState`

- [ ] **Step 1: Тест**
  - `tuckInset(200, 44, 56, 300) === 0`; `tuckInset(20, 44, 56, 300) === 36`; `tuckInset(-400, 44, 56, 300) === 300`.
  - При `CARD_TUCK_CLIP = false` (`vi.mock` модуля `ui`) или на десктопе у тела нет `clip-path`.
- [ ] **Step 2: FAIL → Step 3: реализовать → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: tuck card bodies under the collapsed hero`

### Task 18: Пейджер Today/Tomorrow и «пилюля» точек

**Files:**
- Create: `src/app/pager/DayPager.tsx`
- Modify: `DayDots.tsx` (активная точка — `m.span layoutId="day-dot"` шириной 16px), `UvGoApp.tsx` (обернуть `#day-panel` и героя в `DayPager`; передать `progress` в небо — используется в Task 21)
- Test: `src/app/__tests__/dayPager.test.tsx`

**Interfaces:**
- Produces:
  - `pagerDecision(offsetX: number, velocityX: number, width: number, day: Inputs['day']): Inputs['day']` — переключает при `|offset| ≥ 0.25 * width` или `|velocity| > 500`; влево (отрицательное) — на `tomorrow`, вправо — на `today`; за край не переключает
  - `lockAxis(dx: number, dy: number): 'x' | 'y' | null` — `null`, пока `max(|dx|, |dy|) < 10`; `'y'`, если угол к горизонтали > 30°
  - `rubberBand(offset: number, atEdge: boolean): number` — `atEdge ? offset * 0.3 : offset`
  - `DayPager(props: { day: Inputs['day']; onDay(d): void; enabled: boolean; progress: MotionValue<number>; children: ReactNode })` — `progress` от 0 (today) до 1 (tomorrow) во время свайпа; жест не стартует, если `pointerdown` пришёл изнутри `[data-hourly-strip]`

- [ ] **Step 1: Тест**
  - `pagerDecision(-100, 0, 390, 'today') === 'tomorrow'`, `pagerDecision(-50, 0, 390, 'today') === 'today'`, `pagerDecision(-20, -600, 390, 'today') === 'tomorrow'`, `pagerDecision(-200, 0, 390, 'tomorrow') === 'tomorrow'`.
  - `lockAxis(4, 3) === null`, `lockAxis(12, 3) === 'x'`, `lockAxis(10, 8) === 'y'`.
  - `rubberBand(100, true) === 30`.
  - `enabled=false` (десктоп или reduced motion) → у контейнера нет обработчиков `pointerdown` (`data-pager-enabled="false"`).
  - Смена `day` извне → контент сменился, `progress` = 0 или 1.
- [ ] **Step 2: FAIL → Step 3: реализовать** (контент `m.div` со смещением `x` от жеста; после решения — пружина `springs.sheet` к новой странице, затем `onDay`; reduced motion — фейд `durations.fast`) **→ Step 4: PASS**
- [ ] **Step 5: e2e:** контекст 390×844 с `hasTouch: true, isMobile: true` (тогда `pointer: coarse`). По `#day-panel` отправить `pointerdown` → 5 × `pointermove` (шаг −40px по x) → `pointerup` с `pointerType: 'touch'` через `locator.dispatchEvent`. Ожидание: вкладка «Tomorrow» `aria-selected="true"`.
- [ ] **Step 6: Commit** — `feat: swipe between Today and Tomorrow`

---

## Этап 4. WebGL-небо

### Task 19: `skyUniforms` и стекло из неба

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
  - `WEATHER_TABLE: Record<WeatherGroup, { cloudCover; cloudDark; fog; rain; snow; glassDrops }>` — значения §6.3
  - `SUN_ZONE = 0.18`, `BASE_CLOUD_SPEED = 0.02`
  - `skyUniforms(s: SkyState): SkyUniforms`
  - `mixUniforms(a: SkyUniforms, b: SkyUniforms, t: number): SkyUniforms` (линейно по всем полям)
  - `glassTint(u: SkyUniforms): Glass` = `glassFor(base)`, где `base = over(over(skyTop, 0.5, skyBottom) смешанный с серым #8a96a8 на cloudCover × 0.6, затем × (1 − 0.5 × cloudDark))`

- [ ] **Step 1: Тест**
  - Для каждой погоды поля равны `WEATHER_TABLE`.
  - Ночь → `sunIntensity 0`, `moon 1`, `stars = 1 − cloudCover`; день → `stars 0`.
  - `wind: true` удваивает `cloudSpeed`; `heat: true` → `heat 1`; погода `thunder` → `thunder 1`, остальные → `thunder 0`.
  - `sunPos[1]` ≤ `SUN_ZONE` при любом `sunPosition` 0..1 (y от верха экрана).
  - `skyTop`/`skyBottom` = `SKY_PALETTE[phase]`.
  - `mixUniforms(a, b, 0.5).rain` — среднее.
  - **Контраст:** для всех 6 × 7 сочетаний фазы и погоды и для `mixUniforms` любых двух соседних фаз при `t = 0.5` белый и вторичный текст на `glassTint(u)` поверх серого яркостью `MAX_SKY_LUMA` ≥ 4.5; `alpha` ≤ 0.8.
- [ ] **Step 2: FAIL → Step 3: реализовать → Step 4: PASS**
- [ ] **Step 5: Commit** — `feat: map sky state to shader uniforms and glass tint`

### Task 20: Шейдер и renderer

**Files:**
- Create: `src/app/sky/shader.ts`, `src/app/sky/renderer.ts`
- Test: `src/app/__tests__/renderer.test.ts`

**Interfaces:**
- Consumes: `SkyUniforms` (Task 19)
- Produces:
  - `VERTEX_SRC: string`, `FRAGMENT_SRC: string` (GLSL ES 1.0, `precision mediump float`, uniform-имена `u` + PascalCase поля `SkyUniforms`, например `uSkyTop`, `uCloudCover`; плюс `uTime`, `uResolution`, `uFlash`, `uOctaves`)
  - `smoothStep(cur: SkyUniforms, target: SkyUniforms, dt: number): SkyUniforms` — `cur + (target − cur) × (1 − exp(−dt / 0.4))` по всем полям
  - `type Quality = { scale: 0.5 | 0.35; octaves: 4 | 2; fps: 60 | 30 }`
  - `nextQuality(q: Quality, avgFrameMs: number): Quality` — при `> 20`: сначала `scale 0.35`, затем `octaves 2` + `fps 30`; вверх не возвращается
  - `nextFlashDelay(rand: () => number): number` — 6..14 с
  - `createRenderer(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; onLost(): void }): SkyRenderer | null` — `null`, если `getContext('webgl')` вернул `null` или шейдер не собрался (`console.warn` один раз)
  - `interface SkyRenderer { setTarget(u: SkyUniforms): void; start(): void; stop(): void; destroy(): void }` — при `reducedMotion` `start()` рисует один кадр с `cur = target` и без частиц (`uRain = uSnow = uGlassDrops = uHeat = uFlash = 0`), при каждом `setTarget` — ещё один кадр; иначе rAF-цикл с паузой на `visibilitychange`

- [ ] **Step 1: Тест**
  - `smoothStep(a, b, 0)` = a; `smoothStep(a, b, 10)` ≈ b (погрешность 1e-3); при `dt = 0.4` пройдено ≈ 63%.
  - `nextQuality({ scale: 0.5, octaves: 4, fps: 60 }, 25)` → `scale 0.35`; повтор → `octaves 2, fps 30`; при 10 мс — без изменений.
  - `nextFlashDelay(() => 0) === 6`, `nextFlashDelay(() => 0.999)` ≈ 14.
  - `createRenderer` с canvas, у которого `getContext` → `null`, возвращает `null`.
  - **Uniform-имена:** каждый ключ `SkyUniforms`, кроме `thunder`, встречается в `FRAGMENT_SRC` как `u` + PascalCase. `thunder` шейдеру не передаётся: при `cur.thunder > 0.5` renderer сам зажигает `uFlash` — импульс 0 → 1 → 0 за 0.3 с, следующий через `nextFlashDelay`.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: Реализовать `shader.ts`** по слоям §6.4:
  - Шум: value noise на хэше `fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453)`.
  - Облака: fbm `uOctaves` октав, искажение `p + 0.6 * fbm(p + t)`.
  - Солнце: диск `smoothstep`, свечение `exp(−d * 6)`; гало — кольцо радиусом 0.22 высоты экрана с радужным ободком низкой интенсивности.
  - Дождь: 3 слоя наклонных штрихов `fract` по повёрнутым координатам.
  - Снег: 3 слоя точек с `sin`-покачиванием.
  - Капли на стекле: сетка 8×14, случайные ячейки, смещение UV под линзой.
  - Ограничение яркости последним шагом: `if (uv.y > uSunZone) col *= min(1.0, uMaxLuma / max(luma(col), 1e-4))`, где `luma` — линейная относительная яркость.
- [ ] **Step 4: Реализовать `renderer.ts`.**
  - Один полноэкранный треугольник.
  - Размер canvas = CSS-размер × `quality.scale`.
  - Среднее время кадра — скользящее за 60 кадров.
  - Слушатель `webglcontextlost` → `stop()` и `onLost()`.
- [ ] **Step 5: PASS**
- [ ] **Step 6: Ручная проверка шейдера:** временная страница не нужна — в Task 21 небо видно в `npm run dev`; здесь достаточно, что `createRenderer` в Playwright-Chromium (SwiftShader) не пишет `warn` — проверяется e2e в Task 21.
- [ ] **Step 7: Commit** — `feat: add procedural sky shader and renderer`

### Task 21: `SkyCanvas`, подключение, удаление `SkyLayer`

**Files:**
- Create: `src/app/sky/SkyCanvas.tsx`
- Modify: `src/app/UvGoApp.tsx` (`lazy(() => import('./sky/SkyCanvas'))` вместо `SkyLayer`; передать состояния неба Today и Tomorrow и `progress` из `DayPager`)
- Modify: `src/app/hooks/useSkyRef.ts` — `useSky` дополнительно возвращает небо второго дня: `useSkyPair(state, evaluation, now): { today: SkyState; tomorrow: SkyState }`. Логика `refFor` для каждого дня та же; `selectedHour` применяется только к активному дню.
- Modify: `src/styles/global.css` — удалить `.sky-layer`, `.sky-phase*`, `.sky-glow`, `.sky-moon`, `.sky-veil`, `.sky-heat`, `.sky-drop`, `.sky-flake`, `.sky-wind`, `.sky-flash`, их `@keyframes` и `--sky-glow-*`/`--sky-veil-*`/`--sky-flash-*`/`--sky-moon-*`/`--sky-rain`/`--sky-snow`/`--sky-streak`/`--sky-shimmer`; добавить `.sky-canvas` (fixed, inset 0, z-index −1, `width: 100%; height: 100%`, `opacity` 0 → 1 за 400 мс по `[data-ready]`); `.glass { transition: background-color 0.6s }`
- Delete: `src/app/components/SkyLayer.tsx`, `src/app/__tests__/sky.test.tsx` (содержимое про частицы и вуали), `src/app/__tests__/skyApp.test.tsx` → переписать как `skyCanvas.test.tsx`
- Modify: `scripts/check-bundle.mjs` — комментарий «lazy SkyLayer» → «lazy SkyCanvas»
- Test: `src/app/__tests__/skyCanvas.test.tsx`, e2e `e2e/app.spec.ts`

**Interfaces:**
- Consumes: `createRenderer`, `SkyRenderer` (Task 20); `skyUniforms`, `mixUniforms`, `glassTint` (Task 19); `progress: MotionValue<number>` (Task 18)
- Produces: `default function SkyCanvas(props: { today: SkyState; tomorrow: SkyState; progress: MotionValue<number>; reducedMotion: boolean })`
  - цель рендера — `mixUniforms(skyUniforms(today), skyUniforms(tomorrow), progress.get())`, обновляется по `progress.on('change')` и по смене пропсов;
  - `--glass-rgb`/`--glass-alpha` пишутся в `document.documentElement.style` из `glassTint` цели при смене дня или состояния (не на каждый кадр свайпа: при `progress` 0 или 1);
  - при старте ждёт `requestIdleCallback` (фолбэк `setTimeout(start, 200)`);
  - после первого кадра — `data-ready` на canvas и `data-sky-live` на `<html>`;
  - при `null` от `createRenderer` или `onLost`: canvas удаляется, `style.removeProperty('--glass-rgb' | '--glass-alpha')`, `data-sky-live` снимается.

- [ ] **Step 1: Тест `skyCanvas.test.tsx`** (jsdom: `getContext` возвращает `null`)
  - После idle-таймера нет `canvas`, нет `data-sky-live`, нет inline `--glass-*` на `<html>`, нет исключений, `console.warn` вызван ≤ 1 раза.
  - **Потеря контекста** *(Review Focus 5)*: `vi.mock('../sky/renderer')`, `createRenderer` возвращает фейковый `SkyRenderer` и сохраняет `opts.onLost`.
    - После старта на `<html>` выставлены `--glass-rgb` и `data-sky-live`.
    - Вызов `onLost()` → canvas удалён, inline `--glass-*` сняты, `data-sky-live` снят, `destroy` вызван.
  - **Смена дня:** `setTarget` вызван с `skyUniforms(tomorrow)` после ререндера с `progress.set(1)`.
- [ ] **Step 2: FAIL → Step 3: реализовать, удалить старое → Step 4: PASS**
- [ ] **Step 5: e2e** в `app.spec.ts`:
  - после результата `locator('canvas.sky-canvas')` получает `data-ready`;
  - `page.on('console')` не видит `warn`/`error` от неба;
  - при `emulateMedia({ reducedMotion: 'reduce' })` canvas тоже `data-ready` (один кадр).
- [ ] **Step 6:** `npm test && npm run lint && npm run check && npm run test:e2e && npm run build && npm run check:bundle` — PASS. Записать вес ленивого чанка `SkyCanvas` из вывода `check:bundle` (ожидание 5–7 KB gzip).
- [ ] **Step 7: Ручной просмотр** `npm run dev` на 390×844 и 1280×800 для фикстур Лиссабона (ясно) и `new-york.json`. Сравнить с `docs/samples/ios1.jpeg`, `ios4.jpeg`. Подкрутить константы шейдера без изменения интерфейсов.
- [ ] **Step 8: Commit** — `feat: render the live sky with WebGL, drop the CSS particle sky`

---

## Этап 5. Статьи и 404

### Task 22: Статьи, шкала UV, 404

**Files:**
- Modify: `src/components/ArticleLayout.astro`, `src/components/UvScaleTable.astro`, `src/pages/404.astro`, `src/styles/global.css` (`.article-prose a` → белый с подчёркиванием `white/60`; CSS-свечение солнца `html::after` для страниц без приложения: `radial-gradient(circle at 70% 8%, rgb(255 236 180 / 0.35), transparent 40%)`, скрыто при `data-sky-live`)
- Test: `src/test/content.test.ts` (если опирается на классы — обновить), e2e a11y

**Interfaces:** нет новых.

- [ ] **Step 1: Статья.**
  - `<article>` — `.glass rounded-[22px]`.
  - TL;DR — внутренняя плашка `bg-white/8 rounded-xl` без `border`.
  - Кнопка «Find your best time to go outside» — белая «таблетка» с тёмным текстом (`bg-white text-black/85 rounded-full`).
  - Ссылки — белые подчёркнутые.
- [ ] **Step 2: `UvScaleTable`** — строки 44px с разделителями `white/15`, цветная точка категории UV и подпись (не только цвет).
- [ ] **Step 3: 404** — та же стеклянная карточка и кнопка-«таблетка».
- [ ] **Step 4:** `npm test && npm run test:e2e && npm run build && npm run check:bundle` — PASS; JS статей ≤ 2 000 B.
- [ ] **Step 5: Commit** — `feat: restyle articles and 404 on the static sky`

---

## Этап 6. Документация и финальная проверка

### Task 23: README, OG-картинки, финальный прогон

**Files:**
- Modify: `README.md`, `scripts/make-og.mjs`, `public/og/*.png`

**Interfaces:** нет.

- [ ] **Step 1: `scripts/make-og.mjs`.** Шаблон на новую палитру: дневной градиент `SKY_PALETTE.day`, стеклянная карточка, белый текст. Прочитать цвета из `src/styles/global.css` (переменные `--sky-day`, verdict-цвета), как сейчас. Запустить `node scripts/make-og.mjs`, проверить 4 PNG глазами.
- [ ] **Step 2: README.**
  - Таблица Stack: строка «Animation» с WebGL-небом.
  - Раздел «Motion decisions» переписать под новое (8 пунктов):
    1. `LazyMotion`;
    2. сворачивание героя;
    3. «заезд» карточек и флаг `CARD_TUCK_CLIP`;
    4. `NumericRoll`;
    5. первая хореография с числами `labelVisibleAt()` и `totalDuration()` из `choreography.ts`;
    6. WebGL-небо (вес чанка, адаптивное качество, откат);
    7. шторки и пейджер;
    8. reduced motion.
  - Убрать упоминания темы, `ThemeToggle`, view transition, поисковой рамки, `useCountUp`.
  - Таблица JS — новые цифры из `npm run check:bundle`.
  - Lighthouse — перезапустить `npx lhci autorun` и обновить таблицу.
  - В «Frame rate» оставить «pending, author measurement» и добавить пункт про решение по `CARD_TUCK_CLIP`.
  - Скриншот/GIF остаётся TODO автора.
- [ ] **Step 3: Финальный прогон:** `npm run lint && npm run check && npm test && npm run test:e2e && npm run build && npm run check:bundle && npx lhci autorun` — всё PASS; Lighthouse Accessibility 100 на всех страницах.
- [ ] **Step 4: Commit** — `docs: describe the iOS-style redesign, regenerate OG images`
