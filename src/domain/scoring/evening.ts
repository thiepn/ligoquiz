/**
 * BP-03 event-placement scoring. Store exact half-points as integers.
 * A completed game distributes n(n + 1)/2 displayed evening points.
 */
export function tiedEveningHalfPoints(
  teamCount: 3 | 4 | 5,
  firstOccupiedPlace: number,
  tiedCount: number,
): number {
  if (!Number.isInteger(firstOccupiedPlace) || !Number.isInteger(tiedCount)
    || tiedCount < 1 || firstOccupiedPlace < 1
    || firstOccupiedPlace + tiedCount - 1 > teamCount) {
    throw new RangeError('Invalid occupied places');
  }
  return 2 * (teamCount - firstOccupiedPlace + 1) - (tiedCount - 1);
}
export function allocateEveningHalfPoints(rawScores: readonly number[]): number[] {
  if (![3, 4, 5].includes(rawScores.length)
    || rawScores.some((score) => !Number.isSafeInteger(score) || score < 0)) {
    throw new RangeError('Expected 3–5 non-negative integer scores');
  }
  const n = rawScores.length as 3 | 4 | 5;
  const sorted = rawScores.map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score);
  const result = Array<number>(n).fill(0);
  for (let i = 0; i < n;) {
    let end = i + 1;
    while (end < n && sorted[end]?.score === sorted[i]?.score) end++;
    const halfPoints = tiedEveningHalfPoints(n, i + 1, end - i);
    for (let j = i; j < end; j++) {
      const item = sorted[j];
      if (item) result[item.index] = halfPoints;
    }
    i = end;
  }
  return result;
}
export function formatEveningHalfPoints(halfPoints: number): string {
  if (!Number.isSafeInteger(halfPoints) || halfPoints < 0) throw new RangeError('Invalid half-points');
  const whole = Math.floor(halfPoints / 2);
  return halfPoints % 2 ? String(whole) + ',5' : String(whole);
}
