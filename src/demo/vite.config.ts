import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  publicDir: resolve(__dirname, "..", "..", "public"),
  resolve: {
    alias: {
      "@": resolve(__dirname, "..")
    }
  },
});
