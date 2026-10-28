import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../motion/MotionProvider';
import { Sheet } from '../sheet/Sheet';

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

describe('Sheet with reduced motion', () => {
  it('fades in instead of sliding up', () => {
    render(
      <MotionProvider>
        <Sheet open onClose={() => {}} title="Plan" size="auto" returnFocusRef={createRef()}>
          <button>Go</button>
        </Sheet>
      </MotionProvider>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Plan' });
    expect(dialog.style.transform).not.toContain('translateY');
    expect(dialog.style.opacity).toBe('0');
  });
});
