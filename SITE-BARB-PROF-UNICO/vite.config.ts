import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: [
      "noncognizant-milania-untamely.ngrok-free.dev"
    ],
    proxy: {
      '/profissionais': { target: 'http://localhost:3333', changeOrigin: true },
      '/agendamentos':  { target: 'http://localhost:3333', changeOrigin: true },
      '/configuracao':  { target: 'http://localhost:3333', changeOrigin: true },
      '/servicos': { target: 'http://localhost:3333', changeOrigin: true },
      '/categorias-servicos': { target: 'http://localhost:3333', changeOrigin: true },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
