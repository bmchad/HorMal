import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// @ts-ignore
import { devApiPlugin } from './vite-dev-api.mjs';

export default defineConfig({
  envDir: '..',
  plugins: [react(), tailwindcss(), devApiPlugin()],
  server: { port: 5173, host: true },
  build: { target: 'es2022', sourcemap: false },
});
