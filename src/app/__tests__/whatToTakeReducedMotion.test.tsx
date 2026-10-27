import { render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ChecklistItem } from '../../domain/types';
import { WhatToTake } from '../components/WhatToTake';

const ITEMS: ChecklistItem[] = [
  { id: 'sunscreen', label: 'Sunscreen' },
  { id: 'hat-sunglasses', label: 'Hat and sunglasses' },
  { id: 'rain-jacket', label: 'Rain jacket' },
  { id: 'water', label: 'Water' },
  { id: 'warm-layer', label: 'Warm layer' },
];

// The reduced-motion preference is read once per module, so it gets its own test file.
beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.startsWith('(prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('WhatToTake with reduced motion', () => {
  it('keeps every icon static, intro or newly entered', () => {
    const { rerender } = render(<WhatToTake items={[]} />);
    rerender(<WhatToTake items={ITEMS} intro />);
    for (const { label } of ITEMS) {
      const icon = within(screen.getByText(label)).getByTestId('checklist-icon');
      expect(icon).toHaveAttribute('data-play', 'false');
    }
  });
});
