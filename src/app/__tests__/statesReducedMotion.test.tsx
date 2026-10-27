import { render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../motion/MotionProvider';
import { LoadingSun } from '../components/LoadingSun';

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

describe('LoadingSun with reduced motion', () => {
  it('is static: the sun neither rises nor sways', () => {
    const { container } = render(
      <MotionProvider>
        <LoadingSun />
      </MotionProvider>,
    );
    const svg = container.querySelector('svg[data-loading-sun]');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[data-sun-motion]')).toBeNull();
  });
});
