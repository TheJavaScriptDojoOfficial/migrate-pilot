import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Tauri uses a fixed port and expects strictPort. See https://tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri-managed code lives in src-tauri; ignore to avoid double-builds.
      ignored: ['**/src-tauri/**'],
    },
  },

  envPrefix: ['VITE_', 'TAURI_'],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@components': path.resolve(__dirname, './src/components'),
    },
  },

  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1024,
  },
}));
