import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'buffer'],
    exclude: ['osrs_markov_wasm']
  },
  server: {
    fs: {
      allow: ['..']
    }
  },
  build: {
    sourcemap: true,
    // ...other options
  },
})
