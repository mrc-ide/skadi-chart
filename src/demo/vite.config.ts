import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  publicDir: resolve(__dirname, "..", "..", "public"),
  resolve: {
    alias: {
      "@": resolve(__dirname, "..")
    }
  },
});
