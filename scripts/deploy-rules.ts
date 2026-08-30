/**
 * Deploys firestore.rules (and storage.rules, when the bucket exists) using the
 * service account, via the Firebase Rules REST API.
 *
 * Why not `firebase deploy`: the CLI wants an interactive `firebase login`, which
 * does not work in a scripted or CI context. This does the same three steps the CLI
 * does — create a ruleset, then point the release at it — with credentials we
 * already have (BACKLOG E14.2).
 *
 *   npm run deploy:rules
 */
import { readFile } from 'node:fs/promises';
import { GoogleAuth } from 'google-auth-library';

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
if (!encoded) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not set.');

const credentials = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as ServiceAccount;

const auth = new GoogleAuth({
  credentials,
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase',
  ],
});

const API = 'https://firebaserules.googleapis.com/v1';
const project = `projects/${credentials.project_id}`;

async function call(path: string, init: RequestInit): Promise<unknown> {
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  const response = await fetch(`${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : {};
}

/** A ruleset is immutable; a release is the moving pointer at one. */
async function deploy(releaseId: string, file: string, name: string): Promise<void> {
  const content = await readFile(file, 'utf8');

  const ruleset = (await call(`${project}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({ source: { files: [{ name, content }] } }),
  })) as { name: string };

  const release = `${project}/releases/${releaseId}`;
  const payload = JSON.stringify({ name: release, rulesetName: ruleset.name });

  try {
    await call(`${project}/releases`, { method: 'POST', body: payload });
    process.stdout.write(`  ${releaseId}: created -> ${ruleset.name.split('/').pop()}\n`);
  } catch (error) {
    // Already exists on every deploy after the first.
    if (!(error as Error).message.includes('409')) throw error;
    await call(`${release}`, {
      method: 'PATCH',
      body: JSON.stringify({ release: { name: release, rulesetName: ruleset.name } }),
    });
    process.stdout.write(`  ${releaseId}: updated -> ${ruleset.name.split('/').pop()}\n`);
  }
}

async function main(): Promise<void> {
  process.stdout.write(`deploying rules to ${credentials.project_id}\n`);

  await deploy('cloud.firestore', 'firestore.rules', 'firestore.rules');

  // Storage needs a bucket, which needs the Blaze plan. Skip rather than fail.
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (bucket) {
    try {
      await deploy(`firebase.storage/${bucket}`, 'storage.rules', 'storage.rules');
    } catch (error) {
      process.stdout.write(`  storage: skipped (${(error as Error).message.slice(0, 120)})\n`);
    }
  }

  process.stdout.write('done\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
});
