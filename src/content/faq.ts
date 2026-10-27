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
    a: 'It splits your free time into whole-hour windows that match your outing length. Each hour gets points for UV, chance of rain, heat, cold and wind, and lower is better. UV GO averages the points across each window and picks the lowest, then shows one verdict, one reason and what to take. If two windows tie, the one with the milder worst hour wins, then the earlier one. The tables above list every threshold.',
  },
  {
    q: 'What do the colours mean?',
    a: 'Green means Good, yellow means OK with protection, and red means Not recommended. The colour comes from the window score, and the label and the reason always come with it, so you never have to read the colour alone. The same colours mark each hour on the timeline.',
  },
  {
    q: 'Why are dark hours left out?',
    a: 'UV GO plans outings in daylight. An hour that is not fully in daylight cannot be part of a window, so a late free time can come back with no result. If that happens, try earlier hours.',
  },
  {
    q: 'Where does the weather data come from?',
    a: 'From Open-Meteo.com, a free weather API. UV GO reads the hourly forecast for UV index, chance of rain, feels-like temperature and wind speed, and the Open-Meteo geocoding service for city search. Everything after that, from scoring to the verdict, is calculated on your device by fixed rules.',
  },
  {
    q: 'Do you store my location?',
    a: "Only in your browser. Your chosen place is saved in your browser's localStorage so it is there when you come back, and it never reaches a UV GO server because there is none. The coordinates are sent only to Open-Meteo to fetch the forecast. UV GO sets no cookies and has no analytics.",
  },
  {
    q: 'At what UV index should I use sunscreen?',
    a: 'The WHO says to use sun protection when the UV index reaches 3 or above. UV GO follows that line: Sunscreen goes on your list when the highest UV in your window is 3 or more, and a hat and sunglasses join it at 6. Our guides on the UV index and on sun protection explain the thresholds and cite the sources.',
  },
  {
    q: 'Why "feels like" instead of air temperature?',
    a: 'Feels-like temperature already includes wind and humidity, so it matches how heat or cold hits your body better than the air temperature does. UV GO uses it for heat, cold, the Water item and the Warm layer item, so the numbers in the reason line are the ones you will notice outside.',
  },
  {
    q: 'Can I check another city?',
    a: "Yes. Search for any city, or use your current location, and the answer updates. UV GO remembers your last place in your browser, so you don't have to search again next time. It shows today and tomorrow for one place at a time.",
  },
  {
    q: 'Is this medical advice?',
    a: 'No. UV GO gives general guidance, not medical advice. Talk to a healthcare professional about your skin. The rules are a simple score built on a public forecast, so treat the answer as a plan for your outing and use your own judgement, especially if you burn easily.',
  },
];
