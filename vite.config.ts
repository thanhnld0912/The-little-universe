import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      /**
       * In production the site and the API are one Vercel project, so `/api/...`
       * is same-origin and needs nothing. The dev server is a separate origin
       * from `npm --prefix server run dev`, so it forwards instead.
       *
       * `changeOrigin` is off deliberately: the visitor cookie is issued for
       * this host, and rewriting the Host header would scope it to the wrong one.
       */
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${process.env.SERVER_PORT ?? 4000}`,
          changeOrigin: false,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
