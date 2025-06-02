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
  },
  build: {
    // Ensure proper MIME types for JavaScript modules
    rollupOptions: {
      output: {
        // Ensure chunks have proper format
        format: 'es',
        // Use standard extension for better MIME type detection
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Ensure source maps are properly generated
    sourcemap: true
  },
  server: {
    // Ensure proper headers during development
    headers: {
      'Content-Type': 'application/javascript'
    }
  }
});