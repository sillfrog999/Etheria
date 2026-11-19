import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@etheria/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@etheria/protocol': path.resolve(__dirname, '../../packages/protocol/src/index.ts'),
      '@etheria/game-data': path.resolve(__dirname, '../../packages/game-data/src/index.ts'),
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
