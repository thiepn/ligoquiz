import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Relative assets + hash navigation work at a separate future preview origin.
// No production deployment or service worker registration at G1.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { target: 'es2022', sourcemap: true },
  server: { host: '127.0.0.1', port: 5173 },
});
