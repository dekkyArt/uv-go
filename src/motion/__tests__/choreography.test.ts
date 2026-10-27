import { describe, expect, it } from 'vitest';
import { firstResult, labelVisibleAt, totalDuration } from '../choreography';
import { durations } from '../tokens';

describe('first result choreography', () => {
  it('answer readable within 1s', () => {
    expect(labelVisibleAt()).toBeLessThanOrEqual(1.0);
  });

  it('first choreography within 1.8s', () => {
    expect(totalDuration()).toBeLessThanOrEqual(1.8);
  });

  it('shows the label one base duration after the hand-off', () => {
    expect(labelVisibleAt()).toBeCloseTo(firstResult.labelHandoff + durations.base);
  });

  it('counts the five checklist items and the search frame in the total', () => {
    const lastItemEnds = firstResult.cardReveal + 4 * firstResult.checklistStagger + durations.base;
    expect(totalDuration()).toBeGreaterThanOrEqual(lastItemEnds);
    expect(totalDuration()).toBeGreaterThanOrEqual(labelVisibleAt());
  });

  it('hands the label over after the frame has found the window', () => {
    expect(firstResult.labelHandoff).toBeGreaterThanOrEqual(
      firstResult.searchStart + firstResult.searchDuration,
    );
  });
});
