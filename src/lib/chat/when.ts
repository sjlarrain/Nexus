/**
 * Relative timestamps for the conversation list and the thread's date note
 * (docs/mocks/planup-chat-prototype.html: `t.when`, "You matched Aug 26").
 *
 * Deliberately not `toLocaleString`: the mock's shapes are "4m", "3h", "Tue" and
 * "Aug 26", and building those from fixed tables keeps the function pure and
 * testable rather than dependent on the runtime's locale data.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "Aug 26" — the absolute form, also used for the thread's "You matched" note. */
export function shortDate(at: number): string {
  const date = new Date(at);
  // getMonth() is 0-11 and getDay() 0-6, so neither lookup can miss; the fallbacks
  // are here because the index signature cannot say so.
  const month = MONTHS[date.getMonth()] ?? '';
  return `${month} ${date.getDate()}`.trim();
}

/**
 * How long ago, in the list's compact form. A timestamp in the future reads as "now"
 * rather than a negative age: clock skew between a client and the server is not
 * something the list should render.
 */
export function relativeWhen(at: number, now: number = Date.now()): string {
  const delta = now - at;
  if (delta < MINUTE) return 'now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  if (delta < WEEK) return WEEKDAYS[new Date(at).getDay()] ?? shortDate(at);
  return shortDate(at);
}
