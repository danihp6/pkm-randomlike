// Dormant ESLint 9 flat config: the half of `npm run lint` that switches on the
// day a `typescript-eslint` release supports this repo's compiler.
//
// No ESLint is installed today (`lint` is `prettier --check .` only), because
// `typescript-eslint` cannot load in this tree: the repo's `typescript@7.0.2` is
// the native compiler and exposes no JS API, and every release up to 8.71.2
// declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"`, which excludes
// TypeScript 7. The config below needs no edit when such a release lands: the
// task that activates it adds `eslint`, `@eslint/js`, `typescript-eslint` and
// `eslint-config-prettier` back and restores the `eslint .` half of the script.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'infra/**',
      'public/**',
      'sprite-sources/**',
      'coverage/**',
      '.agent_specs/**',
      // `scripts/**/*.mjs` are plain Node ESM build tools, not the application
      // bundle: they are outside this config on purpose (linting them is its own
      // task), so `eslint .` never reports one of them.
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'vite.config.ts'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
  prettier,
);
