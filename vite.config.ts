import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    // 1. PROJECT SUBFOLDER BASE PATH
    // Ensures compiled chunks are fetched relatively from /NoteOli/ instead of the root domain.
    base: '/NoteOli/',

    // 2. REQUIRED COMPILER & CSS PLUGINS
    plugins: [react(), tailwindcss()],

    // 3. CODE INTEGRITY & RESOLUTION ROUTING
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    // 4. CLIENT-SIDE INFERENCE ASSET OPTIMIZATION
    // Explicitly instructs Vite's internal asset pipeline how to treat machine-learning weights.
    assetsInclude: ['**/*.wasm', '**/*.onnx', '**/*.bin'],

    // 5. STATIC COMPILATION PIPELINE CONFIGURATION
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Prevents large WebAssembly glue scripts or bundled worker code from throwing build warnings.
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          // Separates heavy runtime modules into isolated browser-cached files
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'vendor-core';
              if (id.includes('@xenova') || id.includes('transformers')) return 'vendor-ai';
              return 'vendor-libs';
            }
          },
        },
      },
    },

    // 6. DEVELOPMENT SERVER CONFIGURATION
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var to prevent UI flickering.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Cross-Origin Isolation headers for LOCAL development testing (matches your live coi-serviceworker behavior)
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  };
});
