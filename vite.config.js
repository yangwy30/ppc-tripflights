import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'public',
            filename: 'sw.js',
            registerType: 'autoUpdate',
            injectManifest: {
                injectionPoint: undefined
            },
            includeAssets: ['favicon.svg', 'icons/*.png'],
            manifest: {
                name: 'PPC: Delay No More — Group Flight Tracker',
                short_name: 'PPC: Delay No More',
                description: 'Track group flights together',
                theme_color: '#0A84FF',
                background_color: '#F2F2F7',
                display: 'standalone',
                start_url: '/',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
                    }
                ]
            }
        })
    ],
    server: { port: 5173, open: true }
});
