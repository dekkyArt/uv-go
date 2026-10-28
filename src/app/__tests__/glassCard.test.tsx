import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlassCard } from '../cards/GlassCard';

describe('GlassCard', () => {
  it('is a region named by its title', () => {
    render(
      <GlassCard title="Hourly">
        <p>body</p>
      </GlassCard>,
    );
    const card = screen.getByRole('region', { name: 'Hourly' });
    expect(card.tagName).toBe('SECTION');
    expect(card).toHaveClass('glass');
  });

  it('puts the subtitle and action in the header and children in the body', () => {
    const { container } = render(
      <GlassCard
        title="Hourly"
        subtitle="Next 24 hours"
        action={<button type="button">Table</button>}
      >
        <p>content</p>
      </GlassCard>,
    );
    const header = container.querySelector<HTMLElement>('[data-card-header]');
    const body = container.querySelector<HTMLElement>('[data-card-body]');
    expect(header).not.toBeNull();
    expect(body).not.toBeNull();
    expect(within(header as HTMLElement).getByText('Next 24 hours')).toBeInTheDocument();
    expect(
      within(header as HTMLElement).getByRole('button', { name: 'Table' }),
    ).toBeInTheDocument();
    expect(within(body as HTMLElement).getByText('content')).toBeInTheDocument();
    expect(header).not.toContainElement(body);
  });

  it('omits the subtitle when absent and forwards className and cardRef', () => {
    const ref = { current: null as HTMLElement | null };
    render(
      <GlassCard title="Plan" className="extra" cardRef={ref}>
        <p>x</p>
      </GlassCard>,
    );
    const card = screen.getByRole('region', { name: 'Plan' });
    expect(card).toHaveClass('extra');
    expect(ref.current).toBe(card);
  });
});
