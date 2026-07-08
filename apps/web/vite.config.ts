/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
  preview: {
    host: true,
    allowedHosts: ['.up.railway.app'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/main.tsx', 'src/**/*.test.*', 'src/__tests__/**'],
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
})
