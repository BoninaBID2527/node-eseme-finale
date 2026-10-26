import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// In sviluppo il frontend inoltra API, upload e Socket.IO al backend (nessun problema di CORS).
const backend = process.env.VITE_BACKEND_URL || 'http://localhost:4000';

// I contenuti dimostrativi del backend (CommonJS) diventano un modulo ES per la demo statica.
const demoDataAsModule = {
  name: 'demo-data-as-module',
  transform(code, id) {
    if (!id.replace(/\\/g, '/').endsWith('backend/scripts/demoData.js')) return null;
    return { code: code.replace(/module\.exports\s*=/, 'export default'), map: null };
  },
};

export default defineConfig(({ mode }) => {
  // npm run build:demo → demo/index.html: un solo file HTML con l'app e un backend simulato, per GitHub Pages.
  if (mode === 'demo') {
    return {
      base: './',
      plugins: [react(), demoDataAsModule, viteSingleFile()],
      build: { outDir: 'dist-demo', emptyOutDir: true },
      server: { fs: { allow: ['..'] } },
    };
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': backend,
        '/uploads': backend,
        '/socket.io': { target: backend, ws: true },
      },
    },
  };
});
