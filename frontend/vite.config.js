import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const isProduction = env.MYSQL_HOST === '192.168.111.19';
    console.log('isProduction', isProduction);
    return {
        plugins: [react()],
        server: {
            port: 5173,
            allowedHosts: ['serv19.octro.net'],
            proxy: {
                '/api': {
                    target: env.VITE_API_URL || 'http://localhost:8000',
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                },
                '/auth': {
                    target: env.VITE_API_URL || 'http://localhost:8000',
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                },
            },
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
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
    };
});
