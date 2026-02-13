import { describe, expect, it } from 'vitest';
import { isDateInRange, toLocalDateKey } from '../utils/date';

describe('date range helpers', () => {
  it('returns a stable local date key', () => {
    const key = toLocalDateKey('2026-02-14T10:30:00');
    const sameDayKey = toLocalDateKey('2026-02-14T23:59:59');
    expect(key).toBe(sameDayKey);
  });

  it('includes sales on the same day range', () => {
    expect(isDateInRange('2026-02-14T05:00:00Z', '2026-02-14', '2026-02-14')).toBe(true);
  });

  it('excludes sales outside the range', () => {
    expect(isDateInRange('2026-02-13T12:00:00', '2026-02-14', '2026-02-14')).toBe(false);
  });

  it('includes the start day and end day', () => {
    expect(isDateInRange('2026-03-01T00:00:00', '2026-03-01', '2026-03-03')).toBe(true);
    expect(isDateInRange('2026-03-03T23:59:59', '2026-03-01', '2026-03-03')).toBe(true);
  });

  it('handles ranges across months', () => {
    expect(isDateInRange('2026-03-01T12:00:00', '2026-02-27', '2026-03-02')).toBe(true);
  });

  it('returns false for invalid dates', () => {
    expect(isDateInRange('not-a-date', '2026-02-14', '2026-02-14')).toBe(false);
    expect(isDateInRange('2026-02-14T10:00:00', 'invalid', '2026-02-14')).toBe(false);
  });
});
