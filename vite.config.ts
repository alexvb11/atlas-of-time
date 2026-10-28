import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.glsl'],
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: 'three', test: /node_modules[\\/](three|@react-three|postprocessing)/ }],
        },
      },
    },
  },
})
