import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = env.VITE_NODE_ENV === 'production'

  console.log('isProduction', isProduction)

  return {
    plugins: [react()],
    server: {
      port: 5173,
      allowedHosts: ['serv19.octro.net'],
      proxy: {
        '/auth': {
          target: env.VITE_API_URL,
          
          changeOrigin: true,
          secure: false,
          xfwd: true,
          cookieDomainRewrite: isProduction ? 'serv19.octro.net' : 'localhost',
          cookiePathRewrite: '/'
        },
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          secure: false,
          xfwd: true,
          cookieDomainRewrite: isProduction ? 'serv19.octro.net' : 'localhost',
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
  }
})
