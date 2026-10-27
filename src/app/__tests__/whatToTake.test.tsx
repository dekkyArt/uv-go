import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChecklistItem } from '../../domain/types';
import { HatSunglasses } from '../icons/checklist/HatSunglasses';
import { RainJacket } from '../icons/checklist/RainJacket';
import { Sunscreen } from '../icons/checklist/Sunscreen';
import { WarmLayer } from '../icons/checklist/WarmLayer';
import { Water } from '../icons/checklist/Water';
import { WhatToTake } from '../components/WhatToTake';

const ALL: ChecklistItem[] = [
  { id: 'sunscreen', label: 'Sunscreen' },
  { id: 'hat-sunglasses', label: 'Hat and sunglasses' },
  { id: 'rain-jacket', label: 'Rain jacket' },
  { id: 'water', label: 'Water' },
  { id: 'warm-layer', label: 'Warm layer' },
];

const labels = () => screen.getAllByRole('listitem').map((li) => li.textContent);
const iconOf = (label: string) => within(screen.getByText(label)).getByTestId('checklist-icon');

describe('WhatToTake', () => {
  it('shows the given items with their labels in the given order', () => {
    render(<WhatToTake items={ALL} />);
    expect(labels()).toEqual(ALL.map((i) => i.label));
  });

  it('shows the empty text when nothing is needed', () => {
    render(<WhatToTake items={[]} />);
    expect(screen.getByText('Nothing extra needed.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('removes a dropped item after its exit finishes', async () => {
    const { rerender } = render(<WhatToTake items={ALL.slice(0, 3)} />);
    rerender(<WhatToTake items={[ALL[0], ALL[2]]} />);
    await waitFor(() => expect(screen.queryByText('Hat and sunglasses')).not.toBeInTheDocument());
    expect(labels()).toEqual(['Sunscreen', 'Rain jacket']);
  });

  it('gives every item a decorative 32x32 icon', () => {
    render(<WhatToTake items={ALL} />);
    for (const { label } of ALL) {
      const icon = iconOf(label);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveAttribute('viewBox', '0 0 32 32');
    }
  });

  it('plays the micro-animation only for items that have just appeared', () => {
    const { rerender } = render(<WhatToTake items={[ALL[3]]} />);
    expect(iconOf('Water')).toHaveAttribute('data-play', 'false');
    rerender(<WhatToTake items={[ALL[0], ALL[3]]} />);
    expect(iconOf('Sunscreen')).toHaveAttribute('data-play', 'true');
    expect(iconOf('Water')).toHaveAttribute('data-play', 'false');
    rerender(<WhatToTake items={[ALL[0], ALL[3], ALL[4]]} />);
    expect(iconOf('Sunscreen')).toHaveAttribute('data-play', 'true');
    expect(iconOf('Warm layer')).toHaveAttribute('data-play', 'true');
    expect(iconOf('Water')).toHaveAttribute('data-play', 'false');
  });

  it('plays again when an item that was there at the start leaves and comes back', async () => {
    const { rerender } = render(<WhatToTake items={[ALL[3], ALL[0]]} />);
    rerender(<WhatToTake items={[ALL[0]]} />);
    await waitFor(() => expect(screen.queryByText('Water')).not.toBeInTheDocument());
    rerender(<WhatToTake items={[ALL[3], ALL[0]]} />);
    expect(iconOf('Water')).toHaveAttribute('data-play', 'true');
    expect(iconOf('Sunscreen')).toHaveAttribute('data-play', 'false');
  });

  it('plays the icons of the intro items', () => {
    render(<WhatToTake items={ALL.slice(0, 2)} intro />);
    expect(iconOf('Sunscreen')).toHaveAttribute('data-play', 'true');
    expect(iconOf('Hat and sunglasses')).toHaveAttribute('data-play', 'true');
  });
});

describe('checklist icons', () => {
  it.each([
    ['Sunscreen', Sunscreen],
    ['HatSunglasses', HatSunglasses],
    ['RainJacket', RainJacket],
    ['Water', Water],
    ['WarmLayer', WarmLayer],
  ])('%s renders a decorative svg driven by play', (_name, Icon) => {
    const { container, rerender } = render(<Icon play />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-play', 'true');
    rerender(<Icon play={false} />);
    expect(container.querySelector('svg')).toHaveAttribute('data-play', 'false');
  });
});
