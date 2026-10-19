import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In sviluppo il frontend inoltra API, upload e Socket.IO al backend (nessun problema di CORS).
const backend = process.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/uploads': backend,
      '/socket.io': { target: backend, ws: true },
    },
  },
});
