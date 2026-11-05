import { useEffect, useId, useRef, useState } from 'react';

/** A short guide shared by the desktop Plan card and the mobile sheet. */
export function PlanHelp({ onNavigate }: { onNavigate?(): void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  return (
    <div
      ref={root}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="How to use Plan"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="relative flex size-5 items-center justify-center rounded-full text-text-muted before:absolute before:-inset-3 before:content-[''] hover:text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="size-[18px]"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2-2.5 4" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          className="absolute -left-14 top-8 z-30 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-white/20 bg-[rgb(var(--glass-rgb))] p-4 text-sm font-normal leading-5 text-text shadow-xl"
        >
          <p>
            Choose a day, your free hours, duration and activity. UV GO compares daylight windows
            starting on the hour and shows the lowest weather score. A 30-minute outing uses one
            hour of forecast data. All times are local to your chosen place.
          </p>
          <a
            href="#how-it-works"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-white/10 px-3 font-semibold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={(event) => {
              const section = document.getElementById('how-it-works');
              if (!section) return;
              event.preventDefault();
              setOpen(false);
              onNavigate?.();
              // Let the sheet remove inert and restore focus before navigating away.
              requestAnimationFrame(() => {
                section.scrollIntoView({
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'instant'
                    : 'smooth',
                  block: 'start',
                });
                section.focus({ preventScroll: true });
              });
            }}
          >
            Learn more
          </a>
        </div>
      )}
    </div>
  );
}
