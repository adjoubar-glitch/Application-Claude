import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const server = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@tamalou/shared': path.resolve(__dirname, '../shared/src/index.ts') } },
  server: {
    host: true,
    proxy: {
      '/socket.io': { target: server, ws: true },
      '/api': server,
      '/assets': server,
    },
  },
  build: { outDir: 'dist', sourcemap: false, assetsDir: 'static' },
});
