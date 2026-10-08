import { describe, expect, it } from 'vitest';
import { allocateEveningHalfPoints, formatEveningHalfPoints, tiedEveningHalfPoints } from '../src/domain/scoring/evening';

describe('BP-03 evening scoring', () => {
  it('splits tied places exactly', () => {
    expect(allocateEveningHalfPoints([10, 10, 5, 0])).toEqual([7, 7, 4, 2]);
    expect(tiedEveningHalfPoints(4, 1, 2)).toBe(7);
    expect(formatEveningHalfPoints(7)).toBe('3,5');
  });
  it('rejects invalid input', () => {
    expect(() => allocateEveningHalfPoints([1, 2])).toThrow();
    expect(() => allocateEveningHalfPoints([2, -1, 1])).toThrow();
    expect(() => allocateEveningHalfPoints([1, NaN, 2])).toThrow();
  });
  it('exhaustively conserves point totals for 3–5 teams over ternary scores', () => {
    for (const n of [3, 4, 5] as const) {
      for (let mask = 0; mask < 3 ** n; mask++) {
        let value = mask;
        const scores: number[] = [];
        for (let i = 0; i < n; i++) { scores.push(value % 3); value = Math.floor(value / 3); }
        const result = allocateEveningHalfPoints(scores);
        expect(result).toHaveLength(n);
        expect(result.reduce((sum, points) => sum + points, 0)).toBe(n * (n + 1));
      }
    }
  });
});
