import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, over, type Rgb } from '../../domain/contrast';
import { WORST_BACKGROUNDS } from '../../domain/glass';
import { TEXT_SECONDARY_ALPHA } from '../../domain/skyPalette';
import { GLASSES } from '../../test/glasses';
import {
  BUTTON_CLASS,
  CTA_CLASS,
  FREE_BAND_CLASS,
  INSET_CLASS,
  OPTION_ACTIVE_CLASS,
  RAIN_TEXT_CLASS,
  SEARCH_INPUT_CLASS,
  SEGMENT_OFF_CLASS,
  SEGMENT_ON_CLASS,
  SEGMENT_PILL_CLASS,
  SELECTED_CELL_CLASS,
  SHEET_BUTTON_CLASS,
  TAKE_BADGE_CLASS,
  TAKE_ICON_CLASS,
} from '../ui';

/**
 * Every coloured text and every plate under text that the UI uses, over the worst-case sky.
 * White and secondary text on bare glass are glassFor's own proof (src/domain/glass.ts); this
 * covers what sits on top of it. The colours are read from the exported class constants, so a
 * changed class changes the proof.
 */
const css = readFileSync('src/styles/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const TEXT_AA = 4.5;

interface Layer {
  rgb: Rgb;
  alpha: number;
}
/** A colour layer, or the glass of the sky behind it. */
type Paint = Layer | 'glass';

/** `rgb(r g b / a)` of a custom property in global.css. */
function cssLayer(name: string): Layer {
  const m = new RegExp(`${name}:\\s*rgb\\((\\d+) (\\d+) (\\d+) \\/ ([\\d.]+)\\);`).exec(css);
  expect(m, `${name} in global.css`).not.toBeNull();
  return { rgb: [Number(m![1]), Number(m![2]), Number(m![3])], alpha: Number(m![4]) };
}

const NAMED: Record<string, Paint> = {
  white: { rgb: WHITE, alpha: 1 },
  black: { rgb: BLACK, alpha: 1 },
  text: { rgb: WHITE, alpha: 1 },
  'text-muted': { rgb: WHITE, alpha: TEXT_SECONDARY_ALPHA },
  surface: 'glass',
  'surface-strong': cssLayer('--uv-surface-strong'),
};

/** The colour a `bg-*` or `text-*` utility paints, or null for a non-colour one (`text-sm`). */
function paintOf(utility: string): Paint | null {
  const m =
    /^(?:bg|text)-(white|black|text-muted|text|surface-strong|surface|\[#([0-9a-f]{6})\])(?:\/(?:(\d+)|\[([\d.]+)\]))?$/.exec(
      utility,
    );
  if (!m) return null;
  const [, name, hex, percent, fraction] = m;
  const base = hex ? { rgb: hexToRgb(`#${hex}`), alpha: 1 } : NAMED[name];
  if (base === 'glass' || (percent === undefined && fraction === undefined)) return base;
  return { rgb: base.rgb, alpha: percent !== undefined ? Number(percent) / 100 : Number(fraction) };
}

/** The `kind` colour of a class list, under a variant such as `hover:` or `placeholder:`. */
function pick(classes: string, kind: 'bg' | 'text', variant = ''): Paint {
  for (const token of classes.split(/\s+/)) {
    if (!token.startsWith(`${variant}${kind}-`)) continue;
    const paint = paintOf(token.slice(variant.length));
    if (paint) return paint;
  }
  throw new Error(`no ${variant}${kind}- colour in "${classes}"`);
}

const text = (classes: string, variant = '') => pick(classes, 'text', variant) as Layer;
const bg = (classes: string, variant = '') => pick(classes, 'bg', variant);

/** The black rim around every glyph on the bare sky (heroContrast.test.ts proves its shape). */
const RIM_ALPHA = Number(
  /\.sky-text\s*\{[^}]*--sky-rim:\s*rgb\(0 0 0 \/ ([\d.]+)\);/.exec(css)?.[1],
);

type Ground = 'glass' | 'glass on glass' | 'hero sky';

/** Every surface `plates` can end up as: over each glass and each worst-case background. */
function surfaces(ground: Ground, plates: Paint[]): Rgb[] {
  return GLASSES.flatMap((g) =>
    WORST_BACKGROUNDS.map((sky) => {
      const glass = (behind: Rgb) => over(g.rgb, g.alpha, behind);
      let s = ground === 'hero sky' ? sky : ground === 'glass' ? glass(sky) : glass(glass(sky));
      for (const p of plates) s = p === 'glass' ? glass(s) : over(p.rgb, p.alpha, s);
      // The text's own shadow paints above the plates: on the sky, a label reads against its rim.
      return ground === 'hero sky' ? over(BLACK, RIM_ALPHA, s) : s;
    }),
  );
}

const WHITE_TEXT = text('text-text');

const CASES: [name: string, ground: Ground, plates: Paint[], text: Layer][] = [
  ['rain chance (Your free time)', 'glass', [], text(RAIN_TEXT_CLASS)],
  ['How it works step, article TL;DR', 'glass', [bg(INSET_CLASS)], WHITE_TEXT],
  ['How it works step number', 'glass', [bg(INSET_CLASS), bg(INSET_CLASS)], WHITE_TEXT],
  ['hour on the free band, past or not', 'glass', [bg(FREE_BAND_CLASS)], WHITE_TEXT],
  ['selected hour', 'glass', [bg(SELECTED_CELL_CLASS)], WHITE_TEXT],
  [
    'selected hour on the free band',
    'glass',
    [bg(FREE_BAND_CLASS), bg(SELECTED_CELL_CLASS)],
    WHITE_TEXT,
  ],
  ['hero button', 'hero sky', [bg(BUTTON_CLASS)], text(BUTTON_CLASS)],
  ['hero button, hovered', 'hero sky', [bg(BUTTON_CLASS, 'hover:')], text(BUTTON_CLASS)],
  ['sheet button', 'glass', [bg(SHEET_BUTTON_CLASS)], text(SHEET_BUTTON_CLASS)],
  ['sheet button, hovered', 'glass', [bg(SHEET_BUTTON_CLASS, 'hover:')], text(SHEET_BUTTON_CLASS)],
  ['city search text', 'glass', [bg(SEARCH_INPUT_CLASS)], text(SEARCH_INPUT_CLASS)],
  [
    'city search placeholder',
    'glass',
    [bg(SEARCH_INPUT_CLASS)],
    text(SEARCH_INPUT_CLASS, 'placeholder:'),
  ],
  ['highlighted city', 'glass on glass', [bg(OPTION_ACTIVE_CLASS)], WHITE_TEXT],
  ['selected segment', 'glass on glass', [bg(SEGMENT_PILL_CLASS)], text(SEGMENT_ON_CLASS)],
  [
    'unselected segment, hovered',
    'glass on glass',
    [bg(SEGMENT_OFF_CLASS, 'hover:')],
    text(SEGMENT_OFF_CLASS),
  ],
  ['white pill link', 'glass', [bg(CTA_CLASS)], text(CTA_CLASS)],
  ['white pill link, hovered', 'glass', [bg(CTA_CLASS, 'hover:')], text(CTA_CLASS)],
  [
    'surface-strong plates (metric switch, hour details close)',
    'glass on glass',
    [bg('bg-surface-strong')],
    WHITE_TEXT,
  ],
];

describe('text contrast on plates and in colour, over the worst-case sky', () => {
  it('reads every colour from the classes', () => {
    expect(RIM_ALPHA).toBeGreaterThan(0);
    expect(text(RAIN_TEXT_CLASS).rgb).not.toEqual(WHITE);
    expect(text(SEARCH_INPUT_CLASS, 'placeholder:').alpha).toBeLessThan(1);
    expect(() => pick('text-sm text-[13px]', 'text')).toThrow();
  });

  it.each(CASES)('%s holds 4.5:1', (_name, ground, plates, layer) => {
    const worst = Math.min(
      ...surfaces(ground, plates).map((s) => contrastRatio(over(layer.rgb, layer.alpha, s), s)),
    );
    expect(worst).toBeGreaterThanOrEqual(TEXT_AA);
  });
});

/** Source files of the UI, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'test' ? [] : sources(path);
    return /\.(tsx?|astro)$/.test(e.name) ? [path] : [];
  });
}

describe('coloured text', () => {
  it('is only the rain blue: verdict words and errors are white next to a coloured dot', () => {
    const coloured = sources('src').flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/text-(?:verdict-[a-z-]+|night|\[#[0-9a-f]{6}\])/g)]
        .map((m) => `${file}: ${m[0]}`)
        .filter((hit) => hit !== `src/app/ui.ts: ${RAIN_TEXT_CLASS}`)
        // Not text: the icon on the opaque What to take badges, proven below.
        .filter((hit) => hit !== `src/app/ui.ts: ${TAKE_ICON_CLASS}`),
    );
    expect(coloured).toEqual([]);
  });
});

describe('What to take badges', () => {
  it.each(Object.entries(TAKE_BADGE_CLASS))('%s: the icon holds 3:1 on its badge', (_id, badge) => {
    const plate = bg(badge) as Layer;
    expect(plate.alpha).toBe(1);
    expect(contrastRatio(text(TAKE_ICON_CLASS).rgb, plate.rgb)).toBeGreaterThanOrEqual(3);
  });
});
