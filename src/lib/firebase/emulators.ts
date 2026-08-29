/** Single source of truth for emulator ports. Must match firebase.json. */
export const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  storage: 9199,
  ui: 4000,
} as const;
