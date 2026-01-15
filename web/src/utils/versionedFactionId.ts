/**
 * Utilities for handling versioned faction IDs in URLs.
 * Format: "factionId@version" (e.g., "exiles@1.0.0")
 * If no version specified, uses latest.
 */

export interface ParsedFactionRef {
  factionId: string
  version: string | null // null = latest
}

/**
 * Parse a faction reference that may contain a version suffix.
 * Examples:
 *   "exiles" -> { factionId: "exiles", version: null }
 *   "exiles@1.0.0" -> { factionId: "exiles", version: "1.0.0" }
 */
export function parseFactionRef(ref: string): ParsedFactionRef {
  if (!ref) {
    return { factionId: '', version: null }
  }

  const atIndex = ref.indexOf('@')
  if (atIndex === -1) {
    return { factionId: ref, version: null }
  }

  return {
    factionId: ref.substring(0, atIndex),
    version: ref.substring(atIndex + 1) || null,
  }
}

/**
 * Build a faction reference string from factionId and optional version.
 * Examples:
 *   ("exiles", null) -> "exiles"
 *   ("exiles", "1.0.0") -> "exiles@1.0.0"
 */
export function buildFactionRef(factionId: string, version: string | null | undefined): string {
  if (!version) {
    return factionId
  }
  return `${factionId}@${version}`
}

export interface ParsedComparisonRef {
  factionId: string
  version: string | null
  unitId: string
  quantity: number
}

/**
 * Parse a comparison reference from URL format.
 * Format: "factionId@version/unitId:quantity" or "factionId/unitId:quantity"
 * Examples:
 *   "exiles/exodus" -> { factionId: "exiles", version: null, unitId: "exodus", quantity: 1 }
 *   "exiles@1.0.0/exodus:2" -> { factionId: "exiles", version: "1.0.0", unitId: "exodus", quantity: 2 }
 */
export function parseComparisonRef(ref: string): ParsedComparisonRef {
  const [refPart, qtyPart] = ref.split(':')
  const quantity = qtyPart ? parseInt(qtyPart, 10) || 1 : 1

  const slashIndex = refPart.indexOf('/')
  if (slashIndex === -1) {
    // No slash - treat as factionId only
    const { factionId, version } = parseFactionRef(refPart)
    return { factionId, version, unitId: '', quantity }
  }

  const factionPart = refPart.substring(0, slashIndex)
  const unitId = refPart.substring(slashIndex + 1)
  const { factionId, version } = parseFactionRef(factionPart)

  return { factionId, version, unitId, quantity }
}

/**
 * Build a comparison reference string for URL.
 * Format: "factionId@version/unitId:quantity" (version and quantity omitted if default)
 */
export function buildComparisonRef(ref: { factionId: string; version?: string | null; unitId: string; quantity: number }): string {
  const factionPart = buildFactionRef(ref.factionId, ref.version)
  const base = `${factionPart}/${ref.unitId}`
  return ref.quantity > 1 ? `${base}:${ref.quantity}` : base
}
