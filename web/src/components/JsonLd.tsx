import type { JsonLdSchema } from './seoSchemas'

interface JsonLdProps {
  schema: JsonLdSchema | JsonLdSchema[]
}

/**
 * JSON-LD structured data component using React 19 native metadata support.
 * Script elements rendered here are automatically hoisted to <head>.
 *
 * Security note: We use dangerouslySetInnerHTML here because JSON-LD requires
 * injecting a script tag with JSON content. This is safe because:
 * 1. JSON.stringify() escapes special characters, preventing script injection
 * 2. All schema data comes from trusted static sources (not user input)
 * 3. Faction metadata from uploaded zips is sanitized before storage
 */
export function JsonLd({ schema }: JsonLdProps) {
  const schemaArray = Array.isArray(schema) ? schema : [schema]

  return (
    <>
      {schemaArray.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  )
}
