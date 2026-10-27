# UV GO — техническое задание

**Статус:** на ревью автора
**Дата:** 2026-10-27
**Источники:** `IDEA.md` (продуктовая спецификация), `.agents/product-marketing.md` v4 (позиционирование, аудитория, голос)

---

## 1. Цель и контекст

UV GO — собственный проект автора, у него два слоя:

1. **Продукт.** Сайт с веб-приложением, которое отвечает на один вопрос: *в какое время из моего свободного окна лучше всего выйти на улицу и что взять с собой*. Функционал строго по `IDEA.md`.
2. **Портфолио-кейс (главная цель).** Флагманский motion-кейс для фриланс-бирж: показать, что автор делает красивые сайты с насыщенной анимацией и при этом быстрые, рабочие и доступные.

**Главное правило motion:** анимация помогает понять ответ и не прячет его. Если анимация мешает за пару секунд увидеть «когда выходить», это баг.

Автор — программист, не моушн-дизайнер. Основа анимаций — код (SVG + Motion). Lottie используется, только если он действительно к месту (см. 10.9). Собственные Lottie-ассеты делаются с помощью AI-инструментов.

## 2. Scope

**В scope v1:**
- приложение UV GO (остров на главной странице): локация, ввод, скоринг, карточка-вердикт, таймлайн дня, чек-лист;
- «живое небо» — фон, зависящий от времени суток и погоды;
- светлая и тёмная темы;
- контентные страницы: `/uv-index`, `/uv-risks`, `/sun-protection`;
- на главной секции «How it works» и FAQ;
- техническое SEO;
- README с AI usage note, live link, открытый репозиторий.

**Вне scope:**
- login, backend, база данных, платежи, уведомления, нативные приложения (из `IDEA.md`);
- рантайм-сервер, API routes, SSR по запросу (сайт полностью статический);
- i18n / RU-версия (структура роутов не должна мешать добавить `/ru/` позже);
- аналитика;
- многодневный прогноз (только Today / Tomorrow);
- ассеты кейса для бирж (обложка, видео, GIF, тексты EN/RU) — отдельная задача после релиза.

## 3. Стек и платформа

| Область | Решение |
|---|---|
| Фреймворк сайта | Astro, последняя стабильная major-версия на момент старта, `output: 'static'` |
| Приложение | React 19 как один Astro-остров (`@astrojs/react`) |
| Анимация | Motion (пакет `motion`, импорт из `motion/react`; бывший Framer Motion), через `LazyMotion` + `m`-компоненты |
| Lottie | `@lottiefiles/dotlottie-react`, только если Lottie прошёл проверку на уместность (10.9), загрузка ленивая |
| Стили | Tailwind CSS v4 (`@tailwindcss/vite`), токены — CSS-переменные |
| Контент | `@astrojs/mdx`, content collections |
| SEO | `@astrojs/sitemap`, JSON-LD руками |
| Язык | TypeScript strict |
| Тесты | Vitest, React Testing Library, Playwright |
| Качество | ESLint, Prettier, `astro check` |
| CI / хостинг | GitHub Actions; Vercel (статическая сборка, превью-деплои) |
| Данные | Open-Meteo Forecast API и Geocoding API (без ключа) |

Версии зависимостей фиксируются в `package.json` и lock-файле.

В README и в кейсе библиотека называется «Motion (Framer Motion)», чтобы её находили по обоим запросам.

## 4. Карта сайта

| URL | Содержимое | JS |
|---|---|---|
| `/` | Hero (H1), остров приложения, How it works, FAQ | остров приложения + inline-скрипт темы |
| `/uv-index` | Статья: что такое UV-индекс | только inline-скрипт темы и неба |
| `/uv-risks` | Статья: риски UV | то же |
| `/sun-protection` | Статья: как защищаться | то же |
| `/404` | Страница «not found» со ссылкой на главную | то же |

**Хедер (на всех страницах):** логотип UV GO (ссылка на `/`), ссылки «UV Index», «Risks», «Protection», переключатель темы.

**Футер (на всех страницах):**
- «Weather data by Open-Meteo.com» со ссылкой (обязательная атрибуция по CC BY 4.0);
- ссылка на GitHub-репозиторий;
- «Designed & built by {author.name}» со ссылкой на `author.url` (настраивается в `src/site.config.ts`, по умолчанию GitHub-профиль автора);
- дисклеймер «UV GO gives general guidance, not medical advice.»

**Hero на главной** занимает не больше ~30% высоты экрана на мобильном, чтобы приложение было в первом экране. H1 (черновик): «Know the best time to go outside». Hero — LCP-элемент, и это текст, а не картинка.

## 5. Приложение: функциональные требования

Все строки интерфейса на английском. Ниже FR — требование, AC — критерий приёмки.

### FR-1. Локация

- Запрос геолокации при первом визите **не появляется** сам. Показываются кнопка «Use my location» и поле поиска города.
- «Use my location» → `navigator.geolocation.getCurrentPosition` (timeout 10 с). Название места для отображения: «Your location» (обратный геокодинг не делаем).
- Поиск: Open-Meteo Geocoding, debounce 300 мс, запрос от 2 символов, до 5 результатов в формате «Name, Admin1, Country». Управление с клавиатуры (стрелки, Enter, Esc), паттерн ARIA combobox.
- Выбранная локация сохраняется в localStorage. При повторном визите прогноз загружается сразу.
- Компактный вид после выбора: «📍 Lisbon, Portugal · Change».

