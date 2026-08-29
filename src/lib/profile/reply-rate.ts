/**
 * Reply rate (BACKLOG E11.2).
 *
 * Definition, decided by the owner and recorded in docs/decisions.md:
 * **replies divided by conversations started with you.**
 *
 * So the denominator is not "all your matches" — it is only the conversations where
 * the other person opened. Matches nobody ever spoke in, and matches you opened
 * yourself, are excluded: neither says anything about whether you reply.
 *
 * Pure on purpose. It takes messages, not Firestore documents, so every rule below is
 * a table test rather than a fixture.
 */

/** The only fields of a message this needs. */
export type ReplyRateMessage = {
  from: string;
  kind: 'text' | 'system';
  createdAt: number;
};

export type ReplyRate = {
  /** 0..1, or null when nobody has opened a conversation with you yet. */
  rate: number | null;
  /** Conversations someone else opened. */
  opened: number;
  /** How many of those you answered. */
  replied: number;
};

/**
 * System messages ("a coffee was proposed") are not conversation. Counting them would
 * let a booking inflate the rate without anyone typing a word.
 */
function humanMessages(thread: readonly ReplyRateMessage[]): ReplyRateMessage[] {
  return thread
    .filter((message) => message.kind === 'text')
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function replyRateFor(
  uid: string,
  threads: readonly (readonly ReplyRateMessage[])[],
): ReplyRate {
  let opened = 0;
  let replied = 0;

  for (const thread of threads) {
    const messages = humanMessages(thread);
    const first = messages[0];

    // Nobody spoke, or you opened it yourself: tells us nothing about your replying.
    if (!first || first.from === uid) continue;

    opened += 1;
    if (messages.some((message) => message.from === uid)) replied += 1;
  }

  return {
    rate: opened === 0 ? null : replied / opened,
    opened,
    replied,
  };
}

/** "78%" for the profile screen, or null when there is nothing honest to show. */
export function formatReplyRate(value: ReplyRate): string | null {
  if (value.rate === null) return null;
  return `${Math.round(value.rate * 100)}%`;
}
