import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: 'development-csp',
      transformIndexHtml: {
        order: 'post',
        // React Refresh injects a local inline preamble during development only.
        handler: (html) =>
          command === 'serve'
            ? html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
            : html,
      },
    },
  ],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/.test-data/**',
        '**/.local-data/**',
        '**/.pnpm-store/**',
        '**/.packaging/**',
        '**/release/**',
        '**/test-results/**',
      ],
    },
  },
}))
