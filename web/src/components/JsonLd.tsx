import type { JsonLdSchema } from './seoSchemas'

interface JsonLdProps {
  schema: JsonLdSchema | JsonLdSchema[]
}

/**
 * JSON-LD structured data component using React 19 native metadata support.
 * Script elements rendered here are automatically hoisted to <head>.
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
