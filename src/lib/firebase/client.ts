import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { publicEnv } from '@/lib/env';
import { EMULATOR_PORTS } from '@/lib/firebase/emulators';

/**
 * Singleton-safe under HMR: `getApps()` survives a fast refresh, so re-initialising
 * would throw. The emulator connections are guarded by the same check.
 */
let connected = false;

function app(): FirebaseApp {
  const env = publicEnv();
  const instance = getApps().length ? getApp() : initializeApp(env);

  if (env.useEmulators && !connected) {
    connected = true;
    connectAuthEmulator(getAuth(instance), `http://127.0.0.1:${EMULATOR_PORTS.auth}`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(getFirestore(instance), '127.0.0.1', EMULATOR_PORTS.firestore);
    connectStorageEmulator(getStorage(instance), '127.0.0.1', EMULATOR_PORTS.storage);
  }

  return instance;
}

export const firebaseAuth = (): Auth => getAuth(app());
export const firebaseDb = (): Firestore => getFirestore(app());
export const firebaseStorage = (): FirebaseStorage => getStorage(app());
