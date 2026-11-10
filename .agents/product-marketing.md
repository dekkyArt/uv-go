# Product Marketing Context

**Document version:** v4
**Last updated:** 2026-10-27

> **How to read this document.** UV GO is the author's own project, with no external client. The brief in `IDEA.md` serves as the product specification: features, scoring rules and scope exclusions. The project has two layers:
> 1. **The UV GO product.** A mobile web app that tells users when it is best to go outside. Its functionality is implemented fully and faithfully to the specification.
> 2. **The portfolio case study, the main goal.** Show clients on freelance marketplaces that the author builds beautiful websites with rich animation and motion design using React + Framer Motion + Lottie, while keeping the site fast and functional.
>
> Advanced animation is part of the work from day one, not final polish. One rule remains: **motion helps people understand the answer, rather than hiding it.** If animation prevents someone from seeing when to go outside within a couple of seconds, that is a bug.

## Product Overview
**One-liner:** UV GO answers one question: when is the best time to go outside within your free time?
**What it does:** Users specify their location, free time, outing duration and activity type. The app takes the Open-Meteo hourly forecast (UV, rain probability, feels-like temperature and wind), scores each hour using transparent rules, and returns the best window, a verdict (green / yellow / red), a one-line reason and a checklist of what to take. The day timeline shows each hour's colour and highlights free time.
**Product category:**
- *Product:* a weather / UV-index utility for planning an outing.
- *Portfolio:* an interactive web app with motion design. Marketplace searches for this work include “React animation”, “Framer Motion developer”, “Lottie animation website”, “interactive landing page” and “animated web app”.
**Product type:** Mobile-first SPA without a backend, using React + Framer Motion + Lottie. A public live link (Netlify / Vercel / GitHub Pages) and an open GitHub repository.
**Business model:** Free for users, with no login. For the author, it is a portfolio investment: the case study should attract freelance marketplace projects.

## Target Audience
**Target companies:** Clients on all major freelance marketplaces. Publish the case study everywhere: English-speaking platforms (Upwork, Fiverr, Contra) and Russian-speaking platforms (Kwork, FL.ru). Client types:
- startup and small-product founders who need an MVP or a landing page that looks premium;
- small and medium businesses needing a promotional site, animated landing page, interactive calculator or widget;
- digital agencies and studios outsourcing frontend development and motion;
- designers with animated designs in Figma / After Effects who need a developer to implement them in code.

**Decision-makers:** Usually one person: a founder, business owner, product manager or agency project manager. They post the job themselves, look at profiles and skim each candidate's portfolio for 10–30 seconds.

**Primary use case:**
- *Product:* quickly understand the best time to go outside within my free time and what to take.
- *Portfolio:* a marketplace client can tell from one cover image and a short video that this freelancer can bring their website to life, then use the live link to confirm it works on a real phone.

**Jobs to be done:**
- “Tell me one time, rather than dumping a whole day's forecast on me” (user).
- “Warn me about sun, rain, heat or wind so I take what I need” (user).
- “Find me someone whose animations look like those in leading products, not a template” (client).
- “Reduce the risk: show me they deliver a complete working product, not just a pretty picture” (client).

**Use cases:**
- Lunch break from 13:00–14:00: whether to go outside for 30 minutes or wait until evening.
- A one-hour run within a free window of 17:00–21:00 in hot weather.
- “Long in the sun”: three hours at the beach or park with high UV.
- A marketplace client opens the portfolio, watches a 15-second loop, follows the link and plays with the timeline on their phone.
- A freelancer includes the case study link in a proposal for a job requesting React animations.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| **User** (walking / running / relaxing in the sun) | One clear answer, speed, avoiding sunburn and getting wet | Weather apps provide dozens of numbers without a conclusion | The best window, a colour verdict and a one-line reason within a couple of seconds |
| **Founder / business owner** (marketplace client) | Wow factor, deadlines, budget, something that just works | Hard to distinguish strong candidates from average ones by their profiles; fears missed deadlines | A live case study to try; a complete product, not a concept |
| **Agency / studio** (outsourcing frontend and motion) | Faithful design implementation, animation quality, predictability | Freelancers simplify the design's animations or write slow code | Production-quality Framer Motion and Lottie animations, 60fps on mobile, clean code |
| **Designer with a design** (needs a developer) | Preserving Figma / After Effects motion exactly | Developers lack a feel for easing, timing and choreography | Attention to timing, springs and sequencing; integrating supplied Lottie files into React; creating Lottie and motion animations with AI tools |

## Problems & Pain Points
**Core problem:**
- *User:* a weather forecast is data, not a decision. To decide when to go out, users must compare UV, rain, temperature and wind against their free time themselves.
- *Marketplace client:* hundreds of freelancers have identical portfolios of template landing pages. Beautiful Dribbble motion concepts do not prove someone can build a working product, while working side projects look dull.

