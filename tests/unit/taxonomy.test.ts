import { describe, expect, it } from 'vitest';
import {
  GICS_SECTORS,
  INTERESTS,
  OTHER_OPTION,
  POSITIONS_BY_SECTOR,
  SECTOR_OPTIONS,
  allPositions,
  positionsForSectors,
} from '@/lib/refdata/taxonomy';

/**
 * The industry → position narrowing behind steps 2 and 3. Both screens read the same
 * function, so these are the tests that stop the two grids drifting apart.
 */

describe('sectors', () => {
  it('is the eleven GICS sectors plus an escape hatch', () => {
    expect(GICS_SECTORS).toHaveLength(11);
    expect(SECTOR_OPTIONS).toHaveLength(12);
    expect(SECTOR_OPTIONS.at(-1)).toBe(OTHER_OPTION);
  });

  it('lists positions for every sector', () => {
    for (const sector of GICS_SECTORS) {
      expect(POSITIONS_BY_SECTOR[sector].length).toBeGreaterThan(0);
    }
  });
});

describe('positionsForSectors', () => {
  it('offers nothing until a sector is chosen', () => {
    expect(positionsForSectors([])).toEqual([]);
  });

  it('offers exactly that sector positions', () => {
    expect(positionsForSectors(['Real Estate'])).toEqual([...POSITIONS_BY_SECTOR['Real Estate']]);
  });

  it('unions several sectors without repeating a shared position', () => {
    // Both sectors list "Supply Chain & Procurement".
    const both = positionsForSectors(['Materials', 'Industrials']);
    expect(both.filter((entry) => entry === 'Supply Chain & Procurement')).toHaveLength(1);
    expect(new Set(both).size).toBe(both.length);
  });

  it('returns positions in sector order, not selection order', () => {
    const forward = positionsForSectors(['Energy', 'Financials']);
    const backward = positionsForSectors(['Financials', 'Energy']);
    expect(backward).toEqual(forward);
    expect(forward[0]).toBe(POSITIONS_BY_SECTOR.Energy[0]);
  });

  it('ignores a sector the user typed themselves', () => {
    expect(positionsForSectors(['Fintech', OTHER_OPTION])).toEqual([]);
    expect(positionsForSectors(['Utilities', 'Fintech'])).toEqual([
      ...POSITIONS_BY_SECTOR.Utilities,
    ]);
  });

  it('allPositions covers every sector and stays deduplicated', () => {
    const all = allPositions();
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain('Merchandising');
    expect(all).toContain('Risk Management');
  });
});

describe('interests', () => {
  it('is capped at sixteen options and has no duplicates', () => {
    expect(INTERESTS).toHaveLength(16);
    expect(new Set(INTERESTS).size).toBe(INTERESTS.length);
  });
});
