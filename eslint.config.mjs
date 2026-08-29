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
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
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
