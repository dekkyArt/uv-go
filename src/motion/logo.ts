import { springValue } from 'motion';
import { durations, springs } from './tokens';

/** Hover springs keep their velocity; emitted rays follow a drag/deceleration model. */
export function createLogoMotion(symbol: SVGSVGElement, wordmark: HTMLElement) {
  const scale = springValue<number>(1, springs.snappy);
  scale.on('change', (value) => {
    symbol.style.transform = `scale(${value})`;
    wordmark.style.transform = `scale(${value})`;
  });
  const rays = [...symbol.querySelectorAll<SVGGElement>('[data-logo-ray]')];
  const presence = springValue<number>(0, springs.smooth);
  let hovered = false;
  let stream: SVGGElement | undefined;
  let flights: Animation[] = [];

  function stopStream() {
    flights.forEach((flight) => flight.cancel());
    flights = [];
    stream?.remove();
    stream = undefined;
  }

  presence.on('change', (value) => {
    const opacity = Math.max(0, Math.min(1, value));
    if (stream) stream.style.opacity = String(opacity);
    rays.forEach((ray) => {
      ray.style.opacity = String(1 - opacity);
    });
    if (value === 0 && !hovered) stopStream();
  });

  function startStream() {
    if (stream) return;
    stream = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    stream.setAttribute('data-logo-stream', '');
    stream.style.opacity = String(presence.get());
    stream.style.pointerEvents = 'none';
    // Keep the stream behind the letter's outline.
    symbol.insertBefore(stream, symbol.firstChild);
    const shuffled = [...rays];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const smoothstep = (t: number) => t * t * (3 - 2 * t);
    shuffled.forEach((ray, index) => {
      const x = Number(ray.dataset.x);
      const y = Number(ray.dataset.y);
      // Sample exponential drag: velocity decreases continuously, never stopping abruptly.
      const keyframes = Array.from({ length: 31 }, (_, frame) => {
        const t = frame / 30;
        const travel = (1 - Math.exp(-1.8 * t)) / (1 - Math.exp(-1.8));
        // The ray's inner endpoint is 136 units from (250, 285); its 10-unit
        // round cap starts at radius 106, on the rounded part of the letter.
        const startDistance = -20;
        const endDistance = 112;
        const distance = startDistance + travel * (endDistance - startDistance);
        const opacity = t < 0.16 ? smoothstep(t / 0.16) : 1 - smoothstep((t - 0.16) / 0.84);
        return { offset: t, transform: `translate(${x * distance}px, ${y * distance}px)`, opacity };
      });
      const duration = durations.slow * 2000 * (0.85 + Math.random() * 0.3);
      // Two interleaved flights per direction keep new rays coming as older ones fade.
      for (let copy = 0; copy < 2; copy++) {
        const particle = ray.cloneNode(true) as SVGGElement;
        particle.removeAttribute('data-logo-ray');
        particle.setAttribute('data-logo-particle', '');
        particle.style.removeProperty('opacity');
        stream!.append(particle);
        flights.push(
          particle.animate(keyframes, {
            duration,
            delay: index * 30 + (copy * duration) / 2,
            iterations: Infinity,
            easing: 'linear',
            fill: 'both',
          }),
        );
      }
    });
  }

  return {
    setHovered(active: boolean) {
      hovered = active;
      if (active) startStream();
      scale.set(active ? 1.08 : 1);
      presence.set(active ? 1 : 0);
    },
    reset() {
      hovered = false;
      stopStream();
      scale.jump(1);
      presence.jump(0);
      symbol.style.removeProperty('transform');
      wordmark.style.removeProperty('transform');
      rays.forEach((ray) => ray.style.removeProperty('opacity'));
    },
  };
}
