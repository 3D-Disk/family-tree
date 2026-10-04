import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the built site works both on GitHub Pages
// (https://<owner>.github.io/family-tree/) and when served locally.
export default defineConfig({
  base: './',
  plugins: [react()],
  // The tree-drawing library makes the bundle ~650 kB (≈200 kB compressed), which is fine here.
  build: { chunkSizeWarningLimit: 900 },
})
