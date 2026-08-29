import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { readJson, route } from '@/server/http/respond';
import { patchProfile } from '@/server/users/update-profile';
import { profilePatchSchema } from '@/lib/schemas/profile';

export const runtime = 'nodejs';

const bodySchema = z.object({
  patch: profilePatchSchema,
  /** The step the user is on, persisted so "Save & exit" can resume (spec §2). */
  step: z.number().int().min(1).max(5).optional(),
});

export async function PATCH(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const { patch, step } = await readJson(request, bodySchema);
    return patchProfile(user.uid, patch, step);
  });
}
