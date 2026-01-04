import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SITE_URL = 'https://pa-pedia.com'

// Faction data is now at repo root /factions/ folder
const FACTIONS_DIR = path.join(__dirname, '..', '..', 'factions')

// Discover factions by reading the factions directory
function discoverFactions(): string[] {
  if (!fs.existsSync(FACTIONS_DIR)) {
    console.warn('Factions directory not found:', FACTIONS_DIR)
    return []
  }

  return fs.readdirSync(FACTIONS_DIR, { withFileTypes: true })
    .filter(entry => {
      if (!entry.isDirectory()) return false
      if (entry.name === 'dist') return false
      // Must have metadata.json to be a valid faction
      const metadataPath = path.join(FACTIONS_DIR, entry.name, 'metadata.json')
      return fs.existsSync(metadataPath)
    })
    .map(entry => entry.name)
}

const STATIC_FACTIONS = discoverFactions()

interface UnitIndexEntry {
  identifier: string
  displayName: string
  unitTypes: string[]
  source: string
  unit?: {
    accessible?: boolean
  }
}

interface FactionIndex {
  units: UnitIndexEntry[]
}

function generateSitemap(): void {
  const buildDate = new Date().toISOString().split('T')[0]
  const urls: { loc: string; priority: string; changefreq: string; lastmod: string }[] = []

  // Add homepage
  urls.push({ loc: '/', priority: '1.0', changefreq: 'weekly', lastmod: buildDate })

  // Add "All Factions" page (route exists at /faction without ID)
  urls.push({ loc: '/faction', priority: '0.9', changefreq: 'weekly', lastmod: buildDate })

  // Add each faction and its units
  for (const factionId of STATIC_FACTIONS) {
    // Faction page
    urls.push({
      loc: `/faction/${factionId}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: buildDate,
    })

    // Load units.json for this faction from repo root factions folder
    const unitsPath = path.join(FACTIONS_DIR, factionId, 'units.json')

    if (fs.existsSync(unitsPath)) {
      try {
        const index: FactionIndex = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'))

        for (const entry of index.units) {
          // Only include accessible units (check both that unit exists and is accessible)
          if (entry.unit && entry.unit.accessible !== false) {
            urls.push({
              loc: `/faction/${factionId}/unit/${entry.identifier}`,
              priority: '0.6',
              changefreq: 'monthly',
              lastmod: buildDate,
            })
          }
        }
      } catch (err) {
        console.error(`Failed to read units.json for faction ${factionId}:`, err)
      }
    } else {
      console.warn(`Warning: units.json not found for faction ${factionId}`)
    }
  }

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .map(
      (url) => `  <url>
    <loc>${SITE_URL}${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
    )
    .join('\n')}
</urlset>`

  // Write to public directory
  const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml')
  fs.writeFileSync(outputPath, xml)

  console.log(`Generated sitemap with ${urls.length} URLs at ${outputPath}`)
}

generateSitemap()
