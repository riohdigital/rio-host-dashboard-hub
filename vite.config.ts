import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    // App instalável. O service worker guarda só os arquivos do próprio app;
    // dados (Supabase) e automações (n8n) vão sempre direto à rede.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Rioh Host',
        short_name: 'Rioh Host',
        description: 'Gestão de hospedagens por temporada: reservas, faxinas, despesas e repasses.',
        lang: 'pt-BR',
        // Mesmas cores de src/styles/tokens.css (--brand e --surface)
        theme_color: '#6A6DDF',
        background_color: '#F8F9FA',
        display: 'standalone',
        start_url: '/dashboard',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // O pacote principal passa de 2 MB
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /supabase\.co/, /n8n/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') ||
              url.hostname.endsWith('.supabase.in') ||
              url.hostname.includes('n8n') ||
              url.hostname.includes('easypanel'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
