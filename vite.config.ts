import path from 'node:path'
import url from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import type { BuildEnvironmentOptions } from 'vite'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// SSR configuration
const ssrBuildConfig: BuildEnvironmentOptions = {
  ssr: true,
  outDir: 'dist/server',
  ssrEmitAssets: true,
  copyPublicDir: false,
  emptyOutDir: true,
  rollupOptions: {
    input: path.resolve(__dirname, 'src/entry-server.tsx'),
    output: {
      entryFileNames: '[name].js',
      chunkFileNames: 'assets/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash][extname]',
    },
  },
}

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [tanstackRouter(), react()],
    build: ssrBuildConfig,
    server: {
      allowedHosts: ['.ngrok-free.app'],
    },
  }
})
