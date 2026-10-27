UVGO

Who we are: A small startup testing a prototype called UV GO. If it works, a follow-up project is likely .

What we need: A mobile-first single-page web app (React or plain JavaScript, no backend). It uses the free Open-Meteo API (no key needed) and gives the user one clear answer: the best time to go outside within their free time.

Features:
1. Location: browser geolocation or city search (Open-Meteo Geocoding API)
2. User inputs: free time (e.g. 13:00 to 19:00), duration (30 min / 1 h / 2 h / 3 h), activity (Active / Relaxed / Long in the sun)
3. Result card: best time window , a verdict (green = Good / yellow = OK with protection / red = Not recommended) and a one-line reason (e.g. "UV 5, use sunscreen")
4. Day timeline: each hour coloured green, yellow or red, with the free time highlighted UV GO: HW2 T eam Guide
5. "What to take" list: sunscreen, hat and sunglasses, rain jacket, water , warm layer
6. All rules and thresholds in one config file

Rules (score per hour, lower is better)
- UV 0 to 2: 0 points. UV 3 to 5: 2. UV 6 to 7: 4. UV 8+: 6. For "Long in the sun", multiply by 1.5.
- Rain chance 30 to 59%: +2. Rain chance 60%+: +5.
- Feels-like temperature 30°C+: +3 (Active: +5). Below 0°C: +2.
- Wind 40 km/h+: +3.
- Dark hours are excluded.
- Window score = average of its hours. V erdict: 0 to 2 green, 3 to 5 yellow , 6+ red.
- Checklist: UV 3+ sunscreen. UV 6+ hat and sunglasses. Rain 30%+ rain jacket. Active or 25°C+ water . Below 5°C warm layer .

Out of scope: login, backend, database, payments, notifications, native apps.

Deliverables:
- Live link (Netlify , V ercel or GitHub P ages)
- Code in a GitHub repo shared with us, plus a README with setup steps
- A short AI usage note in the README

Timeline and payment (fixed price, via the platform)
- Milestone 1, Sat 31 Oct (40%): location, data, timeline and scoring working on the live link
- Milestone 2, Thu 5 Nov (60%): result card, checklist, polish, README
- One revision round until Sat 7 Nov

How we work: We test each milestone against this list and reply within 24 hours. Please push code regularly , and tell us early if something is at risk.

AI policy: AI coding tools are OK for boilerplate and debugging. You must understand all
the code, and list in the README which tools you used and what for .
