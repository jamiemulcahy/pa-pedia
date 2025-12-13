import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SITE_URL = 'https://pa-pedia.com'
const STATIC_FACTIONS = ['MLA', 'Legion', 'Bugs', 'Exiles']

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
  const urls: { loc: string; priority: string; changefreq: string }[] = []

  // Add homepage
  urls.push({ loc: '/', priority: '1.0', changefreq: 'weekly' })

  // Add "All Factions" page
  urls.push({ loc: '/faction', priority: '0.9', changefreq: 'weekly' })

  // Add each faction and its units
  for (const factionId of STATIC_FACTIONS) {
    // Faction page
    urls.push({
      loc: `/faction/${factionId}`,
      priority: '0.8',
      changefreq: 'weekly',
    })

    // Load units.json for this faction
    const unitsPath = path.join(
      __dirname,
      '..',
      'public',
      'factions',
      factionId,
      'units.json'
    )

    if (fs.existsSync(unitsPath)) {
      const index: FactionIndex = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'))

      for (const entry of index.units) {
        // Only include accessible units (default to true if not specified)
        if (entry.unit?.accessible !== false) {
          urls.push({
            loc: `/faction/${factionId}/unit/${entry.identifier}`,
            priority: '0.6',
            changefreq: 'monthly',
          })
        }
      }
    }
  }

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .map(
      (url) => `  <url>
    <loc>${SITE_URL}${url.loc}</loc>
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
