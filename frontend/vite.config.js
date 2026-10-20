import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    host: true,
    proxy: { '/api': { target: process.env.DEV_API_URL || 'http://127.0.0.1:5000', changeOrigin: true } },
  },
});
