import { describe, expect, it } from 'vitest';
import { formatInterval } from './format';

describe('formatInterval', () => {
  it.each([
    [60_000, '1 min'],
    [10 * 60_000, '10 min'],
    [3 * 3_600_000, '3 h'],
    [4 * 86_400_000, '4 d'],
    [61 * 86_400_000, '2 meses'],
    [400 * 86_400_000, '1,1 años'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatInterval(ms)).toBe(text);
  });
});
