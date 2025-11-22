import JSZip from 'jszip'
import DOMPurify from 'dompurify'
import type { FactionMetadata, FactionIndex, Unit, UnitIndexEntry } from '@/types/faction'

export interface ParsedFaction {
  factionId: string
  metadata: FactionMetadata
  index: FactionIndex
  assets: Map<string, Blob>
}

export interface ParseError {
  type: 'missing-file' | 'invalid-json' | 'validation' | 'extraction'
  message: string
}

const STATIC_FACTIONS = ['MLA', 'Legion']

/**
 * Sanitize a string to prevent XSS
 */
function sanitize(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return DOMPurify.sanitize(value)
}

/**
 * Sanitize faction metadata
 */
function sanitizeMetadata(metadata: FactionMetadata): FactionMetadata {
  return {
    ...metadata,
    displayName: sanitize(metadata.displayName) ?? metadata.displayName,
    description: sanitize(metadata.description),
    author: sanitize(metadata.author),
  }
}

/**
 * Sanitize unit data
 */
function sanitizeUnit(unit: Unit): Unit {
  return {
    ...unit,
    displayName: sanitize(unit.displayName) ?? unit.displayName,
    description: sanitize(unit.description),
  }
}

/**
 * Sanitize faction index (all units)
 */
function sanitizeIndex(index: FactionIndex): FactionIndex {
  return {
    units: index.units.map((entry: UnitIndexEntry) => ({
      ...entry,
      displayName: sanitize(entry.displayName) ?? entry.displayName,
      unit: sanitizeUnit(entry.unit),
    })),
  }
}

/**
 * Resolve faction ID conflicts with static factions
 * If ID matches a static faction, append '--local'
 */
function resolveIdConflict(factionId: string): string {
  // Check for static faction conflict
  if (STATIC_FACTIONS.includes(factionId)) {
    return `${factionId}--local`
  }

  // No conflict with static factions
  return factionId
}

/**
 * Parse and validate a faction zip file
 */
export async function parseFactionZip(
  file: File,
  _existingLocalIds: string[] = []
): Promise<{ success: true; data: ParsedFaction } | { success: false; error: ParseError }> {
  try {
    const zip = await JSZip.loadAsync(file)

    // Find metadata.json and units.json (may be at root or in a subfolder)
    let metadataFile: JSZip.JSZipObject | null = null
    let unitsFile: JSZip.JSZipObject | null = null
    let rootPath = ''

    // Check root level first
    if (zip.file('metadata.json')) {
      metadataFile = zip.file('metadata.json')
      unitsFile = zip.file('units.json')
      rootPath = ''
    } else {
      // Check for a single folder containing the files
      const folders = Object.keys(zip.files)
        .filter(name => name.endsWith('/') && !name.includes('/', name.indexOf('/') + 1))

      for (const folder of folders) {
        const meta = zip.file(`${folder}metadata.json`)
        const units = zip.file(`${folder}units.json`)
        if (meta && units) {
          metadataFile = meta
          unitsFile = units
          rootPath = folder
          break
        }
      }
    }

    if (!metadataFile) {
      return {
        success: false,
        error: {
          type: 'missing-file',
          message: 'metadata.json not found in zip file',
        },
      }
    }

    if (!unitsFile) {
      return {
        success: false,
        error: {
          type: 'missing-file',
          message: 'units.json not found in zip file',
        },
      }
    }

    // Parse metadata
    let metadata: FactionMetadata
    try {
      const metadataText = await metadataFile.async('string')
      metadata = JSON.parse(metadataText)
    } catch {
      return {
        success: false,
        error: {
          type: 'invalid-json',
          message: 'Failed to parse metadata.json',
        },
      }
    }

    // Validate required metadata fields
    if (!metadata.identifier || !metadata.displayName || !metadata.version || !metadata.type) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'metadata.json missing required fields (identifier, displayName, version, type)',
        },
      }
    }

    // Parse units index
    let index: FactionIndex
    try {
      const indexText = await unitsFile.async('string')
      index = JSON.parse(indexText)
    } catch {
      return {
        success: false,
        error: {
          type: 'invalid-json',
          message: 'Failed to parse units.json',
        },
      }
    }

    // Validate index structure
    if (!index.units || !Array.isArray(index.units)) {
      return {
        success: false,
        error: {
          type: 'validation',
          message: 'units.json must contain a "units" array',
        },
      }
    }

    // Resolve faction ID
    const factionId = resolveIdConflict(metadata.identifier)

    // Sanitize data
    const sanitizedMetadata = sanitizeMetadata(metadata)
    const sanitizedIndex = sanitizeIndex(index)

    // Extract assets
    const assets = new Map<string, Blob>()
    const assetsPath = rootPath + 'assets/'

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (path.startsWith(assetsPath) && !zipEntry.dir) {
        // Get relative path from assets folder
        const relativePath = 'assets/' + path.slice(assetsPath.length)
        const blob = await zipEntry.async('blob')
        assets.set(relativePath, blob)
      }
    }

    return {
      success: true,
      data: {
        factionId,
        metadata: sanitizedMetadata,
        index: sanitizedIndex,
        assets,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'extraction',
        message: error instanceof Error ? error.message : 'Failed to extract zip file',
      },
    }
  }
}
