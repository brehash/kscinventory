import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  resolve: {
    alias: {
      // Provide browser-compatible versions or empty shims for Node.js built-in modules
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      buffer: 'buffer'
    }
  },
  define: {
    // Define global variables that might be used by the WooCommerce package
    global: 'globalThis',
    'process.env': {},
  }
});