import { defineConfig } from 'vite';

export default defineConfig({
  // `ENVIRONMENT` joins the exposed env vars so the developer gate
  // (`src/dev/env.ts`) can read it as `import.meta.env.ENVIRONMENT`.
  envPrefix: ['VITE_', 'ENVIRONMENT'],
  server: {
    port: 5175,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
