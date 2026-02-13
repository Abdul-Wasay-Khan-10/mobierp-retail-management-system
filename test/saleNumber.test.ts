import { describe, expect, it } from 'vitest';
import { buildSaleNumber } from '../utils/sales';

describe('buildSaleNumber', () => {
  it('creates the first sale number when none exists', () => {
    expect(buildSaleNumber('14022026', null)).toBe('SALE-14022026-0001');
  });

  it('increments from the last sale number', () => {
    expect(buildSaleNumber('14022026', 'SALE-14022026-0012')).toBe('SALE-14022026-0013');
  });

  it('handles malformed last sale number', () => {
    expect(buildSaleNumber('14022026', 'SALE-14022026-XYZ')).toBe('SALE-14022026-0001');
  });

  it('uses the provided date key', () => {
    expect(buildSaleNumber('01012027', 'SALE-01012027-0099')).toBe('SALE-01012027-0100');
  });
});