**Why alternatives fall short:**
- Standard weather apps show hourly numbers but do not account for free time, duration and activity type.
- UV apps focus only on UV and ignore rain, heat and wind.
- The typical portfolio weather app is a tutorial template with icons and no motion concept.
- Screenshot portfolios do not show animation, which is exactly what the client wants to buy.

**What it costs them:**
- *User:* sunburn, wet clothes, a ruined outing and time spent analyzing forecasts.
- *Client:* money and weeks spent on someone who did not meet the quality bar; rework; a website that fails to engage.
- *Author:* competing on price instead of value because there is no strong case study to stand out with.

**Emotional tension:**
- *User:* mild anxiety about getting sunburned and irritation at unnecessary numbers.
- *Client:* doubt about whether the freelancer can actually deliver or only produce a pretty picture, and fear of hiring a stranger from a marketplace.

## Competitive Landscape
**Product:**
- **Direct:** Apple Weather, Google Weather, Weather.com, AccuWeather. Good data, but no conclusion tailored to my free time and activity.
- **Direct (UV):** UV-index apps (UVLens, SunSmart Global UV and similar). One variable, with no best time accounting for rain, heat and wind.
- **Indirect:** looking out of the window or asking a chatbot. No forecast hours ahead or transparent logic.

**Marketplace portfolios (the main competition):**
- **Direct:** other frontend freelancers tagged animation / motion. Most show landing-page screenshots or templates (ThemeForest, Webflow, Framer sites) without their own motion logic.
- **Secondary:** no-code motion (Framer sites, Webflow interactions). Fast and attractive, but limited: no custom logic, data or React integration.
- **Indirect:** Dribbble / Behance motion concepts. Attractive, but they do not work with real data or open through a live link.

## Differentiation
**Key differentiators:**
- One answer instead of a forecast: the best window, verdict and reason.
- Transparent rules: all thresholds in one config, with the reason always explained (“UV 5, use sunscreen”).
- *Portfolio layer:* motion that encodes data. Animation shows how the day changes and why a window was selected. A live app using a real API, not a concept.

**How we do it differently (Framer Motion + Lottie motion concept):**
- **A timeline following the sun's path.** Hours unfold along the day's arc with staggered entrances, hour colours transition smoothly and free time is highlighted. Users can drag the timeline with a finger (inertial drag).
- **Searching for the best window.** A frame slides along the timeline with spring animation and snaps to the best slot. Through `layoutId`, it transitions into the result card.
- **Verdict card.** An expanding layout animation, UV counter, morphing verdict colour and a Lottie state icon (sun, cloud, rain).
- **Data-driven atmosphere.** Background and lighting change with UV intensity (warm gradient), rain (Lottie drops), heat (haze) and wind. Everything stays restrained and readable.
- **What to take checklist.** Items appear in sequence, each with its own Lottie micro-animation: sunscreen, hat and sunglasses, rain jacket, water and a warm layer.
- **State transitions.** Geolocation → loading → result as a single `AnimatePresence` choreography, without layout jumps. Loading has personality: a Lottie sun peeks out.
- **Micro-interactions.** Duration and activity selection with a shared-layout indicator, tactile tap feedback (`whileTap`) and desktop hover states.

**Why that's better:**
- Users understand the answer faster because motion shows cause and effect.
- A marketplace client sees what they want to buy within 15 seconds: motion quality, taste and a complete product.

**Why customers choose us:**
- *User:* “It simply told me when to go and what to take.”
- *Client:* “This freelancer will bring my website to life, and has a working example I can open on my phone.”

**Engineering guarantees (part of the positioning):**
- 60fps on a mid-range phone, with animations using `transform` / `opacity`.
- `prefers-reduced-motion` / `useReducedMotion`: a complete version without movement.
- The answer appears quickly; animation does not block content.
- Lottie loads lazily and does not inflate the first screen.
- Scoring logic is separate from the UI, rules live in one config and a README is included.

## Objections
| Objection | Response |
|-----------|----------|
| “Animations will slow down my website” | Animations use only composited properties, Lottie loads lazily and a reduced-motion mode is available. The case study includes Lighthouse and FPS measurements |
| “It is just a side project, not a real client job” | It is a complete product built to a full specification, using a live API, with open source code. You can check it yourself |
| “It looks good, but I need a different kind of website” | The case study shows an approach: any data and product can be brought to life similarly. Proposals suggest animation ideas tailored to the specific job |
| “Can you reproduce the animation in my design?” | Experience with Framer Motion and Lottie (integrating design-supplied Lottie files into React and controlling them in code), with attention to timing, easing and sequencing. The author is a developer, not a motion designer, and creates original Lottie assets with AI tools |
| “Will you meet the deadline?” | The case study describes the process: logic → interface → motion, with transparent stages |
| “Was this AI-generated?” | The README openly describes which AI tools were used and why (including Lottie asset generation); the motion choreography in code and the architecture are the author's own |

