interface SEOProps {
  title?: string
  description?: string
  canonicalPath?: string
  type?: 'website' | 'article'
}

const SITE_URL = 'https://pa-pedia.com'
const DEFAULT_TITLE = 'PA-Pedia - Planetary Annihilation Titans Database'
const DEFAULT_DESCRIPTION =
  'Browse comprehensive unit statistics, weapons, and build data for Planetary Annihilation: Titans factions including MLA, Legion, Bugs, and community mods.'
const OG_IMAGE = `${SITE_URL}/favicon.png`

/**
 * SEO component using React 19 native metadata support.
 * Elements rendered here are automatically hoisted to <head>.
 */
export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath = '',
  type = 'website',
}: SEOProps) {
  const fullTitle = title ? `${title} | PA-Pedia` : DEFAULT_TITLE
  const canonicalUrl = `${SITE_URL}${canonicalPath}`

  return (
    <>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:site_name" content="PA-Pedia" />
    </>
  )
}