**AC:**
- геолокация не запрашивается без нажатия кнопки;
- отказ или ошибка геолокации → сообщение «Can't get your location. Search a city instead.», фокус переходит в поле поиска;
- поиск без результатов → «No cities found»;
- после перезагрузки страницы последняя локация восстанавливается.

### FR-2. Ввод

| Поле | Значения | По умолчанию | Хранится |
|---|---|---|---|
| Day | Today / Tomorrow | Today | нет |
| Free time | начало 00–23, конец 01–24, шаг 1 час, конец > начала | 13:00–19:00 | да |
| Duration | 30 min / 1 h / 2 h / 3 h | 1 h | да |
| Activity | Active / Relaxed / Long in the sun | Relaxed | да |

- Кнопки «Calculate» нет: результат пересчитывается сразу при любом изменении.
- Смена ввода не делает новых сетевых запросов, пересчёт только локальный.
- Free time — трек на 24 часа с двумя перетаскиваемыми ручками (см. 10.5). Ручки не могут пересечься, минимальное окно — 1 час.
- **Автопереход на Tomorrow.** Если при загрузке прогноза (выбор локации или открытие приложения) для Today нет окна по причине `past` (см. 6.4), день сам переключается на Tomorrow и показывается пометка «Your free time today has passed — showing tomorrow». Если пользователь после этого сам выберет Today, автопереход в этой сессии больше не срабатывает, и показывается пустое состояние `past`.

**AC:**
- любое изменение ввода обновляет результат без сетевых запросов;
- нельзя задать конец free time раньше начала или равным ему;
- в 20:00 при free time 13:00–19:00 приложение открывается на Tomorrow с пометкой;
- после ручного возврата на Today показывается «No time left today», без повторного автоперехода.

### FR-3. Карточка-вердикт (ResultCard)

Содержит:
- лучшее окно: «17:00–18:00»; для 30 min — «17:00–17:30»;
- вердикт: **Good** (green) / **OK with protection** (yellow) / **Not recommended** (red), обозначенный текстом, цветом и иконкой;
- причину одной строкой (см. 6.5);
- раскрывающийся блок «Why this time?»: средний score окна (1 знак после запятой) и разбивка баллов по факторам;
- чек-лист «What to take» (FR-5).

**AC:**
- вердикт понятен без цвета (есть текст и иконка);
- лучшее время читается не позже 1.0 с после прихода данных (10.1);
- если окна нет, вместо карточки показывается пустое состояние (FR-6).

### FR-4. Таймлайн дня (DayArcTimeline)

- Дуга солнца от рассвета до заката, под ней полоса из 24 часов выбранного дня.
- Каждый час окрашен в цвет своего вердикта (баллы часа → округление → интервалы 6.3). Тёмные часы показаны как «night» (нейтральный ночной цвет). Прошедшие часы (Today) приглушены, но цвет сохраняют.
- Free time подсвечен на полосе, лучшее окно обведено рамкой.
- **Выбор часа:** тап, клик, стрелки на клавиатуре или drag полосы (на мобильном) открывают HourDetails: UV, rain %, feels like, wind и баллы по факторам. На дуге солнце встаёт в позицию выбранного часа.
- Закрытие HourDetails (крестик, Esc, тап вне блока) возвращает фокус неба на лучшее окно (9.3).

**AC:**
- 24 часа в цветах, совпадающих с расчётом domain;
- полоса доступна с клавиатуры: `role="slider"` (0–23), стрелки меняют час, `aria-valuetext` вида «15:00, UV 4, OK with protection»;
- HourDetails показывает «no data» для пропущенных значений.

### FR-5. What to take

Пункты в фиксированном порядке: Sunscreen, Hat & sunglasses, Rain jacket, Water, Warm layer. Правила в 6.6. Если пунктов нет: «Nothing extra needed.»

**AC:** набор пунктов совпадает с правилами 6.6 для окна-результата.

### FR-6. Состояния

| Состояние | Когда | Текст (черновик) |
|---|---|---|
| `no-location` | локация не выбрана | «Where are you heading out?» + LocationPicker; дуга таймлайна серая |
| `loading` | загружается прогноз | анимация «солнце выглядывает» (10.2), карточка-скелетон того же размера |
| `result` | лучшее окно найдено | ResultCard + таймлайн |
| `empty: too-short` | free time короче duration | «Your free time is shorter than {duration}. Extend it or pick a shorter outing.» |
| `empty: dark` | в free time нет полностью светлого окна нужной длины | «It's dark during your free time. Try earlier hours.» |
| `empty: past` | (Today) все подходящие окна уже прошли | «No time left today.» + кнопка «Show tomorrow» |
| `error` | ошибка сети или API | «Couldn't load the forecast.» + «Try again» |

**AC:**
- переходы между состояниями не сдвигают лейаут (CLS ≤ 0.05);
- каждое пустое состояние даёт понятный следующий шаг.

