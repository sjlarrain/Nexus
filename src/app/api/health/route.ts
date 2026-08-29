import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Liveness probe. Deliberately reports nothing about configuration. */
export function GET() {
  return NextResponse.json({ ok: true, service: 'warm-intro' });
}
