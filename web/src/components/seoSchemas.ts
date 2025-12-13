const SITE_URL = 'https://pa-pedia.com'

export interface WebSiteSchema {
  '@context': 'https://schema.org'
  '@type': 'WebSite'
  name: string
  url: string
  description: string
}

export interface WebPageSchema {
  '@context': 'https://schema.org'
  '@type': 'WebPage'
  name: string
  url: string
  description: string
  isPartOf: { '@id': string }
  about?: VideoGameSchema
}

export interface VideoGameSchema {
  '@context': 'https://schema.org'
  '@type': 'VideoGame'
  name: string
  description: string
  genre: string[]
  gamePlatform: string[]
  publisher: {
    '@type': 'Organization'
    name: string
  }
}

export type JsonLdSchema = WebSiteSchema | WebPageSchema | VideoGameSchema

// Pre-built schemas
export const PA_TITANS_GAME: VideoGameSchema = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Planetary Annihilation: Titans',
  description:
    'A real-time strategy game featuring massive-scale planetary warfare with thousands of units.',
  genre: ['Real-time strategy', 'RTS'],
  gamePlatform: ['PC', 'Mac', 'Linux'],
  publisher: {
    '@type': 'Organization',
    name: 'Planetary Annihilation Inc',
  },
}

export const WEBSITE_SCHEMA: WebSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'PA-Pedia',
  url: SITE_URL,
  description:
    'Comprehensive database for Planetary Annihilation: Titans units, weapons, and faction data.',
}

export function createWebPageSchema(
  name: string,
  path: string,
  description: string,
  includeGameRef = false
): WebPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    url: `${SITE_URL}${path}`,
    description,
    isPartOf: { '@id': SITE_URL },
    ...(includeGameRef && { about: PA_TITANS_GAME }),
  }
}
