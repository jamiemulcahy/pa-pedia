import path from 'path'
import fs from 'fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Custom plugin to serve /factions from the repo root factions folder
 * This allows the dev server to serve faction data from ../factions/
 */
function serveFactions(): Plugin {
  const factionsDir = path.resolve(__dirname, '../factions')

  return {
    name: 'serve-factions',
    configureServer(server) {
      server.middlewares.use('/factions', (req, res, next) => {
        // Strip /factions prefix and get the file path
        const filePath = path.join(factionsDir, req.url || '')

        // Check if file exists
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          // Determine content type
          const ext = path.extname(filePath).toLowerCase()
          const contentTypes: Record<string, string> = {
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
          }

          res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream')
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveFactions()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // Allow serving files from the factions folder at repo root
      allow: ['..'],
    },
  },
})
