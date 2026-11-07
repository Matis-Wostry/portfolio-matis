import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    // En développement, l'interface et l'API partagent l'origine de Vite : le cookie de session y fonctionne sans HTTPS.
    proxy: { '/auth': API, '/admin': API, '/public': API },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
