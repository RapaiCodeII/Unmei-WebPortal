import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vitejs.dev/config/
// NOTE: viteSingleFile()'s recommended config sets assetsInlineLimit to a
// FUNCTION (a Vite 5+ feature). This project runs Vite 4.5, which coerces it
// to NaN and silently inlines nothing — the header banner stayed an external
// hashed .jpg next to index.html. We disable the recommended config and
// replicate it with a NUMERIC limit so Vite 4 truly inlines assets.
export default defineConfig({
  plugins: [react(), viteSingleFile({ useRecommendedBuildConfig: false })],
  base: './',
  build: {
    assetsInlineLimit: 1048576,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    assetsDir: '',
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
