import { describe, expect, it } from 'vitest';
import { activitySummary, buildActivity, type ActivityInput } from '@/lib/activity/feed';

const ME = 'me';
const THEM = 'them';

function input(overrides: Partial<ActivityInput> = {}): ActivityInput {
  return { uid: ME, likes: [], matches: [], bookings: [], ...overrides };
}

describe('buildActivity', () => {
  it('is empty when nothing has happened', () => {
    expect(buildActivity(input())).toEqual([]);
  });

  it('sorts newest first across every source', () => {
    const events = buildActivity(
      input({
        likes: [{ name: 'Priya Raman', priority: false, createdAt: 100 }],
        matches: [{ matchId: 'm1', name: 'Daniel Okafor', createdAt: 300, lastMessage: null }],
        bookings: [
          {
            matchId: 'm1',
            name: 'Daniel Okafor',
            venueName: 'Sightglass Coffee',
            status: 'confirmed',
            updatedAt: 200,
          },
        ],
      }),
    );
    expect(events.map((event) => event.kind)).toEqual(['match', 'booking', 'like']);
  });

  it('marks a priority ask and says so', () => {
    const [event] = buildActivity(
      input({ likes: [{ name: 'Priya Raman', priority: true, createdAt: 1 }] }),
    );
    expect(event?.emphasis).toBe(true);
    expect(event?.text).toBe('Priya Raman sent you a priority ask');
  });

  it('reports their last message but never your own', () => {
    const mine = buildActivity(
      input({
        matches: [
          {
            matchId: 'm1',
            name: 'Daniel Okafor',
            createdAt: 1,
            lastMessage: { text: 'hello', at: 2, from: ME },
          },
        ],
      }),
    );
    expect(mine.map((event) => event.kind)).toEqual(['match']);

    const theirs = buildActivity(
      input({
        matches: [
          {
            matchId: 'm1',
            name: 'Daniel Okafor',
            createdAt: 1,
            lastMessage: { text: 'hello', at: 2, from: THEM },
          },
        ],
      }),
    );
    expect(theirs.map((event) => event.kind)).toEqual(['message', 'match']);
  });

  it('does not report a system message as a message from them', () => {
    const events = buildActivity(
      input({
        matches: [
          {
            matchId: 'm1',
            name: 'Daniel Okafor',
            createdAt: 1,
            lastMessage: { text: 'A coffee was proposed.', at: 2, from: 'system' },
          },
        ],
      }),
    );
    expect(events.map((event) => event.kind)).toEqual(['match']);
  });

  it('truncates a long message preview', () => {
    const long = 'x'.repeat(200);
    const events = buildActivity(
      input({
        matches: [
          {
            matchId: 'm1',
            name: 'Daniel',
            createdAt: 1,
            lastMessage: { text: long, at: 2, from: THEM },
          },
        ],
      }),
    );
    expect(events[0]?.text.length).toBeLessThan(80);
    expect(events[0]?.text.endsWith('…')).toBe(true);
  });

  it('names each booking state', () => {
    const statuses = (['proposed', 'confirmed', 'cancelled'] as const).map((status) => {
      const [event] = buildActivity(
        input({
          bookings: [
            { matchId: 'm1', name: 'Daniel', venueName: 'Sightglass', status, updatedAt: 1 },
          ],
        }),
      );
      return event?.text;
    });
    expect(statuses).toEqual([
      'Daniel proposed a coffee at Sightglass',
      'Coffee with Daniel is confirmed at Sightglass',
      'The coffee with Daniel was cancelled',
    ]);
  });

  it('honours the limit', () => {
    const likes = Array.from({ length: 30 }, (_, index) => ({
      name: `Person ${index}`,
      priority: false,
      createdAt: index,
    }));
    expect(buildActivity(input({ likes }), 5)).toHaveLength(5);
  });
});

describe('activitySummary', () => {
  it('is null when there is nothing to summarise', () => {
    expect(activitySummary([])).toBeNull();
  });

  it('counts likes and messages, singular and plural', () => {
    const events = buildActivity(
      input({
        likes: [
          { name: 'A', priority: false, createdAt: 1 },
          { name: 'B', priority: false, createdAt: 2 },
        ],
        matches: [
          {
            matchId: 'm1',
            name: 'C',
            createdAt: 3,
            lastMessage: { text: 'hi', at: 4, from: THEM },
          },
        ],
      }),
    );
    expect(activitySummary(events)).toBe('2 people liked you · 1 new message');
  });
});
