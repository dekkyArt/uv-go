import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeoError, requestPosition, yourLocationPlace } from '../../data/geolocation';
import type { Place } from '../../data/types';
import { MotionProvider } from '../../motion/MotionProvider';
import { CitiesSheet } from '../sheet/CitiesSheet';
import { GEO_ERROR } from '../ui';

vi.mock('../../data/geolocation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/geolocation')>()),
  requestPosition: vi.fn(),
}));

const requestPositionMock = vi.mocked(requestPosition);

const lisbon: Place = {
  id: 1,
  name: 'Lisbon',
  admin1: 'Lisbon',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.14,
};

const lisbonResults = {
  results: [
    {
      id: 1,
      name: 'Lisbon',
      admin1: 'Lisbon',
      country: 'Portugal',
      latitude: 38.7,
      longitude: -9.1,
    },
  ],
};

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  document.body.innerHTML = '';
  fetchMock.mockReset();
  requestPositionMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-sheet-open');
});

function setup(props: Partial<Parameters<typeof CitiesSheet>[0]> = {}) {
  const onPlace = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <MotionProvider>
      <div data-page />
      <CitiesSheet
        open
        onClose={onClose}
        place={null}
        onPlace={onPlace}
        returnFocusRef={createRef<HTMLElement>()}
        {...props}
      />
    </MotionProvider>,
  );
  return { onPlace, onClose, ...utils };
}

describe('CitiesSheet', () => {
  it('is a dialog titled Cities that shows the current place', () => {
    setup({ place: lisbon });
    expect(screen.getByRole('dialog', { name: 'Cities' })).toBeInTheDocument();
    expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument();
  });

  it('puts the cursor in the search on open', () => {
    setup();
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
  });

  it('picks a searched city and closes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(lisbonResults));
    const user = userEvent.setup();
    const { onPlace, onClose } = setup();
    await user.type(screen.getByRole('combobox'), 'Lis');
    await user.click(await screen.findByRole('option', { name: 'Lisbon, Portugal' }));
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lisbon', lat: 38.7 }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has a Close button that closes', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turns a granted position into the Your location place and closes', async () => {
    requestPositionMock.mockResolvedValue({ lat: 10, lon: 20 });
    const user = userEvent.setup();
    const { onPlace, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    await waitFor(() => expect(onPlace).toHaveBeenCalledWith(yourLocationPlace(10, 20)));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the error and puts focus in the search when the position is refused', async () => {
    requestPositionMock.mockRejectedValue(new GeoError('denied'));
    const user = userEvent.setup();
    const { onPlace, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(GEO_ERROR);
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    expect(onPlace).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clears the error on the next attempt', async () => {
    requestPositionMock.mockRejectedValueOnce(new GeoError('timeout'));
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(await screen.findByText(GEO_ERROR)).toBeInTheDocument();
    requestPositionMock.mockReturnValueOnce(new Promise(() => {}));
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.queryByText(GEO_ERROR)).not.toBeInTheDocument();
  });

  it('shows Locating… and disables the button while the position is pending', async () => {
    requestPositionMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    const busy = screen.getByRole('button', { name: 'Locating…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });

  it('does not touch state or console when unmounted while locating', async () => {
    let resolve!: (v: { lat: number; lon: number }) => void;
    requestPositionMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const { onPlace, unmount } = setup();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    unmount();
    resolve({ lat: 1, lon: 2 });
    await new Promise((r) => setTimeout(r, 0));
    expect(onPlace).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
