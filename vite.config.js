import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // One origin in development: the app calls /api and Vite forwards it to the
  // Express service, so there is no CORS dance and no hard-coded port in the
  // client.
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  plugins: [react(), tailwindcss()],
})
