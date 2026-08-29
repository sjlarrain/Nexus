import next from 'eslint-config-next';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'emulator-data/**', 'next-env.d.ts'] },
  ...next,
  ...nextTypescript,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // CLAUDE.md section 4: no `any`, no unexplained non-null assertions.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // CLAUDE.md section 4: privileged server code must never reach the client bundle.
    //
    // The rule cannot see whether a .tsx is a client or a server component, so it
    // treats every one as a client. `src/app/page.tsx` is the one genuine server
    // component in the app — it reads the session cookie and redirects, and renders
    // no markup at all — so it is excluded here rather than by an inline disable,
    // which would be invisible to anyone auditing the boundary. Any new exclusion
    // needs the same justification: no 'use client', no rendered output.
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    ignores: ['src/app/page.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/*', '@/server'],
              message: 'src/server is admin-only; call a route handler instead.',
            },
            {
              group: ['firebase-admin', 'firebase-admin/*'],
              message: 'firebase-admin must never be imported from a component.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
