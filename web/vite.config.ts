import path from 'path'
import fs from 'fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Check if a directory name looks like a semver version (e.g. "1.0.0", "2.1.3").
 */
function isVersionDir(name: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(name)
}

/**
 * Scan a factions directory and build a manifest describing all factions
 * and their available versions.
 *
 * Supports two layouts:
 * - Versioned:   {factionId}/{version}/metadata.json  (multiple versions)
 * - Unversioned: {factionId}/metadata.json            (single version, backwards compat)
 */
function buildDevManifest(factionsDir: string): object {
  const factions: object[] = []

  if (!fs.existsSync(factionsDir)) return { generated: new Date().toISOString(), releaseTag: 'dev', factions }

  for (const entry of fs.readdirSync(factionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const factionDir = path.join(factionsDir, entry.name)

    // Check for versioned layout: subdirs that look like version numbers
    const subdirs = fs.readdirSync(factionDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && isVersionDir(d.name))
      .map(d => d.name)
      .sort((a, b) => {
        // Sort descending so latest is first
        const pa = a.split('.').map(Number)
        const pb = b.split('.').map(Number)
        for (let i = 0; i < 3; i++) {
          if (pa[i] !== pb[i]) return pb[i] - pa[i]
        }
        return 0
      })

    if (subdirs.length > 0) {
      // Versioned faction
      const versions = []
      let displayName: string | undefined
      let isAddon: boolean | undefined
      let baseFactions: string[] | undefined

      for (const ver of subdirs) {
        const metaPath = path.join(factionDir, ver, 'metadata.json')
        if (!fs.existsSync(metaPath)) continue

        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
        if (!displayName) {
          displayName = meta.displayName
          isAddon = meta.isAddon
          baseFactions = meta.baseFactions
        }

        versions.push({
          version: ver,
          filename: `${entry.name}-${ver}.zip`,
          downloadUrl: `/factions/${entry.name}/${ver}/`,
          size: 0,
          timestamp: parseInt(ver.replace(/\./g, '')) * 100000,
          build: meta.build || 'dev',
        })
      }

      if (versions.length > 0) {
        const faction: Record<string, unknown> = {
          id: entry.name,
          displayName,
          latest: versions[0],
          versions,
        }
        if (isAddon) faction.isAddon = isAddon
        if (baseFactions) faction.baseFactions = baseFactions
        factions.push(faction)
      }
    } else {
      // Unversioned (flat) faction — check for metadata.json directly
      const metaPath = path.join(factionDir, 'metadata.json')
      if (!fs.existsSync(metaPath)) continue

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      const version = meta.version || '1.0.0'
      const versionEntry = {
        version,
        filename: `${entry.name}-${version}.zip`,
        downloadUrl: `/factions/${entry.name}/`,
        size: 0,
        timestamp: 0,
        build: meta.build || 'dev',
      }

      const faction: Record<string, unknown> = {
        id: entry.name,
        displayName: meta.displayName,
        latest: versionEntry,
        versions: [versionEntry],
      }
      if (meta.isAddon) faction.isAddon = meta.isAddon
      if (meta.baseFactions) faction.baseFactions = meta.baseFactions
      factions.push(faction)
    }
  }

  return { generated: new Date().toISOString(), releaseTag: 'dev', factions }
}

/**
 * Custom plugin to serve /factions from the configured factions folder.
 * Defaults to ../factions (repo root) but can be overridden via the
 * VITE_FACTIONS_DIR env var (e.g. for E2E tests that use fixture data).
 *
 * When the factions directory uses versioned subdirectories, the plugin
 * auto-generates a manifest.json and serves version-aware paths.
 */
function serveFactions(): Plugin {
  const factionsDir = path.resolve(__dirname, process.env.VITE_FACTIONS_DIR || '../factions')

  return {
    name: 'serve-factions',
    configureServer(server) {
      server.middlewares.use('/factions', (req, res, next) => {
        const reqUrl = req.url || ''

        // Auto-generate manifest.json from the directory structure
        if (reqUrl === '/manifest.json' || reqUrl.startsWith('/manifest.json?')) {
          const manifest = buildDevManifest(factionsDir)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(manifest))
          return
        }

        // Strip /factions prefix and get the file path
        const filePath = path.join(factionsDir, reqUrl.split('?')[0])

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
    // Bind to all addresses (required for Docker container access)
    host: true,
    fs: {
      // Allow serving files from the factions folder at repo root
      allow: ['..'],
    },
  },
})
