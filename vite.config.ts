import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const CODEX_WS_TARGET = process.env.CODEX_WS_URL || 'ws://127.0.0.1:8080';
const CODEX_HTTP_TARGET = process.env.CODEX_HTTP_URL || 'http://127.0.0.1:8080';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        '/ws': {
          target: CODEX_WS_TARGET,
          ws: true,
          changeOrigin: true,
          rewrite: (p) => {
            const rewritten = p.replace(/^\/ws/, '');
            if (!rewritten || rewritten === '') return '/';
            if (rewritten.startsWith('?')) return '/' + rewritten;
            return rewritten.startsWith('/') ? rewritten : '/' + rewritten;
          },
          configure: (proxy) => {
            // Remove Origin header from WebSocket upgrade request.
            // Codex app-server strictly rejects any Origin header with 403 Forbidden.
            proxy.on('proxyReqWs', (proxyReq) => {
              proxyReq.removeHeader('origin');
            });
          },
        },
        '/readyz': {
          target: CODEX_HTTP_TARGET,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin');
            });
          },
        },
        '/healthz': {
          target: CODEX_HTTP_TARGET,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin');
            });
          },
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
