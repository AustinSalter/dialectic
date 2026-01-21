import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Handle symlinked src directory
  resolve: {
    preserveSymlinks: true,
  },
  // Tauri expects a fixed port for development
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Watch the actual source directory through symlink
      followSymlinks: true,
    },
  },
  // Prevent vite from obscuring rust errors
  clearScreen: false,
  // Env variables to expose to the client
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
