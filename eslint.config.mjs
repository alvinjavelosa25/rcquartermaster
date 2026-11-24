import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/payload-types.ts',
      'src/app/(payload)/**/importMap.js',
      'src/migrations/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Playwright fixtures call `use(...)`, which is not a React hook.
    files: ['tests/e2e/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
]

export default config
