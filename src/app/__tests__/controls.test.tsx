import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDay, scored } from '../../domain/__tests__/factories';
import type { Place } from '../../data/types';
import { CitySearch } from '../components/CitySearch';
import { FreeTimePicker } from '../components/FreeTimePicker';
import { HourStrip } from '../components/HourStrip';
import { LocationPicker } from '../components/LocationPicker';
import { SegmentedControl } from '../components/SegmentedControl';

const lisbon: Place = {
  id: 1,
  name: 'Lisbon',
  admin1: 'Lisbon',
  country: 'Portugal',
  lat: 38.72,
  lon: -9.14,
};

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SegmentedControl', () => {
  function Harness() {
    const [value, setValue] = useState<'a' | 'b'>('a');
    return (
      <SegmentedControl<'a' | 'b'>
        label="Letter"
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  }

  it('is a labelled radiogroup with aria-checked on the current option', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Letter' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'false');
  });

  it('ArrowRight selects the next option and moves focus to it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('radio', { name: 'Alpha' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking an option selects it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('FreeTimePicker', () => {
  it('exposes two sliders with aria-valuetext as HH:00', () => {
    render(<FreeTimePicker value={{ start: 13, end: 19 }} onChange={vi.fn()} />);
    expect(screen.getByRole('slider', { name: 'Free time start' })).toHaveAttribute(
      'aria-valuetext',
      '13:00',
    );
    expect(screen.getByRole('slider', { name: 'Free time end' })).toHaveAttribute(
      'aria-valuetext',
      '19:00',
    );
  });

  it('arrow keys move a handle by one hour', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeTimePicker value={{ start: 13, end: 19 }} onChange={onChange} />);
    screen.getByRole('slider', { name: 'Free time start' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith({ start: 14, end: 19 });
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith({ start: 12, end: 19 });
  });

  it('ArrowRight on start does not move it when the window is already 1 h', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeTimePicker value={{ start: 13, end: 14 }} onChange={onChange} />);
    screen.getByRole('slider', { name: 'Free time start' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ArrowLeft on end does not move it when the window is already 1 h', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeTimePicker value={{ start: 13, end: 14 }} onChange={onChange} />);
    screen.getByRole('slider', { name: 'Free time end' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the handles inside 0..24', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeTimePicker value={{ start: 0, end: 24 }} onChange={onChange} />);
    screen.getByRole('slider', { name: 'Free time start' }).focus();
    await user.keyboard('{ArrowLeft}');
    screen.getByRole('slider', { name: 'Free time end' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('HourStrip', () => {
  // Hour 15 has UV 4 -> 2 points -> green; UV 6 -> yellow.
  const day = makeDay({ 15: { uv: 6 }, 16: { uv: 4 }, 3: { isDay: false } });
  const hours = scored(day, 'relaxed');

  function setup(selectedHour: number | null, onSelect = vi.fn()) {
    render(
      <HourStrip
        hours={hours}
        freeTime={{ start: 13, end: 19 }}
        best={null}
        selectedHour={selectedHour}
        onSelect={onSelect}
      />,
    );
    return { onSelect, slider: screen.getByRole('slider', { name: 'Hour of the day' }) };
  }

  it('describes the selected hour in aria-valuetext', () => {
    const { slider } = setup(15);
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '23');
    expect(slider).toHaveAttribute('aria-valuenow', '15');
    expect(slider).toHaveAttribute('aria-valuetext', '15:00, UV 6, OK with protection');
  });

  it('says night for dark hours', () => {
    const { slider } = setup(3);
    expect(slider).toHaveAttribute('aria-valuetext', '03:00, night');
  });

  it('ArrowRight / ArrowLeft select the neighbouring hour', async () => {
    const user = userEvent.setup();
    const { slider, onSelect } = setup(15);
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenLastCalledWith(16);
    await user.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenLastCalledWith(14);
  });

  it('selects a cell on click, not on pointerdown (a touch scroll starts with pointerdown)', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup(null);
    const cell = document.querySelector('[data-hour="10"]')!;
    fireEvent.pointerDown(cell, { pointerType: 'touch', clientX: 100 });
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(cell);
    expect(onSelect).toHaveBeenCalledWith(10);
  });

  it('scrubs only after horizontal travel beyond the threshold', () => {
    const { slider, onSelect } = setup(null);
    slider.getBoundingClientRect = () => ({ left: 0, width: 240 }) as DOMRect;
    fireEvent.pointerDown(slider, { clientX: 100, buttons: 1 });
    fireEvent.pointerMove(slider, { clientX: 103, buttons: 1 });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.pointerMove(slider, { clientX: 125, buttons: 1 });
    expect(onSelect).toHaveBeenLastCalledWith(12);
  });

  it('does not select while moving without a press', () => {
    const { slider, onSelect } = setup(null);
    slider.getBoundingClientRect = () => ({ left: 0, width: 240 }) as DOMRect;
    fireEvent.pointerMove(slider, { clientX: 200, buttons: 0 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks every hour with a non-colour cue and shows a legend with the same cues', () => {
    setup(null);
    // day: hour 15 yellow (UV 6), hour 16 green, hour 3 night.
    const glyphs = (hour: number) => document.querySelector(`[data-hour="${hour}"] svg`)!.innerHTML;
    expect(glyphs(16)).not.toBe(glyphs(15));
    expect(glyphs(3)).not.toBe(glyphs(16));
    expect(glyphs(3)).not.toBe(glyphs(15));
    expect(document.querySelectorAll('[data-hour] svg')).toHaveLength(24);
    for (const label of ['Good hour', 'Needs protection', 'Not recommended', 'Night']) {
      expect(screen.getByText(label, { selector: 'li', exact: false })).toBeInTheDocument();
    }
  });

  it('does not go past the ends of the day', async () => {
    const user = userEvent.setup();
    const { slider, onSelect } = setup(23);
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('CitySearch', () => {
  function setup(onSelect = vi.fn()) {
    render(<CitySearch onSelect={onSelect} inputRef={createRef<HTMLInputElement>()} />);
    return { onSelect, input: screen.getByRole('combobox') };
  }

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
      {
        id: 2,
        name: 'Lisburn',
        admin1: 'Northern Ireland',
        country: 'United Kingdom',
        latitude: 54.5,
        longitude: -6,
      },
    ],
  };

  it('ArrowDown then Enter selects the first result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(lisbonResults));
    const user = userEvent.setup();
    const { input, onSelect } = setup();
    await user.type(input, 'Lis');
    expect(await screen.findByRole('option', { name: 'Lisbon, Portugal' })).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Lisbon, Portugal' }).id,
    );
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lisbon', lat: 38.7 }));
  });

  it('Escape closes the list', async () => {
    fetchMock.mockResolvedValue(jsonResponse(lisbonResults));
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, 'Lis');
    await screen.findByRole('option', { name: 'Lisbon, Portugal' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('says so when nothing is found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, 'Zzz');
    expect(await screen.findByText('No cities found')).toBeInTheDocument();
  });

  it('says so when search is unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, 'Lis');
    expect(await screen.findByText('Search is unavailable. Try again.')).toBeInTheDocument();
  });
});

describe('LocationPicker', () => {
  it('shows the place compactly with a Change button', async () => {
    const user = userEvent.setup();
    render(<LocationPicker place={lisbon} onPlace={vi.fn()} />);
    expect(screen.getByText('Lisbon, Portugal')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('without a place offers geolocation and search', () => {
    render(<LocationPicker place={null} onPlace={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('does not ask for geolocation until the button is pressed', () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    render(<LocationPicker place={null} onPlace={vi.fn()} />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('turns a granted position into the Your location place', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 10, longitude: 20 } } as GeolocationPosition),
      },
      configurable: true,
    });
    const onPlace = vi.fn();
    const user = userEvent.setup();
    render(<LocationPicker place={null} onPlace={onPlace} />);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    await waitFor(() =>
      expect(onPlace).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Your location', lat: 10, lon: 20 }),
      ),
    );
  });
});
