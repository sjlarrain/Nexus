import { describe, expect, it } from 'vitest';
import { formatReplyRate, replyRateFor, type ReplyRateMessage } from '@/lib/profile/reply-rate';

const ME = 'me';
const THEM = 'them';

let clock = 1_000;
function msg(from: string, kind: 'text' | 'system' = 'text'): ReplyRateMessage {
  clock += 1000;
  return { from, kind, createdAt: clock };
}

/**
 * The definition is "replies divided by conversations started with you", so every case
 * below is really a question about what belongs in the denominator.
 */
describe('replyRateFor', () => {
  it('is null when nobody has opened a conversation', () => {
    expect(replyRateFor(ME, []).rate).toBeNull();
    expect(replyRateFor(ME, [[msg(ME)]]).rate).toBeNull();
  });

  it('counts a thread they opened and you answered', () => {
    expect(replyRateFor(ME, [[msg(THEM), msg(ME)]])).toEqual({ rate: 1, opened: 1, replied: 1 });
  });

  it('counts a thread they opened and you ignored', () => {
    expect(replyRateFor(ME, [[msg(THEM)]])).toEqual({ rate: 0, opened: 1, replied: 0 });
  });

  it('ignores threads you opened yourself', () => {
    const threads = [
      [msg(ME), msg(THEM)],
      [msg(THEM), msg(ME)],
    ];
    expect(replyRateFor(ME, threads)).toEqual({ rate: 1, opened: 1, replied: 1 });
  });

  it('ignores matches where nobody spoke', () => {
    expect(replyRateFor(ME, [[], [msg(THEM), msg(ME)]]).opened).toBe(1);
  });

  it('does not let a system message open a conversation', () => {
    // A booking notice arriving first must not make this look like they reached out.
    expect(replyRateFor(ME, [[msg('system', 'system'), msg(ME)]]).rate).toBeNull();
  });

  it('does not count a system message as your reply', () => {
    const threads = [[msg(THEM), msg('system', 'system')]];
    expect(replyRateFor(ME, threads)).toEqual({ rate: 0, opened: 1, replied: 0 });
  });

  it('reads unordered messages by createdAt, not array order', () => {
    const theirs = msg(THEM);
    const mine = msg(ME);
    expect(replyRateFor(ME, [[mine, theirs]]).opened).toBe(1);
  });

  it('averages across threads', () => {
    const threads = [[msg(THEM), msg(ME)], [msg(THEM)], [msg(THEM), msg(ME)], [msg(THEM)]];
    expect(replyRateFor(ME, threads).rate).toBe(0.5);
  });
});

describe('formatReplyRate', () => {
  it('rounds to a whole percent', () => {
    expect(formatReplyRate({ rate: 0.666, opened: 3, replied: 2 })).toBe('67%');
  });

  it('shows nothing when there is no rate', () => {
    expect(formatReplyRate({ rate: null, opened: 0, replied: 0 })).toBeNull();
  });
});
