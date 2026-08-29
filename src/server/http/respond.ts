import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { UnauthorizedError } from '@/server/auth/session';

/**
 * Shared route-handler plumbing, so every endpoint fails the same way and no handler
 * has to remember to catch its own auth error.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);
export const tooManyRequests = (message: string) => new HttpError(429, message);

type Handler<T> = () => Promise<T>;

/**
 * Runs a handler and maps thrown errors onto status codes. Unknown errors become a
 * 500 with a generic message — the detail goes to the server log, never to the
 * client, so an internal failure cannot leak schema or infrastructure details.
 */
/**
 * Every endpoint here answers for one signed-in user, so none of it may be cached —
 * not by the browser, and above all not by a shared proxy that could hand one user's
 * deck or chat to another. Without this the responses carry no `Cache-Control` at
 * all, which leaves caching to heuristics: a refetch after a write was served a
 * stale body, and the booking screen kept showing "proposed" after it was confirmed.
 */
const NO_STORE = { 'Cache-Control': 'no-store, must-revalidate' } as const;

export async function route<T>(handler: Handler<T>): Promise<NextResponse> {
  try {
    return NextResponse.json((await handler()) ?? { ok: true }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401, headers: NO_STORE });
    }
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: NO_STORE },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request.',
          issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        { status: 400, headers: NO_STORE },
      );
    }
    console.error('[route]', error);
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500, headers: NO_STORE },
    );
  }
}

/** Parses and validates a JSON body in one step; a bad body is a 400, not a crash. */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest('Expected a JSON body.');
  }
  return schema.parse(raw);
}