**Anti-persona:**
- *Product:* meteorologists and enthusiasts needing raw data, precipitation maps and multi-day forecasts.
- *Clients:* those wanting the cheapest website built in an evening without attention to detail; projects whose guidelines prohibit motion; WordPress fixes and backend jobs.

## Switching Dynamics
**Push:** The client has been let down by freelancers: template work, simplified animations and slow sites. *(User: tired of comparing numbers, has previously been sunburned or caught in rain.)*
**Pull:** A case study people want to interact with; visibly thoughtful animation and a complete product. *(User: one answer in seconds.)*
**Habit:** The client filters freelancers by marketplace ratings and review counts, choosing proven candidates. *(User: a familiar weather app is already installed.)*
**Anxiety:** “Someone new without reviews—what if they fail to deliver?” Addressed with a live link, open code, a clear process description and a quick, substantive proposal. *(User: “Can I trust the assessment?” and “Why share my location?” Addressed with a transparent reason and city search as an alternative to geolocation.)*

## Customer Language
*There are no real interviews or target jobs yet: the wording below consists of hypotheses about typical marketplace requests. Replace it with verbatim language when actual jobs and client conversations become available.*

**How they describe the problem (user):**
- "I just want to know when to go out." (hypothesis)
- "Is it safe to be in the sun right now?" (hypothesis)

**How they describe the problem (marketplace client):**
- "Need a React developer with strong animation skills" (typical job wording, hypothesis)
- "Looking for someone to bring our Figma design to life with smooth animations" (hypothesis)
- "Website should feel premium / modern / interactive" (hypothesis)
- “Need a landing page with animations like Apple's” (hypothesis)

**How they describe us:**
- "It just tells me when to go and what to take." (hypothesis, user)
- "Smooth, polished, and it actually works." (hypothesis, client)

**Words to use (English UI):** best time, go outside, your free time, good / OK with protection / not recommended, what to take, sunscreen, UV, feels like.
**Words to use (profile and proposals):** smooth animations, motion design, interactive, Framer Motion, Lottie, React, polished, production-ready, mobile-first, 60fps.
**Words to avoid:** “AI-powered”, “smart algorithm”, “revolutionary”; medical promises (“protects against skin cancer”, “safe”); unexplained meteorological jargon; “animation for animation's sake”; abstract “I'm passionate about…” statements in proposals.

**Glossary:**
| Term | Meaning |
|------|---------|
| Free time | The user's time window within which the best time is selected (e.g. 13:00–19:00) |
| Duration | Outing length: 30 min / 1 h / 2 h / 3 h |
| Activity | Active / Relaxed / Long in the sun; affects multipliers and thresholds |
| Hour score | Points assigned to an hour by the rules (lower is better) |
| Window score | Average of the hourly scores in the window |
| Verdict | Green = Good (0–2), Yellow = OK with protection (3–5), Red = Not recommended (6+) |
| Reason | One-line explanation of the verdict, e.g. "UV 5, use sunscreen" |
| Day timeline | Hourly colour scale for the day with free time highlighted |
| What to take | Checklist: sunscreen, hat & sunglasses, rain jacket, water, warm layer |
| Rules config | A single file containing all thresholds and rules |

## Brand Voice
*Draft: no existing copy yet. Refine after the first version of the UI copy.*

| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| **Direct** | Answer first, details second | Dry or commanding | "Go at 17:00. UV drops to 2." |
| **Warm** | Caring like a friend who checked the weather | Baby talk or excessive emoji | "Grab a hat — the sun's strong till 4." |
| **Transparent** | Always explains why | A wall of numbers | "Yellow: UV 5, use sunscreen." |
| **Playful in motion** | Personality in animation and small details | Jokes in warnings | (motion: a Lottie sun peeks out while loading) |

