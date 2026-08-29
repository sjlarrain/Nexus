import { describe, expect, it } from 'vitest';
import { EMULATOR_PORTS } from '@/lib/firebase/emulators';

describe('emulator ports', () => {
  it('match the ports declared in firebase.json', async () => {
    const { readFile } = await import('node:fs/promises');
    const config = JSON.parse(await readFile('firebase.json', 'utf8')) as {
      emulators: Record<string, { port: number }>;
    };

    expect(config.emulators.auth?.port).toBe(EMULATOR_PORTS.auth);
    expect(config.emulators.firestore?.port).toBe(EMULATOR_PORTS.firestore);
    expect(config.emulators.storage?.port).toBe(EMULATOR_PORTS.storage);
    expect(config.emulators.ui?.port).toBe(EMULATOR_PORTS.ui);
  });
});
