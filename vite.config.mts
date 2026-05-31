import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue(),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: 'client/index.ts',
      formats: [
        'es',
      ],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'vue',
        '@koishijs/client',
      ],
      output: {
        assetFileNames: 'style.css',
      },
    },
  },
})
