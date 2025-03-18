import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Finance System',
        short_name: 'Finance',
        description: 'Comprehensive financial management system',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  base: './',
  server: {
    port: 3001,
    host: true,
    strictPort: false,
    watch: {
      usePolling: true,
      interval: 100
    },
    open: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: '',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: './index.html',
        'sql-wasm': './public/sql.js/sql-wasm.wasm'
      },
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'sql-wasm.wasm') {
            return 'sql.js/[name]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts'],
          'utils-vendor': ['date-fns', 'jspdf', 'sql.js']
        }
      }
    },
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000
  },
  esbuild: {
    legalComments: 'none',
    target: 'esnext'
  }
});