### FR-7. Лейаут

- **Мобильный (< 1024px)**, одна колонка: Location → ResultCard → Timeline → Inputs («Adjust your plan»).
- **Sticky mini-result:** когда ResultCard уходит за экран, сверху появляется компактная плашка «17:00–18:00 · Good» (через `AnimatePresence`). Тап по ней прокручивает к карточке. Так при изменении ввода внизу экрана ответ остаётся на виду.
- **Десктоп (≥ 1024px)**, две колонки:
  - сверху на всю ширину Location;
  - слева ResultCard и Inputs;
  - справа крупный таймлайн и HourDetails.
- Hover-состояния только на устройствах с `hover: hover`.

## 6. Правила скоринга

Все числа и пороги — только в `src/domain/rules.config.ts`. В коде скоринга нет «магических чисел».

### 6.1. Баллы часа (меньше — лучше)

| Фактор | Правило |
|---|---|
| UV | `uv` округляется до целого (half up), затем 0–2 → 0; 3–5 → 2; 6–7 → 4; 8+ → 6. Для **Long in the sun** баллы UV × 1.5 (0 / 3 / 6 / 9) |
| Rain | `precipitation_probability` 30–59% → +2; 60%+ → +5 |
| Heat | `apparent_temperature` ≥ 30°C → +3 (для **Active** +5) |
| Cold | `apparent_temperature` < 0°C → +2 |
| Wind | `wind_speed_10m` ≥ 40 km/h → +3 |

- Score часа — сумма баллов факторов.
- Час с `is_day = 0` — тёмный, в окна не входит. Если `is_day = null`, час тоже считается тёмным.
- Если значение фактора `null`, фактор даёт 0 баллов и помечается `noData` (в HourDetails — «no data»).
- Округление UV: `Math.round` (5.45 → 5; 5.5 → 6). Округлённое значение используется и для баллов, и для отображения, и для чек-листа.

### 6.2. Окна-кандидаты

- Длина окна в часах: 30 min → 1; 1 h → 1; 2 h → 2; 3 h → 3.
- Окно — подряд идущие целые часы `[start, start + n)`, где `freeTime.start ≤ start` и `start + n ≤ freeTime.end` (конец free time не входит: при 13:00–19:00 кандидаты — часы 13…18).
- Все часы окна светлые.
- Для Today начало окна не раньше `nowLocal`, округлённого вверх до целого часа (14:10 → 15:00; 14:00 → 14:00).

### 6.3. Оценка окна и вердикт

- Window score — среднее арифметическое score часов окна.
- Для вердикта score округляется до целого (half up): 0–2 → **green / Good**; 3–5 → **yellow / OK with protection**; 6+ → **red / Not recommended**. Те же интервалы применяются к score отдельного часа для цвета на таймлайне.
- Точное значение показывается в «Why this time?» с 1 знаком после запятой.

### 6.4. Выбор лучшего окна и причина пустого результата

Лучшее окно выбирается по порядку критериев:
1. минимальный window score;
2. при равенстве — минимальный максимум score по часам окна;
3. при равенстве — более раннее начало.

Пустой результат определяется последовательной фильтрацией:
1. `W0` — все окна по 6.2 без учёта темноты и «сейчас». Пусто → `too-short`.
2. `W1` — окна из `W0`, где все часы светлые. Пусто → `dark`.
3. `W2` — окна из `W1` с учётом «сейчас» (только Today). Пусто → `past`.

### 6.5. Причина (reason)

- Для каждого фактора (uv, rain, heat, cold, wind) считается сумма его баллов по часам окна.
- Ведущий фактор — с наибольшей суммой. При равенстве — по приоритету из конфига: uv > rain > heat > wind > cold.
- Если у второго по величине фактора сумма > 0, он добавляется через « · ».
- Шаблоны (в конфиге):

| Фактор | Шаблон | Значение |
|---|---|---|
| uv (3–5) | `UV {uv}, use sunscreen` | максимум округлённого UV в окне |
| uv (6–7) | `UV {uv}, sunscreen and a hat` | то же |
| uv (8+) | `UV {uv}, limit time in the sun` | то же |
| rain | `{rain}% chance of rain` | максимум |
| heat | `Feels like {t}°C` | максимум, округлён до целого |
| cold | `Feels like {t}°C` | минимум, округлён до целого |
| wind | `Wind up to {w} km/h` | максимум, округлён до целого |
| нет баллов | `Low UV, low chance of rain` | — |

- Запрещённые слова в шаблонах: «safe», «perfect».

### 6.6. Чек-лист

Считается по часам окна-результата:

| Пункт | Условие |
|---|---|
| Sunscreen | max округлённого UV ≥ 3 |
| Hat & sunglasses | max округлённого UV ≥ 6 |
| Rain jacket | max rain ≥ 30% |
| Water | activity = Active **или** max feels like ≥ 25°C |
| Warm layer | min feels like < 5°C |

Для температуры используется feels like (`apparent_temperature`), как и в скоринге. В брифе здесь сказано просто «°C», это решение зафиксировано в конфиге.

### 6.7. Форма конфига (ориентир)

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

