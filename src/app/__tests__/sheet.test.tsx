import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../motion/MotionProvider';
import { Sheet } from '../sheet/Sheet';

type SheetProps = Parameters<typeof Sheet>[0];

function Harness({
  returnFocusRef,
  ...props
}: Partial<SheetProps> & { returnFocusRef: RefObject<HTMLElement | null> }) {
  return (
    <MotionProvider>
      <div data-page>
        <button ref={returnFocusRef as RefObject<HTMLButtonElement>}>Open plan</button>
      </div>
      <Sheet
        open
        onClose={() => {}}
        title="Plan"
        size="auto"
        returnFocusRef={returnFocusRef}
        {...props}
      >
        <button>First action</button>
        <button>Second action</button>
      </Sheet>
    </MotionProvider>
  );
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.documentElement.removeAttribute('data-sheet-open');
});

describe('Sheet', () => {
  it('opens as a labelled modal dialog, inerts the page and focuses its first control', () => {
    const returnFocusRef = createRef<HTMLElement>();
    render(<Harness returnFocusRef={returnFocusRef} />);

    const dialog = screen.getByRole('dialog', { name: 'Plan' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Plan' })).toBeVisible();
    expect(document.querySelector('[data-page]')).toHaveAttribute('inert');
    expect(document.documentElement).toHaveAttribute('data-sheet-open');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First action' }));
  });

  it('inerts the fixed layers next to the page as well, and lifts it on close', () => {
    const layers = document.createElement('div');
    layers.setAttribute('data-fixed-layers', '');
    document.body.appendChild(layers);
    const returnFocusRef = createRef<HTMLElement>();
    const { rerender } = render(<Harness returnFocusRef={returnFocusRef} />);
    expect(layers).toHaveAttribute('inert');

    rerender(<Harness returnFocusRef={returnFocusRef} open={false} />);
    expect(layers).not.toHaveAttribute('inert');
  });

  it('scales the page around the middle of the viewport, wherever it is scrolled', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(600);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);
    render(<Harness returnFocusRef={createRef<HTMLElement>()} />);
    expect(
      document.querySelector<HTMLElement>('[data-page]')!.style.getPropertyValue('--page-origin-y'),
    ).toBe(`${600 + 844 / 2}px`);
    vi.restoreAllMocks();
  });

  it('portals into document.body outside [data-page]', () => {
    const returnFocusRef = createRef<HTMLElement>();
    render(<Harness returnFocusRef={returnFocusRef} />);

    const root = document.querySelector('[data-sheet-root]');
    expect(root).not.toBeNull();
    expect(root!.parentElement).toBe(document.body);
    expect(document.querySelector('[data-page]')!.contains(root)).toBe(false);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness returnFocusRef={createRef<HTMLElement>()} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click', () => {
    const onClose = vi.fn();
    render(<Harness returnFocusRef={createRef<HTMLElement>()} onClose={onClose} />);
    fireEvent.click(document.querySelector('[data-sheet-backdrop]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the panel itself is clicked', () => {
    const onClose = vi.fn();
    render(<Harness returnFocusRef={createRef<HTMLElement>()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'First action' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('on close lifts inert and data-sheet-open and restores focus', () => {
    const returnFocusRef = createRef<HTMLElement>();
    const { rerender } = render(<Harness returnFocusRef={returnFocusRef} />);
    expect(document.querySelector('[data-page]')).toHaveAttribute('inert');

    rerender(<Harness returnFocusRef={returnFocusRef} open={false} />);

    expect(document.querySelector('[data-page]')).not.toHaveAttribute('inert');
    expect(document.documentElement).not.toHaveAttribute('data-sheet-open');
    expect(document.activeElement).toBe(returnFocusRef.current);
  });

  it('lifts inert and data-sheet-open when unmounted while open', () => {
    const returnFocusRef = createRef<HTMLElement>();
    const { unmount } = render(<Harness returnFocusRef={returnFocusRef} />);
    expect(document.querySelector('[data-page]')).toHaveAttribute('inert');

    unmount();

    expect(document.querySelector('[data-page]')).toBeNull();
    expect(document.documentElement).not.toHaveAttribute('data-sheet-open');
  });

  it('unmounting while open leaves a surviving page interactive', () => {
    const page = document.createElement('div');
    page.setAttribute('data-page', '');
    document.body.appendChild(page);
    const { unmount } = render(
      <MotionProvider>
        <Sheet open onClose={() => {}} title="Plan" size="tall" returnFocusRef={createRef()}>
          <button>Go</button>
        </Sheet>
      </MotionProvider>,
    );
    expect(page).toHaveAttribute('inert');
    unmount();
    expect(page).not.toHaveAttribute('inert');
    expect(document.documentElement).not.toHaveAttribute('data-sheet-open');
  });

  it('renders nothing and leaves the page alone while closed', () => {
    render(<Harness returnFocusRef={createRef<HTMLElement>()} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[data-page]')).not.toHaveAttribute('inert');
    expect(document.documentElement).not.toHaveAttribute('data-sheet-open');
  });

  it('removes the dialog after the exit animation finishes', async () => {
    const returnFocusRef = createRef<HTMLElement>();
    const { rerender } = render(<Harness returnFocusRef={returnFocusRef} />);
    rerender(<Harness returnFocusRef={returnFocusRef} open={false} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1200));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
