/// <reference types="vitest/config" />

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://localhost:7001',
        secure: false,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5100',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: './src/test/setup.ts',
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
    },
  },
})
