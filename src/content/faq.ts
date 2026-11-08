/**
 * Home page FAQ (spec 11.4). The single source for `Faq.astro` and the FAQPage JSON-LD (Task 23),
 * so answers are plain text. Thresholds mirror `src/domain/rules.config.ts`; the full tables are in
 * How it works. Health claims point to the articles, which cite their sources.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const faqItems: FaqItem[] = [
  {
    q: 'How does UV GO pick the best time?',
    a: 'It compares windows starting on the hour inside your free time, using only hours marked as daytime in the forecast. A 30-minute outing uses one full forecast hour, just like a 1-hour outing; 2- and 3-hour outings use consecutive hours. For today, the earliest start is the current time rounded up to the next whole hour. Each hour gets points for UV, chance of rain, heat, cold and wind, and lower is better. UV GO averages the points across each window and picks the lowest, then shows one verdict, one reason and what to take. If two windows tie, the one with the milder worst hour wins, then the earlier one. The tables above list every threshold.',
  },
  {
    q: 'What do the colours mean?',
    a: 'Green means Good, yellow means OK with protection, and red means Not recommended. The window colour comes from its rounded average score. Each hour has its own verdict, which can differ from the window verdict. Best means the lowest score among the windows that fit your plan, so even the best option can be red.',
  },
  {
    q: 'Why are dark hours left out?',
    a: 'UV GO plans outings in daylight. Every forecast hour in a window must be marked as daytime by Open-Meteo. Sunrise and sunset are shown for reference; they do not define minute-by-minute eligibility. If no daylight window fits, change your free hours or duration.',
  },
  {
    q: 'Where does the weather data come from?',
    a: 'From Open-Meteo.com, a free weather API. UV GO reads hourly UV index, precipitation probability (shown as chance of rain), feels-like temperature, wind speed, day/night flags, weather codes and cloud cover, plus sunrise and sunset. City search uses Open-Meteo geocoding. The Now line is the current hour’s forecast, not a live measurement. Everything after that, from scoring to the verdict, is calculated on your device by fixed rules.',
  },
  {
    q: 'Do you store my location?',
    a: 'Your selected place, free hours, duration and activity are saved in your browser’s localStorage when it is available. The selected day is not saved. Coordinates rounded to two decimal places are sent to Open-Meteo for the forecast; city search text is sent to its geocoding service. Use my location asks the browser for a position when you press it; it does not keep tracking you. Optional Google Analytics runs only when it is configured and you accept analytics cookies. You can withdraw consent through Cookie settings. See Privacy & cookies for details.',
  },
  {
    q: 'At what UV index should I use sunscreen?',
    a: 'The WHO says to use sun protection when the UV index reaches 3 or above. UV GO follows that line: Sunscreen goes on your list when the highest rounded UV in your window is 3 or more, and a hat and sunglasses join it at 6. Our guides on the UV index and on sun protection explain the thresholds and cite the sources.',
  },
  {
    q: 'Why "feels like" instead of air temperature?',
    a: 'Feels-like temperature already includes wind and humidity, so it matches how heat or cold hits your body better than the air temperature does. UV GO uses it for heat, cold, the Water item and the Warm layer item, so the numbers in the reason line are the ones you will notice outside.',
  },
  {
    q: 'Can I check another city?',
    a: "Yes. Search for any city, or use your current location, and the answer updates. UV GO remembers your last place in your browser, so you don't have to search again next time. It shows today and tomorrow for one place at a time, with all times local to that place. A saved My location is the position from your last request; press Use my location again to update it.",
  },
  {
    q: 'What happens when forecast values are missing?',
    a: 'Missing values appear as a dash or no data in the hourly forecast and details. A missing factor adds no points and cannot trigger a checklist item. The app still selects a window from the available data, so Good and No extra items suggested do not confirm that every forecast value was available.',
  },
  {
    q: 'Why did the app switch to tomorrow?',
    a: 'When a forecast loads, UV GO checks whether all daylight start times that fit your plan today have passed. If so, it shows tomorrow with a notice. Your free time may not have ended: there may simply be no start left that fits the duration. Choose Today again to keep viewing today for the rest of the session.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. UV GO gives general guidance, not medical advice. Talk to a healthcare professional about your skin. The rules are a simple score built on a public forecast, so treat the answer as a plan for your outing and use your own judgement, especially if you burn easily.',
  },
];
