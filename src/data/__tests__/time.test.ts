import { describe, expect, it, vi } from 'vitest';
import { nowLocal } from '../time';

describe('nowLocal', () => {
  it('shifts UTC by the location offset', () => {
    expect(nowLocal(3600, Date.UTC(2026, 9, 27, 13, 10))).toEqual({
      date: '2026-10-27',
      hour: 14,
      minute: 10,
    });
  });

  it('rolls back to the previous date for negative offsets', () => {
    expect(nowLocal(-18000, Date.UTC(2026, 9, 27, 3, 0))).toEqual({
      date: '2026-10-26',
      hour: 22,
      minute: 0,
    });
  });

  it('rolls forward to the next date for large positive offsets', () => {
    expect(nowLocal(19800, Date.UTC(2026, 9, 27, 20, 45))).toEqual({
      date: '2026-10-28',
      hour: 2,
      minute: 15,
    });
  });

  it('defaults to the current time', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.UTC(2026, 9, 27, 13, 10));
      expect(nowLocal(7200)).toEqual({ date: '2026-10-27', hour: 15, minute: 10 });
    } finally {
      vi.useRealTimers();
    }
  });
});
