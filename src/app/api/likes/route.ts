import { adminDb } from '@/server/firebase/admin';
import { requireUser } from '@/server/auth/session';
import { route } from '@/server/http/respond';
import { toCard } from '@/lib/cards/card';
import { profileSchema } from '@/lib/schemas/profile';
import type { InboundLike } from '@/lib/schemas/entities';

export const runtime = 'nodejs';

/**
 * Inbound likes, priority first then recency (BACKLOG E8.1).
 * The ordering comes from the composite index on (priority, createdAt).
 */
export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const db = adminDb();

    const likes = await db
      .collection('inbox')
      .doc(user.uid)
      .collection('likes')
      .orderBy('priority', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const cards = await Promise.all(
      likes.docs.map(async (doc) => {
        const like = doc.data() as InboundLike;
        const person = await db.collection('users').doc(like.fromUid).get();
        const data = person.data();
        if (!data) return null;

        const parsed = profileSchema.safeParse(data);
        if (!parsed.success) return null;

        return {
          ...toCard(like.fromUid, parsed.data),
          priority: like.priority,
          likedAt: like.createdAt,
        };
      }),
    );

    return { likes: cards.filter((card) => card !== null) };
  });
}
