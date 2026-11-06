import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { precacheAssets } from './scripts/precache-assets.js'

export default defineConfig({
  plugins: [react(), precacheAssets()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
