/**
 * "Add to calendar" for a confirmed coffee — a Google Calendar link, not a real .ics
 * export (no server-side calendar integration exists), but a genuine one: it opens
 * pre-filled and the event is real once added.
 */

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function toUtcStamp(at: number): string {
  return new Date(at).toISOString().replace(/[-:]|\.\d{3}/g, '');
}

export function googleCalendarUrl(args: {
  startsAt: number;
  withName: string;
  where: string | null;
}): string {
  const { startsAt, withName, where } = args;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Coffee with ${withName}`,
    dates: `${toUtcStamp(startsAt)}/${toUtcStamp(startsAt + THIRTY_MINUTES_MS)}`,
    details: where ? `Meeting at ${where}.` : 'Video call — details in the Warm Intro chat.',
  });
  if (where) params.set('location', where);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
