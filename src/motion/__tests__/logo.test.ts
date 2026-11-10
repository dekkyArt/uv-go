import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { createLogoMotion } from '../logo';

const cleanups: (() => void)[] = [];
beforeEach(() => {
  // jsdom has no Web Animations API. Browser tests exercise the real flights.
  vi.stubGlobal('Animation', class {});
  Object.defineProperty(SVGElement.prototype, 'animate', {
    configurable: true,
    value: () => ({ cancel() {} }),
  });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  delete (SVGElement.prototype as Partial<SVGElement>).animate;
  vi.unstubAllGlobals();
});

function setup() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = `
    <g data-logo-ray data-x="-1" data-y="0"></g>
    <g data-logo-ray data-x="0" data-y="1"></g>
  `;
  const label = document.createElement('span');
  label.textContent = 'UV GO';
  const motion = createLogoMotion(svg, label);
  cleanups.push(motion.reset);
  const rays = [...svg.querySelectorAll('g')];
  return { svg, label, rays, motion };
}

describe('logo hover motion', () => {
  it('emits a stream behind the letter, crossfades the resting rays and cleans up on exit', async () => {
    const { svg, label, rays, motion } = setup();
    const link = document.createElement('a');
    link.append(svg, label);
    motion.setHovered(true);
    expect(svg.querySelectorAll('[data-logo-particle]')).toHaveLength(4);
    expect(svg.firstElementChild).toHaveAttribute('data-logo-stream');
    await waitFor(() => {
      expect(svg.style.transform).toBe('scale(1.08)');
      expect(label.style.transform).toBe('scale(1.08)');
      for (const ray of rays) expect(ray.style.opacity).toBe('0');
    });
    motion.setHovered(false);
    await waitFor(() => {
      expect(svg.style.transform).toBe('scale(1)');
      expect(label.style.transform).toBe('scale(1)');
      for (const ray of rays) expect(ray.style.opacity).toBe('1');
      expect(svg.querySelector('[data-logo-stream]')).toBeNull();
    });
  });

  it('keeps one stream through rapid hover changes and removes it on reset', async () => {
    const { svg, label, rays, motion } = setup();
    motion.setHovered(true);
    await waitFor(() => expect(rays.some((ray) => ray.style.opacity !== '')).toBe(true));
    const displayed = svg.style.transform;
    motion.setHovered(false);
    expect(svg.style.transform).toBe(displayed);
    motion.setHovered(true);
    expect(svg.querySelectorAll('[data-logo-stream]')).toHaveLength(1);
    motion.reset();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(svg.style.transform).toBe('');
    expect(label.style.transform).toBe('');
    expect(svg.querySelector('[data-logo-stream]')).toBeNull();
    for (const ray of rays) expect(ray.style.opacity).toBe('');
  });
});
