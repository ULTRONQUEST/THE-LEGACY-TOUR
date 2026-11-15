
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/THE-LEGACY-TOUR/',
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});


