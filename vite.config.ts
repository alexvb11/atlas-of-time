import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves a project site under /<repo>/: the deploy workflow sets BASE_PATH
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.glsl'],
  build: {
    chunkSizeWarningLimit: 1500,
    // no manual chunk groups: splitting three.js out by hand left the bundler's shared helpers in
    // an app chunk that the three chunk imported, a cycle that broke the production build at start-up
  },
})
