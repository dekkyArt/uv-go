import { describe, expect, it } from 'vitest';
import {
  barDelay,
  cardDelay,
  firstResult,
  labelVisibleAt,
  tileDelay,
  totalDuration,
} from '../choreography';

describe('first result choreography', () => {
  it('shows the best time once the hero has come in, within 1s', () => {
    expect(labelVisibleAt()).toBeCloseTo(0.35);
    expect(labelVisibleAt()).toBeLessThanOrEqual(1.0);
  });

  it('plays the whole choreography within 1.8s', () => {
    expect(totalDuration()).toBeLessThanOrEqual(1.8);
    expect(totalDuration()).toBeGreaterThanOrEqual(1.0);
  });

  it('covers every step: four cards, five tiles, the bars and the label', () => {
    expect(totalDuration()).toBeGreaterThanOrEqual(cardDelay(3) + 0.3);
    expect(totalDuration()).toBeGreaterThanOrEqual(tileDelay(4) + 0.3);
    expect(totalDuration()).toBeGreaterThanOrEqual(barDelay(23) + firstResult.barsDuration);
    expect(totalDuration()).toBeGreaterThanOrEqual(labelVisibleAt());
  });

  it('caps the bar stagger, so 24 rows never run past the last bar', () => {
    const c = { ...firstResult, barStagger: 0.1 };
    const lastBar = c.barsGrow + c.barStaggerMax + c.barsDuration;
    expect(barDelay(23, c) + c.barsDuration).toBeLessThanOrEqual(lastBar);
    expect(totalDuration(c)).toBeLessThanOrEqual(Math.max(lastBar, totalDuration()));
  });

  it('staggers the cards and tiles by their index', () => {
    expect(cardDelay(0)).toBeCloseTo(firstResult.cardsIn);
    expect(cardDelay(2)).toBeCloseTo(firstResult.cardsIn + 2 * firstResult.cardStagger);
    expect(tileDelay(1)).toBeCloseTo(firstResult.tilesIn + firstResult.tileStagger);
  });
});
