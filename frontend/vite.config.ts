import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['serv19.octro.net'],
    proxy: {
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        xfwd: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/'
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        xfwd: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/'
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react']
        }
      }
    }
  }
})
