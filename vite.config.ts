import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { publicAppPwaPlugin } from './scripts/pwaBuildPlugin';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Q-pro/',
  plugins: [react(), publicAppPwaPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