**Tone by context:**
- Support / README: clear, step by step, without marketing.
- Launch (marketplace and portfolio case study): confident and visual, emphasizing motion decisions and outcomes; video before text.
- Errors: calm, with a way forward (“Can't get your location. Search a city instead.”).
- Sales (job proposals): brief and tailored to the job, with a live-demo link and 1–2 animation ideas for the client's project.
- Social (Dribbble, Behance, LinkedIn, X): short videos and GIF loops of key animations, one idea per post.

**Terms we own:** "best time window", "one clear answer", "what to take".
**Never use (and why):** “safe” (medical liability; the rules are heuristics); “AI-powered” (untrue; the logic is deterministic); “perfect weather” (a promise that cannot be guaranteed).

## Proof Points
**Metrics:** None yet. Collect after release: Lighthouse Performance / Accessibility (mobile), animation FPS on a real device, time to first answer and bundle size.
**Customers:** None; this is the author's own project.
**Testimonials:** None. Later: feedback from the first clients attracted by this case study.
**Value themes:**
| Theme | Proof |
|-------|-------|
| Motion that explains data | Timeline video / GIF showing the best window snapping into place |
| Beauty without sacrificing speed | Lighthouse screenshot, FPS measurement, reduced-motion version |
| A complete product | Live link, real API, full functionality according to the specification |
| Clean engineering | Open repository, rules config in one file, README, AI usage note |

**Marketplace assets (create after release):**
- Case study cover: the most striking frame (timeline + verdict card) in a mobile mockup.
- A 15–30-second video loop: the full flow from selecting a time to the result.
- 3–5 short GIFs of individual animations for galleries and proposals.
- Case study copy: problem → solution → motion decisions → stack → links. Two versions: English (Upwork, Fiverr, Contra) and Russian (Kwork, FL.ru). This is platform-specific localization, not literal translation.
- The app interface itself is in English and is the same across all platforms.

## Goals
**Business goal:** Create a strong portfolio case study that distinguishes the author on freelance marketplaces and attracts above-market-rate work on interactive, animated websites.

**Current portfolio state:** It currently contains few projects with rich animation. UV GO will become the flagship motion case study and initially the only proof of this skill. It therefore needs to demonstrate as many different techniques as possible within one product while staying consistent with product logic:
- layout and shared-layout animations (`layout`, `layoutId`);
- gestures (drag, tap) and spring physics;
- entrance and exit choreography (`AnimatePresence`, stagger, variants);
- SVG animation (sun arc, path drawing);
- Lottie icons and illustrations;
- data-driven animation (colour, intensity, counters).

Each technique solves an interface problem rather than appearing in isolation to fill a list.
**Conversion action:**
- *Portfolio:* client opens the case study → watches the video → visits the live demo → sends an interview invitation or replies to a proposal.
- *User:* receives an answer (and optionally returns).

**Current metrics:** None (the project starts on 2026-10-27). Track: case study views in the profile, percentage of proposals receiving a client response and number of invitations.

**Constraints:**
- Out of scope (from the specification): login, backend, DB, payments, notifications, native apps.
- Stack: React + Framer Motion + Lottie (the author's primary experience).
- Dates in `IDEA.md` (October 31 / November 5) belonged to the original brief and are not binding. The author's own deadlines are TBD.

## Learnings
*Decisions and tested lessons. Newest first. Keep it to about 20 active entries.*
| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| 2026-10-27 | The author is a programmer, not a designer: AE / Bodymovin removed from the positioning; Lottie and motion assets are created using AI tools | Author clarification | Personas, Objections, specification, README | active |
| 2026-10-27 | UV GO is the flagship motion case study in a portfolio currently short on animation: demonstrate a broad range of Framer Motion + Lottie techniques within one product | Author decision | Development plan, portfolio | active |
| 2026-10-27 | Publish the case study on all marketplaces: two copy versions (EN for Upwork / Fiverr / Contra, RU for Kwork / FL.ru), with an English app UI | Author decision | Case study copy, proposals, social media | active |
| 2026-10-27 | Advanced animation from day one, but the answer to when to go outside must always be visible within a couple of seconds; motion explains data | Author decision | All skills, development plan | active |
| 2026-10-27 | The primary audience is freelance marketplace clients; optimize case study materials for quick browsing (cover, video, live link) | Author decision | Portfolio, copy, social media | active |
| 2026-10-27 | ~~Client requirements delivered on time, motion on top of working logic~~ — there is no external client; this is the author's own project | Author clarification | — | retired |

## Changelog
*Newest first. One line per revision: what changed and why.*
- v4 (2026-10-27) — Removed After Effects experience (the author is a programmer): Lottie assets are created with AI tools. Updated Personas (designer with a design), Objections and Learnings.
- v3 (2026-10-27) — Marketplaces: all major platforms, with two case study language versions (EN / RU). Added the current portfolio state (few motion projects → UV GO as the flagship case study with a broad range of techniques). Clarified that client wording is hypothetical.
- v2 (2026-10-27) — Repositioning: the author's own project (no client), primary audience of freelance marketplace clients, Framer Motion + Lottie stack, advanced animation from day one. Rewrote Overview, Audience, Personas, Competitive, Differentiation, Objections, Proof Points, Goals and Learnings.
- v1 (2026-10-27) — Initial context: UV GO product based on the IDEA.md brief + portfolio layer (motion design as the author's main goal).
