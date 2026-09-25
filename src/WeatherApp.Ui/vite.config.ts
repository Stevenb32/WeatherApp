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
    retry: 0,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './reports/junit/results.xml',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**', '**/*.d.ts'],
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'html', 'lcovonly', 'json-summary'],
      reportOnFailure: true,
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
        perFile: false,
        autoUpdate: false,
      },
    },
  },
})
