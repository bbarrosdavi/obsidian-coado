import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Em desenvolvimento a api roda em :3000; o proxy mantém tudo na mesma origem (cookies + CSRF)
const API_URL = process.env.API_URL ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: API_URL, changeOrigin: false, xfwd: true },
    },
  },
})