Секция «How it works» на главной импортирует этот же конфиг на этапе сборки и строит из него таблицы правил. Документация не может разойтись с логикой.

## 7. Данные

### 7.1. Forecast

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &hourly=uv_index,precipitation_probability,apparent_temperature,wind_speed_10m,is_day,weather_code,cloud_cover
  &daily=sunrise,sunset
  &timezone=auto
  &forecast_days=2
```

Единицы по умолчанию: °C, km/h. Используются поля ответа `utc_offset_seconds`, `timezone`, `hourly.*`, `daily.*`.

Маппинг в `DayForecast[2]`: индексы 0–23 → Today, 24–47 → Tomorrow (в часовом поясе локации).

### 7.2. Geocoding

```
GET https://geocoding-api.open-meteo.com/v1/search?name={query}&count=5&language=en&format=json
```

Из `results[]` используются поля `name`, `admin1`, `country`, `latitude`, `longitude`.

### 7.3. Время

- Всё время — в часовом поясе **локации**, а не браузера.
- `nowLocal` = `Date.now() + utc_offset_seconds × 1000`, интерпретируется как UTC-время, откуда берутся дата, час и минута. Вычисляется в `src/data/` и передаётся в `evaluate` параметром.
- Тесты не зависят от часового пояса машины.

### 7.4. Кэш и хранение

- Прогноз кэшируется в памяти по ключу `lat,lon` (округлённым до 2 знаков) на время сессии. Повторный выбор той же локации не делает запрос.
- localStorage (каждое чтение и запись в `try/catch`; если хранилище недоступно, приложение работает без запоминания):
  - `uvgo:location` — `{ name, admin1?, country?, lat, lon }`;
  - `uvgo:inputs` — `{ freeTime, duration, activity }`;
  - `uvgo:theme` — `'light' | 'dark'` (только при ручном выборе).
- Сетевые запросы отменяются через `AbortController` при смене локации или размонтировании.

## 8. Архитектура

### 8.1. Структура

```
src/
  site.config.ts          author.name, author.url, site URL, repo URL
  domain/                 чистый TypeScript, без React и DOM
    rules.config.ts
    types.ts
    scoring.ts            scoreHour
    windows.ts            buildWindows, pickBestWindow, emptyReason
    reason.ts             buildReason
    checklist.ts          buildChecklist
    sky.ts                skyState (9.3)
    evaluate.ts           evaluate — фасад для UI
  data/
    openMeteo.ts          fetchForecast → { days: DayForecast[2], utcOffsetSeconds, timezone }
    geocoding.ts          searchCities
    time.ts               nowLocal
    storage.ts            load/save с try/catch
  app/
    UvGoApp.tsx           корень острова, useReducer
    state.ts              reducer, actions
    hooks/                useForecast, useGeolocation, useCitySearch, useSelectedHour
    components/           LocationPicker, CitySearch, DayToggle, FreeTimePicker, DurationPicker,
                          ActivityPicker, DayArcTimeline, HourDetails, ResultCard, MiniResult,
                          WhatToTake, SkyLayer, EmptyState, ErrorState, LoadingSun
    icons/                SVG-иконки с анимациями в коде (чек-лист, вердикт)
  motion/
    tokens.ts             springs, durations, easings
    variants.ts
    MotionProvider.tsx    LazyMotion + MotionConfig reducedMotion="user"
  components/             Astro: Header, Footer, ThemeToggle, Hero, HowItWorks, Faq, ArticleLayout, SeoHead
  content/articles/       uv-index.mdx, uv-risks.mdx, sun-protection.mdx
  pages/                  index.astro, [slug].astro, 404.astro
  styles/                 global.css (Tailwind, @theme, токены тем и неба)
```

ThemeToggle — Astro-компонент с ванильным скриптом, а не React-остров: React не должен грузиться на страницах статей.

### 8.2. Ключевые типы

```ts
type Activity = 'active' | 'relaxed' | 'long-sun';
type DurationMin = 30 | 60 | 120 | 180;
type Verdict = 'green' | 'yellow' | 'red';
type Factor = 'uv' | 'rain' | 'heat' | 'cold' | 'wind';

