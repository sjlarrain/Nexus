import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { readJson, route } from '@/server/http/respond';
import { sendMessage } from '@/server/chat/messages';
import { LIMITS } from '@/lib/refdata/constants';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ text: z.string().min(1).max(LIMITS.messageChars) });

export async function POST(request: Request, { params }: Params) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { text } = await readJson(request, bodySchema);
    return sendMessage(user.uid, id, text);
  });
}
