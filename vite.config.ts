import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  ...(process.env.CHECK_OUTPUT_DIR ? { cacheDir: `${process.env.CHECK_OUTPUT_DIR}/vite-cache` } : {}),
  plugins: [vue()],
  server: { port: 5190, host: true },
})
