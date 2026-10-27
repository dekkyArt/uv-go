import { useEffect, useState } from 'react';

/**
 * True while `element` has scrolled out of view above the viewport. Without IntersectionObserver
 * (old browsers, jsdom without a mock) it stays false, so the mini result never shows.
 */
export function useCardOffscreen(element: Element | null): boolean {
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    if (element === null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      setOffscreen(!entry.isIntersecting && (entry.boundingClientRect?.top ?? -1) < 0);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      setOffscreen(false);
    };
  }, [element]);

  return element !== null && offscreen;
}
