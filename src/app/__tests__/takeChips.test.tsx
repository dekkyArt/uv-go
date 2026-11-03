import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeWindow } from '../../domain/__tests__/factories';
import { rules } from '../../domain/rules.config';
import type { ChecklistId, ChecklistItem } from '../../domain/types';
import { MotionProvider } from '../../motion/MotionProvider';
import { TakeChips, TakeStrip, edgeMask } from '../cards/TakeChips';
import { takeReason } from '../cards/takeReason';

const WINDOW = makeWindow({
  15: { uv: 4.6, rainProb: 20, feelsLike: 3.4 },
  16: { uv: 5.2, rainProb: 59.6, feelsLike: 27.4 },
});

const item = (id: ChecklistId): ChecklistItem => ({ id, label: rules.checklistLabels[id] });
const ALL: ChecklistId[] = ['sunscreen', 'hat-sunglasses', 'rain-jacket', 'water', 'warm-layer'];

describe('takeReason', () => {
  it('sunscreen: peak UV of the window and the config threshold', () => {
    expect(takeReason('sunscreen', WINDOW, 'relaxed')).toEqual({
      value: 'UV 5',
      detail: 'Needed from UV 3',
    });
  });

  it('hat-sunglasses: peak UV and its own threshold', () => {
    expect(takeReason('hat-sunglasses', WINDOW, 'relaxed')).toEqual({
      value: 'UV 5',
      detail: 'Needed from UV 6',
    });
  });

  it('rain-jacket: peak rain chance, rounded', () => {
    expect(takeReason('rain-jacket', WINDOW, 'relaxed')).toEqual({
      value: '60%',
      detail: 'Needed from 30% rain',
    });
  });

  it('water: highest feels-like when relaxed', () => {
    expect(takeReason('water', WINDOW, 'relaxed')).toEqual({
      value: '27°',
      detail: 'Needed when active or from 25°',
    });
  });

  it('water: no value for an active plan, the detail says why', () => {
    expect(takeReason('water', WINDOW, 'active')).toEqual({
      value: null,
      detail: 'Needed when active or from 25°',
    });
  });

  it('warm-layer: lowest feels-like of the window', () => {
    expect(takeReason('warm-layer', WINDOW, 'relaxed')).toEqual({
      value: '3°',
      detail: 'Needed below 5°',
    });
  });

  it('skips null hours when taking the max / min', () => {
    const w = makeWindow({
      15: { uv: null, rainProb: null, feelsLike: null },
      16: { uv: 7, rainProb: 40, feelsLike: 2 },
    });
    expect(takeReason('sunscreen', w, 'relaxed').value).toBe('UV 7');
    expect(takeReason('rain-jacket', w, 'relaxed').value).toBe('40%');
    expect(takeReason('warm-layer', w, 'relaxed').value).toBe('2°');
  });

  it('drops the value when every hour is null, never printing null / NaN / Infinity', () => {
    const w = makeWindow({
      15: { uv: null, rainProb: null, feelsLike: null },
      16: { uv: null, rainProb: null, feelsLike: null },
    });
    for (const id of ALL) {
      const { value, detail } = takeReason(id, w, 'relaxed');
      expect(value).toBeNull();
      expect(detail).not.toMatch(/null|NaN|Infinity/);
    }
  });
});

function setup(items: ChecklistItem[]) {
  return render(
    <MotionProvider>
      <TakeChips items={items} window={WINDOW} activity="relaxed" intro={false} />
    </MotionProvider>,
  );
}

describe('TakeChips', () => {
  it('is a "What to take" region with one pill per item: label and value on screen', () => {
    setup(ALL.map(item));
    const region = screen.getByRole('region', { name: 'What to take' });
    const chips = within(region).getAllByRole('listitem');
    expect(chips).toHaveLength(5);
    ALL.forEach((id, i) => {
      const { value } = takeReason(id, WINDOW, 'relaxed');
      const chip = within(chips[i]!);
      expect(chip.getByText(rules.checklistLabels[id])).toBeVisible();
      if (value !== null) expect(chip.getByText(value)).toBeVisible();
      expect(chips[i]).toHaveClass('rounded-full');
    });
  });

  it('keeps the detail for screen readers only', () => {
    setup([item('sunscreen')]);
    const chip = screen.getByRole('listitem');
    expect(chip).toHaveTextContent('Sunscreen UV 5. Needed from UV 3');
    expect(within(chip).getByText('. Needed from UV 3')).toHaveClass('sr-only');
  });

  it('shows one "Nothing extra needed" pill for an empty checklist', () => {
    setup([]);
    const chips = screen.getAllByRole('listitem');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent(rules.emptyChecklistText);
    expect(chips[0]).toHaveClass('rounded-full');
  });

  it('wraps onto more lines rather than overflowing; centred on a phone, left on desktop', () => {
    setup(ALL.map(item));
    const list = screen.getByRole('list');
    expect(list).toHaveClass('flex-wrap', 'justify-center', 'lg:justify-start');
  });
});

describe('edgeMask', () => {
  it('fades nothing when the row fits', () => {
    expect(edgeMask(0, 390, 390)).toBe('none');
  });

  it('fades only the edge there is more to scroll to', () => {
    expect(edgeMask(0, 390, 600)).toBe(
      'linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)',
    );
    expect(edgeMask(210, 390, 600)).toBe(
      'linear-gradient(to right, transparent 0, #000 24px, #000 100%)',
    );
    expect(edgeMask(100, 390, 600)).toBe(
      'linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
    );
  });
});

describe('TakeStrip', () => {
  function strip(shown: boolean) {
    render(
      <MotionProvider>
        <TakeStrip shown={shown} items={ALL.map(item)} window={WINDOW} activity="relaxed" intro />
      </MotionProvider>,
    );
    return document.querySelector<HTMLElement>('[data-take-strip]')!;
  }

  it('is one row of small pills that scrolls sideways, hidden from assistive technology', () => {
    const el = strip(true);
    expect(el).toHaveAttribute('aria-hidden', 'true');
    const list = el.querySelector('ul')!;
    expect(list).toHaveClass('flex-nowrap', 'overflow-x-auto');
    const chips = within(list).getAllByRole('listitem', { hidden: true });
    expect(chips).toHaveLength(5);
    for (const chip of chips) expect(chip).toHaveClass('h-8', 'shrink-0', 'whitespace-nowrap');
    // Label and value only: the reasons are read from the list on the page.
    expect(el.querySelector('.sr-only')).toBeNull();
    expect(chips[0]).toHaveTextContent('Sunscreen UV 5');
  });

  it('sits right under the pinned bar on the sky, with no plate of its own', () => {
    const el = strip(true);
    expect(el).toHaveClass('fixed');
    expect(el.style.top).toBe('56px');
    expect(el.style.height).toBe('44px');
    expect(el).not.toHaveClass('glass');
  });

  it('lets taps through while the pills are still on the page', () => {
    expect(strip(false).style.pointerEvents).toBe('none');
  });
});

describe('TakeChips folded', () => {
  it('fades the pills on the page out once they have folded into the strip', () => {
    render(
      <MotionProvider>
        <TakeChips
          items={[item('water')]}
          window={WINDOW}
          activity="relaxed"
          intro={false}
          folded
        />
      </MotionProvider>,
    );
    const region = screen.getByRole('region', { name: 'What to take' });
    expect(region).toHaveClass('opacity-0');
    // Still read out: the strip is for the eye only.
    expect(within(region).getByRole('listitem')).toHaveTextContent('Water 27°');
  });
});