interface HourData {
  time: string;            // 'YYYY-MM-DDTHH:00', локальное время локации
  hour: number;            // 0–23
  uv: number | null;
  rainProb: number | null;
  feelsLike: number | null;
  windKmh: number | null;
  isDay: boolean;          // false, если is_day = 0 или null
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
  score: number;           // точное среднее
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

`now = null` для Tomorrow.

### 8.3. Поток данных

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

Состояние острова — один `useReducer`: `location`, `inputs`, `forecast` (`idle | loading | success | error`), `selectedHour`, `autoSwitchDisabled`. Глобальные сторы не нужны.

### 8.4. Ошибки

| Ситуация | Поведение |
|---|---|
| Сеть / HTTP ≠ 2xx / невалидный JSON | состояние `error`, «Try again» повторяет запрос |
| Geocoding: сеть | под полем поиска «Search is unavailable. Try again.» |
| Geolocation: denied / timeout / unavailable | сообщение FR-1, фокус в поиск |
| Пропуски в hourly | правила 6.1 (`null` → 0 баллов, `noData`) |
| В ответе меньше 48 часов | недостающий день → состояние `error` |
| localStorage недоступен | работа без запоминания, без ошибок в консоли пользователя |

## 9. Визуальная система

### 9.1. Темы

- Светлая и тёмная. По умолчанию — системная (`prefers-color-scheme`). Ручной выбор через ThemeToggle сохраняется в `uvgo:theme` и важнее системного.
- Inline-скрипт (`is:inline`) в `<head>` до первой отрисовки ставит `data-theme` на `<html>`, без мигания. Работает на всех страницах.
- Все цвета — CSS-переменные в наборах `[data-theme="light"]` и `[data-theme="dark"]`. В Tailwind v4 вариант `dark:` привязан к атрибуту через `@custom-variant`.
- Цвета вердиктов, часов таймлайна и ночных часов подбираются отдельно для каждой темы с контрастом ≥ AA (текст 4.5:1, крупные элементы и графика 3:1). Жёлтый на светлом фоне проверяется отдельно.

### 9.2. Тема и небо — независимые слои

- Тема управляет поверхностями (карточки, панели, хедер) и текстом.
- Небо управляет только фоном. Интерфейс не перекрашивается при скрабе таймлайна.
- У каждой фазы неба есть вариант под обе темы: в тёмной глубже и приглушённее.
- Контент лежит на поверхностях с непрозрачным или полупрозрачным фоном. `backdrop-filter` на мобильном не используется. Контраст текста ≥ AA при любом небе.

### 9.3. «Живое небо» (SkyLayer)

`skyState(refHour, day)` — чистая функция в `src/domain/sky.ts`. Возвращает `{ phase, weather, uvGlow, heat, wind, sunPosition }`:

- **phase** по `sunrise` / `sunset` дня. Смещения (минуты) в `sky.config`:
  - `night` — раньше `sunrise − 45` или позже `sunset + 45`;
  - `dawn` — `sunrise ± 45`;
  - `morning` — от `sunrise + 45` до `solarNoon − 120`, где `solarNoon` — середина между `sunrise` и `sunset`;
  - `day` — от `solarNoon − 120` до `sunset − 90`;
  - `golden` — от `sunset − 90` до `sunset − 15`;
  - `dusk` — от `sunset − 15` до `sunset + 45`.
- **weather** по WMO `weather_code`:

| Группа | Коды |
|---|---|
| `clear` | 0, 1 |
| `partly` | 2 |
| `overcast` | 3 |
| `fog` | 45, 48 |
| `rain` | 51–67, 80–82 |
| `snow` | 71–77, 85–86 |
| `thunder` | 95–99 |

