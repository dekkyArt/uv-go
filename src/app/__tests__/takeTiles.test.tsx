import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeWindow } from '../../domain/__tests__/factories';
import { rules } from '../../domain/rules.config';
import type { ChecklistId, ChecklistItem } from '../../domain/types';
import { MotionProvider } from '../../motion/MotionProvider';
import { TakeTiles } from '../cards/TakeTiles';
import { tileReason } from '../cards/tileReason';

const WINDOW = makeWindow({
  15: { uv: 4.6, rainProb: 20, feelsLike: 3.4 },
  16: { uv: 5.2, rainProb: 59.6, feelsLike: 27.4 },
});

const item = (id: ChecklistId): ChecklistItem => ({ id, label: rules.checklistLabels[id] });
const ALL: ChecklistId[] = ['sunscreen', 'hat-sunglasses', 'rain-jacket', 'water', 'warm-layer'];

describe('tileReason', () => {
  it('sunscreen: peak UV of the window and the config threshold', () => {
    expect(tileReason('sunscreen', WINDOW, 'relaxed')).toEqual({
      title: 'UV up to 5',
      detail: 'Needed from UV 3',
    });
  });

  it('hat-sunglasses: peak UV and its own threshold', () => {
    expect(tileReason('hat-sunglasses', WINDOW, 'relaxed')).toEqual({
      title: 'UV up to 5',
      detail: 'Needed from UV 6',
    });
  });

  it('rain-jacket: peak rain chance, rounded', () => {
    expect(tileReason('rain-jacket', WINDOW, 'relaxed')).toEqual({
      title: 'Rain up to 60%',
      detail: 'Needed from 30% rain',
    });
  });

  it('water: highest feels-like when relaxed', () => {
    expect(tileReason('water', WINDOW, 'relaxed')).toEqual({
      title: 'Feels up to 27°',
      detail: 'Needed when active or from 25°',
    });
  });

  it('water: "Active plan" for an active plan', () => {
    expect(tileReason('water', WINDOW, 'active').title).toBe('Active plan');
  });

  it('warm-layer: lowest feels-like of the window', () => {
    expect(tileReason('warm-layer', WINDOW, 'relaxed')).toEqual({
      title: 'Feels down to 3°',
      detail: 'Needed below 5°',
    });
  });

  it('skips null hours when taking the max / min', () => {
    const w = makeWindow({
      15: { uv: null, rainProb: null, feelsLike: null },
      16: { uv: 7, rainProb: 40, feelsLike: 2 },
    });
    expect(tileReason('sunscreen', w, 'relaxed').title).toBe('UV up to 7');
    expect(tileReason('rain-jacket', w, 'relaxed').title).toBe('Rain up to 40%');
    expect(tileReason('warm-layer', w, 'relaxed').title).toBe('Feels down to 2°');
  });

  it('drops the number when every hour is null, never printing null / NaN / Infinity', () => {
    const w = makeWindow({
      15: { uv: null, rainProb: null, feelsLike: null },
      16: { uv: null, rainProb: null, feelsLike: null },
    });
    const titles = ALL.map((id) => tileReason(id, w, 'relaxed').title);
    expect(titles).toEqual(['UV', 'UV', 'Rain', 'Feels like', 'Feels like']);
    for (const id of ALL) {
      const { title, detail } = tileReason(id, w, 'relaxed');
      expect(`${title} ${detail}`).not.toMatch(/null|NaN|Infinity/);
    }
  });
});

function setup(items: ChecklistItem[]) {
  return render(
    <MotionProvider>
      <TakeTiles items={items} window={WINDOW} activity="relaxed" intro={false} />
    </MotionProvider>,
  );
}

describe('TakeTiles', () => {
  it('renders a list with one tile per item: label, title and detail', () => {
    setup(ALL.map(item));
    const list = screen.getByRole('list');
    const tiles = within(list).getAllByRole('listitem');
    expect(tiles).toHaveLength(5);
    ALL.forEach((id, i) => {
      const { title, detail } = tileReason(id, WINDOW, 'relaxed');
      const tile = within(tiles[i]!);
      expect(tile.getByText(rules.checklistLabels[id])).toBeInTheDocument();
      expect(tile.getByText(title)).toBeInTheDocument();
      expect(tile.getByText(detail)).toBeInTheDocument();
    });
    expect(list).toHaveClass('grid-cols-2');
    expect(tiles[0]).toHaveClass('glass');
  });

  it('shows the empty text in one full-width tile without a fixed aspect ratio', () => {
    setup([]);
    const tiles = screen.getAllByRole('listitem');
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toHaveTextContent(rules.emptyChecklistText);
    expect(tiles[0]).toHaveClass('col-span-2');
    expect(tiles[0]).not.toHaveClass('aspect-square');
  });
});
