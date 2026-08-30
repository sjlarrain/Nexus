import { describe, expect, it } from 'vitest';
import { relativeWhen, shortDate } from '@/lib/chat/when';

/** The four shapes the chat mock asks for: "now", "4m", "3h", "Tue", "Aug 26". */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A Wednesday, so the weekday branch has something to name. */
const NOW = new Date('2026-08-26T15:00:00').getTime();

describe('relativeWhen', () => {
  it('reads as "now" under a minute', () => {
    expect(relativeWhen(NOW, NOW)).toBe('now');
    expect(relativeWhen(NOW - 59_000, NOW)).toBe('now');
  });

  it('counts whole minutes, then whole hours', () => {
    expect(relativeWhen(NOW - MINUTE, NOW)).toBe('1m');
    expect(relativeWhen(NOW - 59 * MINUTE, NOW)).toBe('59m');
    expect(relativeWhen(NOW - HOUR, NOW)).toBe('1h');
    expect(relativeWhen(NOW - 23 * HOUR, NOW)).toBe('23h');
  });

  it('names the weekday inside the last week', () => {
    expect(relativeWhen(NOW - DAY, NOW)).toBe('Tue');
    expect(relativeWhen(NOW - 6 * DAY, NOW)).toBe('Thu');
  });

  it('falls back to a date beyond a week', () => {
    expect(relativeWhen(NOW - 8 * DAY, NOW)).toBe('Aug 18');
  });

  // Clock skew between a client and the server should not render as a negative age.
  it('treats a future timestamp as now', () => {
    expect(relativeWhen(NOW + HOUR, NOW)).toBe('now');
  });
});

describe('shortDate', () => {
  it('is the mock\'s "Aug 26"', () => {
    expect(shortDate(NOW)).toBe('Aug 26');
  });
});
