import { AnimatePresence, m, useDragControls, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { durations, springs } from '../../motion/tokens';

interface Props {
  open: boolean;
  onClose(): void;
  title: string;
  size: 'auto' | 'tall';
  /** Receives focus when the sheet closes (usually the control that opened it). */
  returnFocusRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const CLOSE_DISTANCE_RATIO = 0.3;
const CLOSE_VELOCITY = 500;

/**
 * Bottom sheet. While open the page wrapper `[data-page]` is `inert` (which also keeps focus
 * inside the dialog) and `html[data-sheet-open]` scales it down; both are lifted on close and
 * on unmount.
 */
export function Sheet({ open, onClose, title, size, returnFocusRef, children }: Props) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  // Latest props for the listeners and cleanup, without re-running the open/close effect on
  // every parent render.
  const latest = useRef({ onClose, returnFocusRef });
  useEffect(() => {
    latest.current = { onClose, returnFocusRef };
  });

  useEffect(() => {
    if (!open) return;
    const page = document.querySelector<HTMLElement>('[data-page]');
    page?.setAttribute('inert', '');
    document.documentElement.setAttribute('data-sheet-open', '');

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      latest.current.onClose();
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      page?.removeAttribute('inert');
      document.documentElement.removeAttribute('data-sheet-open');
      latest.current.returnFocusRef.current?.focus();
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  const fade = { duration: durations.fast };

  return createPortal(
    <div data-sheet-root>
      <AnimatePresence>
        {open && (
          <>
            <m.div
              key="backdrop"
              data-sheet-backdrop
              aria-hidden="true"
              className="fixed inset-0 z-40"
              style={{ background: 'rgb(0 0 0 / 0.35)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduced ? fade : { duration: durations.base }}
              onClick={() => latest.current.onClose()}
            />
            <m.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="glass fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-2xl flex-col outline-none"
              style={{
                borderRadius: '22px 22px 0 0',
                borderBottom: 'none',
                paddingBottom: 'env(safe-area-inset-bottom)',
                ...(size === 'tall' ? { height: '92dvh' } : { maxHeight: '92dvh' }),
              }}
              initial={reduced ? { opacity: 0 } : { y: '100%' }}
              animate={reduced ? { opacity: 1 } : { y: 0 }}
              exit={reduced ? { opacity: 0 } : { y: '100%' }}
              transition={reduced ? fade : springs.sheet}
              drag={reduced ? false : 'y'}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={(_, info) => {
                const height = panelRef.current?.offsetHeight ?? 0;
                if (
                  info.offset.y > CLOSE_DISTANCE_RATIO * height ||
                  info.velocity.y > CLOSE_VELOCITY
                )
                  latest.current.onClose();
              }}
            >
              {/* Only the grip and title start a drag, so the content below can scroll freely. */}
              <div className="touch-none px-5 pt-2" onPointerDown={(e) => dragControls.start(e)}>
                <div
                  aria-hidden="true"
                  className="mx-auto h-1 w-9 rounded-full bg-white/40"
                  data-sheet-handle
                />
                <h2 id={titleId} className="py-3 text-xl font-semibold">
                  {title}
                </h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
                {children}
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