  Если `weather_code = null`, используется `cloud_cover`: < 25 → clear, < 70 → partly, иначе overcast.
- **uvGlow** 0…1 из округлённого UV (0 → 0, 11+ → 1).
- **heat** — feels like ≥ 30°C. **wind** — ≥ 40 km/h.
- **sunPosition** 0…1 — доля пути между рассветом и закатом. Та же формула, что для солнца на дуге таймлайна.

**Опорный час (refHour):**
- локация не выбрана → текущее время устройства, погода `clear`;
- есть результат → начало лучшего окна;
- нет результата → текущий час (Today) или 12:00 (Tomorrow);
- открыт HourDetails или пользователь тянет таймлайн → выбранный час.

**Визуальные правила:**
- Для каждой фазы готовый градиентный слой. Смена фазы — кроссфейд двух соседних слоёв по `opacity`. Градиент не интерполируется.
- Погода: overcast и fog — слой-вуаль, приглушающий фазу; rain — капли; snow — снежинки; thunder — редкие вспышки (не чаще раза в 8 с, отключаются при reduced motion).
- Солнечное свечение — радиальный слой, `opacity` зависит от `uvGlow`. Ночью вместо солнца луна.
- heat — лёгкое марево (смещение текстуры через `transform`, без SVG-фильтров). wind — дрейфующие линии.
- Частицы двигаются только через `transform`. Количество ограничено: мобильный ≤ 40, десктоп ≤ 80.
- Страницы статей: статичное небо фазы по времени устройства (inline-скрипт ставит `data-sky-phase`), без погоды и без JS-анимации.

## 10. Motion-спецификация

### 10.1. Принципы и бюджеты

- Анимируются только `transform` и `opacity`. Исключение — цвет маленьких элементов (иконки, бейдж вердикта, ячейки часов).
- `LazyMotion` с `domMax` (нужен для layout и drag), только `m`-компоненты.
- Токены (`src/motion/tokens.ts`): springs `snappy` (быстрые контролы), `gentle` (карточки, рамка), `bouncy` (защёлкивание); длительности 150 / 300 / 600 мс; один общий easing для tween. Конкретные значения подбираются на этапе 3 и фиксируются в токенах.
- Лучшее время читается **≤ 1.0 с** после прихода данных. Первая хореография целиком **≤ 1.8 с**.
- Ни одна анимация не блокирует ввод.

### 10.2. Загрузка

LoadingSun: солнце «выглядывает» из-за линии горизонта и покачивается. Карточка-скелетон того же размера, что ResultCard. Кандидат в Lottie №1 (10.9). Базовая реализация — SVG в коде.

### 10.3. Первый результат (после выбора локации или смены дня)

1. Дуга дня рисуется: SVG `pathLength` 0 → 1.
2. Ячейки часов появляются вдоль полосы со stagger, цвета заливаются.
3. Рамка «поиска» скользит по free time на spring и защёлкивается на лучшем окне с небольшим overshoot.
4. Метка времени через `layoutId` перетекает из рамки в заголовок ResultCard. Карточка раскрывается: бейдж вердикта меняет цвет, счётчик UV досчитывает до значения, пункты чек-листа появляются по очереди.
5. Небо кроссфейдится к опорному часу.

Шаги 2–4 частично перекрываются, чтобы уложиться в бюджет 10.1.

### 10.4. Пересчёт при смене ввода

Полной хореографии нет:
- рамка перелетает к новому лучшему окну на spring;
- цвета часов морфятся;
- значения карточки кроссфейдятся или досчитываются;
- пункты чек-листа входят и выходят через `AnimatePresence`;
- смена вердикта — морфинг цвета и иконки.

### 10.5. Контролы ввода

- Day, Duration, Activity — сегментированные контролы с общим индикатором (`layoutId`), spring `snappy`.
- Free time — трек на 24 часа, две ручки с drag и прилипанием к часу. Подсветка free time на таймлайне обновляется синхронно.
- На всех нажатиях `whileTap` (scale ≈ 0.96). Hover только при `hover: hover`.

### 10.6. Таймлайн

- Мобильный: полоса часов с `drag="x"`, инерцией и прилипанием к часу. Выбранный час — по центру. Солнце едет по дуге, небо скрабится вслед (9.3).
- Десктоп: полоса видна целиком, клик и hover. При hover — лёгкий подъём ячейки.
- Клавиатура: стрелки двигают выбранный час с той же анимацией.

### 10.7. ResultCard, MiniResult, What to take

- «Why this time?» раскрывается через layout-анимацию, соседи сдвигаются без скачков.
- Иконка вердикта (sun / cloud-sun / rain) — SVG-морфинг в коде. Кандидат в Lottie №3.
- MiniResult въезжает сверху и уезжает обратно через `AnimatePresence`, когда карточка уходит за экран или возвращается (IntersectionObserver).
- У каждого пункта чек-листа своя SVG-микроанимация при появлении: тюбик крема сжимается, шляпа опускается, очки съезжают на место, дождевик раскрывается, капля падает в бутылку, складки тёплого слоя расправляются.

### 10.8. Тема и сайт

- ThemeToggle: SVG-морфинг солнце ↔ луна. Тема меняется через View Transitions API круговым раскрытием от кнопки. Без поддержки API или при reduced motion — мгновенно.
- Страницы сайта: проявление блоков при скролле на чистом CSS (`animation-timeline: view()` под `@supports`, иначе без анимации). JS на статьях не добавляется.

### 10.9. Lottie: проверка на уместность

Кандидаты: №1 LoadingSun, №2 капли дождя в небе, №3 иконка вердикта. Lottie берётся, только если выполнены **все** условия:
1. даёт то, что в коде сделать нерационально (сложная иллюстративная деформация, а не движение примитивов);
2. `.lottie` ≤ 30 KB;
3. грузится лениво и не входит в критический путь первого экрана;
4. приведён к палитре проекта и имеет варианты под обе темы (dotLottie theming или перекраска из кода);
5. есть статичный фолбэк (для reduced motion и до загрузки).

Иначе используется реализация в коде. Источник Lottie — генерация с помощью AI-инструментов или бесплатные ассеты LottieFiles с адаптацией. Происхождение каждого ассета указывается в README.

### 10.10. Reduced motion

`MotionConfig reducedMotion="user"` + хук `useReducedMotion` для кастомной логики. При `prefers-reduced-motion: reduce`:
- отключаются: отрисовка дуги, stagger, рамка «поиска», инерция drag (прилипание без броска), частицы и вспышки неба, View Transition темы;
- небо — статичный слой опорной фазы, смена фазы — кроссфейд ≤ 150 мс;
- счётчики сразу показывают итог;
- остаются только кроссфейды ≤ 150 мс;
- функционал полностью сохраняется.

## 11. Контент и SEO

### 11.1. Страницы

| URL | Title (черновик) | Интенты |
|---|---|---|
| `/` | Best Time to Go Outside Today — UV & Weather Planner | best time to go outside, uv index today, when is uv lowest |
| `/uv-index` | UV Index Explained: Scale, Colours and What Affects It | what is uv index, uv index scale |
| `/uv-risks` | UV Exposure Risks: Sunburn, Skin Ageing and Eyes | uv exposure risks, high uv index meaning |
| `/sun-protection` | How to Protect Yourself from UV | how to protect skin from sun, how often reapply sunscreen |

Description — 140–160 символов, уникальный для каждой страницы.

### 11.2. Статьи

Объём 800–1500 слов. Схема content collection: `title`, `description`, `publishedAt`, `updatedAt`, `sources: { title, url, publisher }[]`.

Структура каждой статьи:
1. H1;
2. блок TL;DR (3–4 пункта, ответ сразу);
3. H2-секции;
4. внутренние ссылки на две другие статьи;
5. CTA «Find your best time to go outside» → `/`;
6. «Sources»;
7. «Last updated {date}»;
8. дисклеймер.

Ориентировочные H2:
- **/uv-index:** What the UV index measures · The UV scale (таблица 0–11+ с цветами в палитре приложения) · Why UV peaks around midday · Season, latitude and altitude · Clouds, water, sand and snow · How UV GO uses the UV index.
- **/uv-risks:** Sunburn · Skin ageing · Skin cancer · Eye damage · Who is at higher risk (фототипы кожи, дети, высокогорье) · UV on cloudy days.
- **/sun-protection:** Timing your time outside · Sunscreen: SPF, amount, reapplying · Clothing and hats · Sunglasses · Shade · Putting it together: what to take (связь с чек-листом приложения).

### 11.3. Правила контента

- Без «safe», «perfect», медицинских обещаний и без «AI-powered».
- Любые цифры и утверждения о здоровье — только со ссылкой на источник. Допустимые источники: WHO, Cancer Council Australia, Skin Cancer Foundation, American Academy of Dermatology, NHS, US EPA.
- Дисклеймер на статьях и в FAQ: «UV GO gives general guidance, not medical advice. Talk to a healthcare professional about your skin.»
- Черновики пишутся с помощью ИИ, автор сверяет каждое утверждение с источником. Это указывается в AI usage note.
- Голос — по Brand Voice из `product-marketing.md`: прямой, тёплый, прозрачный.

### 11.4. Главная: How it works и FAQ

- **How it works:** 3 шага (location → your time → one answer) и таблицы правил, сгенерированные из `rules.config.ts`. Пояснение вердиктов и чек-листа.
- **FAQ** (на `<details>`, 8–10 вопросов):
  - How does UV GO pick the best time?
  - What do the colours mean?
  - Why are dark hours left out?
  - Where does the weather data come from?
  - Do you store my location?
  - At what UV index should I use sunscreen?
  - Why "feels like" instead of air temperature?
  - Can I check another city?
  - Is this medical advice?

### 11.5. Техническое SEO

- `SeoHead.astro`: title, description, canonical, Open Graph, Twitter Card. Для каждой страницы своя статичная OG-картинка 1200×630 (`public/og/*.png`).
- JSON-LD:
  - `/` — `WebApplication` (applicationCategory `UtilitiesApplication`, offers price 0) и `FAQPage`;
  - статьи — `Article` (`headline`, `datePublished`, `dateModified`, `author`) и `BreadcrumbList`.
- `sitemap.xml` (`@astrojs/sitemap`), `robots.txt` со ссылкой на sitemap.
- Семантичный HTML, один H1 на страницу, `lang="en"`.
- Шрифты свои, в woff2 (не больше 2 начертаний): preload основного, `font-display: swap`.
- Мета-теги верификации Search Console и Bing Webmaster: значения задаются в `site.config.ts`, пустые не выводятся.
- Адрес сайта — одно значение `site` в `astro.config`. v1 на `*.vercel.app`, переход на свой домен без правок кода.

## 12. Нефункциональные требования

### 12.1. Производительность

| Метрика | Порог |
|---|---|
| Lighthouse mobile Performance | `/` ≥ 90; статьи ≥ 95 |
| Lighthouse Accessibility | ≥ 95 на всех страницах |
| Lighthouse SEO | 100 |
| Lighthouse Best Practices | ≥ 95 |
| LCP / CLS / INP | ≤ 2.5 с / ≤ 0.05 / ≤ 200 мс |
| JS на `/` | ≤ 130 KB gzip суммарно |
| JS на статьях | ≤ 2 KB (inline-скрипты темы и неба) |
| Анимации | 60 fps при скрабе таймлайна и первой хореографии; нет long tasks > 50 мс во время анимаций |

FPS проверяется в Chrome DevTools (Performance, CPU throttling 4×) и на реальном Android-устройстве среднего класса. Результаты записываются в README.

### 12.2. Доступность

- Вся функциональность доступна с клавиатуры, фокус всегда виден.
- CitySearch — ARIA combobox. Ручки free time — `role="slider"` с `aria-valuetext="13:00"`. Таймлайн управляется стрелками.
- Результат объявляется через `aria-live="polite"`: «Best time 17:00–18:00, Good. UV 5, use sunscreen.»
- Вердикт и цвет часа никогда не передаются только цветом.
- Контраст ≥ AA в обеих темах при любой фазе неба.
- Тач-цели ≥ 44×44 px.
- Reduced motion — по 10.10.
- Декоративные слои (небо, частицы) скрыты от скринридеров (`aria-hidden`).

### 12.3. Браузеры

Последние 2 версии Chrome, Edge, Firefox, Safari; iOS Safari 16+; Android Chrome. Прогрессивные улучшения (View Transitions, `animation-timeline`) без поддержки отключаются без потери функциональности.

### 12.4. Приватность

Нет cookies, аналитики и сторонних скриптов. Координаты отправляются только в Open-Meteo. Данные пользователя хранятся только в localStorage браузера.

## 13. Тестирование и CI

**Unit (Vitest), `src/domain`:**
- UV: границы 2/3, 5/6, 7/8; округление 5.45 → 5, 5.5 → 6; множитель Long in the sun.
- Rain: 29/30/59/60, `null`.
- Feels like: 29.9/30, Active +5; −0.1/0.
- Wind: 39/40.
- Тёмные часы и `is_day = null`.
- Окна: границы free time (конец не включается), каждая длительность, «сейчас» в 14:00 и 14:10, Tomorrow без «сейчас».
- Пустые причины: `too-short` / `dark` / `past` и порядок их определения.
- Вердикт: округление window score (2.4 → green, 2.5 → yellow, 5.5 → red).
- Tie-break: оба уровня.
- Reason: ведущий фактор, второй фактор, приоритет при равенстве, нулевые баллы.
- Чек-лист: каждый пункт на границе.
- `skyState`: фазы на границах, маппинг WMO, фолбэк на `cloud_cover`.

**Data:**
- маппинг Open-Meteo по записанным JSON-фикстурам (`src/data/__fixtures__/`), включая `null` и отрицательный и положительный `utc_offset_seconds`;
- `nowLocal` при разных смещениях.

**Компоненты (Testing Library):**
- поиск → выбор города → результат показан;
- каждое пустое состояние;
- автопереход на Tomorrow и его отключение;
- reduced motion (рендер без ошибок, контент на месте).

**E2E smoke (Playwright):**
- вьюпорт 390×844, API замоканы;
- happy path: поиск → результат → смена duration → новый результат;
- отказ в геолокации;
- переключение темы сохраняется после перезагрузки.

**CI (GitHub Actions, на push и PR):**
- `lint` → `astro check` → `vitest run` → `playwright test` → `astro build`;
- превью-деплой Vercel на PR, продакшн-деплой из `main`.

## 14. Deliverables

1. Live link (Vercel).
2. Публичный GitHub-репозиторий, лицензия MIT.
3. README:
   - что это и live link, скриншот или GIF;
   - стек;
   - установка и скрипты (`npm i`, `npm run dev`, `test`, `build`);
   - архитектура (слои domain / data / app / site);
   - `rules.config.ts`: как менять правила;
   - motion-решения (ключевые анимации и зачем);
   - производительность и доступность: замеры Lighthouse и FPS;
   - происхождение Lottie-ассетов (если есть);
   - **AI usage note:** какие AI-инструменты использованы и для чего (код, Lottie, черновики текстов) и что проверено автором.

## 15. Этапы

Даты задаются в плане реализации.

| # | Этап | Результат |
|---|---|---|
| 1 | Фундамент | Каркас Astro + React + Tailwind + MDX, токены, темы без мигания, Header/Footer, CI, деплой на Vercel. Live-ссылка работает |
| 2 | Логика и данные | `rules.config.ts`, domain с полным покрытием тестами, клиенты Open-Meteo, `nowLocal`, хранение, минимальный UI без motion с работающим ответом на live-ссылке (аналог Milestone 1 из брифа) |
| 3 | Приложение и motion | Все компоненты FR-1…FR-7, хореография 10.x, «живое небо», reduced motion, решение по Lottie-кандидатам |
| 4 | Контент и SEO | 3 статьи, How it works, FAQ, SeoHead, JSON-LD, OG-картинки, sitemap, robots |
| 5 | Полировка и доказательства | Доступность, бюджеты 12.1, FPS на устройстве, E2E, README с замерами и AI usage note |

## 16. Журнал решений

| Решение | Альтернативы | Почему |
|---|---|---|
| Astro + React-остров (SSG) | Next.js SSG; Vite SPA; React Router prerender | SEO и контент без JS на статьях, Lighthouse ~100 на контенте; приложение — один остров |
| Только английский в v1 | EN + RU; EN-приложение + RU-статьи | Крупнейший рынок поиска, вдвое меньше контента; `/ru/` можно добавить позже |
| Ядро из 3 статей + FAQ | Хаб из 8–12 статей; только FAQ | Закрывает запрос про UV, риски и защиту, не превращая контент в отдельный проект |
| Today / Tomorrow с автопереходом | Только сегодня; 3–7 дней | Приложение полезно и вечером; многодневный прогноз — анти-персона |
| UV округляется до целого перед диапазонами | Полуоткрытые интервалы | Стандарт отображения UV (WHO); цифра в UI совпадает с баллами |
| Window score округляется для вердикта | Строгие интервалы по дробному значению | Нет «дыр» между интервалами брифа (2.5 и т.п.) |
| Feels like для чек-листа | `temperature_2m` | Согласованность со скорингом, без лишнего параметра |
| Motion в коде, Lottie только к месту | Lottie везде; без Lottie | Автор — программист; код даёт управление по данным, малый вес и единый стиль |
| Тема и небо — независимые слои | Тема следует небу | Предсказуемый интерфейс, нет перекраски при скрабе и смене города |
| Тап по часу с деталями | Только цвета | Поддерживает «прозрачные правила» |
| Без аналитики в v1 | Vercel Analytics и т.п. | Приватность, ноль сторонних скриптов |
