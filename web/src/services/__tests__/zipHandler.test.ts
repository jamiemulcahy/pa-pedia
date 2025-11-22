import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
import { parseFactionZip } from '../zipHandler'

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: (str: string) => str // Pass through for testing
  }
}))

describe('zipHandler', () => {
  describe('parseFactionZip', () => {
    const createValidMetadata = () => ({
      identifier: 'TestFaction',
      displayName: 'Test Faction',
      version: '1.0.0',
      type: 'mod',
      author: 'Test Author',
      description: 'A test faction'
    })

    const createValidIndex = () => ({
      units: [
        {
          identifier: 'test_unit',
          displayName: 'Test Unit',
          unitTypes: ['Mobile', 'Land'],
          source: 'test',
          files: [],
          unit: {
            id: 'test_unit',
            resourceName: '/pa/units/test/test.json',
            displayName: 'Test Unit',
            tier: 1,
            unitTypes: ['Mobile', 'Land'],
            accessible: true,
            specs: {
              combat: { health: 100 },
              economy: { buildCost: 100 }
            }
          }
        }
      ]
    })

    const createZipFile = async (contents: Record<string, string | Blob>): Promise<File> => {
      const zip = new JSZip()
      for (const [path, content] of Object.entries(contents)) {
        zip.file(path, content)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      return new File([blob], 'test.zip', { type: 'application/zip' })
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should parse a valid zip file at root level', async () => {
      const file = await createZipFile({
        'metadata.json': JSON.stringify(createValidMetadata()),
        'units.json': JSON.stringify(createValidIndex())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.factionId).toBe('TestFaction')
        expect(result.data.metadata.displayName).toBe('Test Faction')
        expect(result.data.index.units).toHaveLength(1)
      }
    })

    it('should parse a valid zip file with files in a subfolder', async () => {
      const file = await createZipFile({
        'TestFaction/metadata.json': JSON.stringify(createValidMetadata()),
        'TestFaction/units.json': JSON.stringify(createValidIndex())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.factionId).toBe('TestFaction')
      }
    })

    it('should extract assets from the assets folder', async () => {
      const testImageBlob = new Blob(['fake image data'], { type: 'image/png' })
      const file = await createZipFile({
        'metadata.json': JSON.stringify(createValidMetadata()),
        'units.json': JSON.stringify(createValidIndex()),
        'assets/pa/units/test/test_icon.png': testImageBlob
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.assets.size).toBe(1)
        expect(result.data.assets.has('assets/pa/units/test/test_icon.png')).toBe(true)
      }
    })

    it('should return error when metadata.json is missing', async () => {
      const file = await createZipFile({
        'units.json': JSON.stringify(createValidIndex())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('missing-file')
        expect(result.error.message).toContain('metadata.json')
      }
    })

    it('should return error when units.json is missing', async () => {
      const file = await createZipFile({
        'metadata.json': JSON.stringify(createValidMetadata())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('missing-file')
        expect(result.error.message).toContain('units.json')
      }
    })

    it('should return error for invalid metadata JSON', async () => {
      const file = await createZipFile({
        'metadata.json': 'not valid json',
        'units.json': JSON.stringify(createValidIndex())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('invalid-json')
      }
    })

    it('should return error when required metadata fields are missing', async () => {
      const file = await createZipFile({
        'metadata.json': JSON.stringify({ identifier: 'Test' }), // Missing required fields
        'units.json': JSON.stringify(createValidIndex())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('validation')
        expect(result.error.message).toContain('missing required fields')
      }
    })

    it('should return error when units array is missing', async () => {
      const file = await createZipFile({
        'metadata.json': JSON.stringify(createValidMetadata()),
        'units.json': JSON.stringify({ notUnits: [] })
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('validation')
        expect(result.error.message).toContain('units')
      }
    })

    it('should append --local suffix for static faction IDs', async () => {
      const metadata = createValidMetadata()
      metadata.identifier = 'MLA'

      const file = await createZipFile({
        'metadata.json': JSON.stringify(metadata),
        'units.json': JSON.stringify(createValidIndex())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.factionId).toBe('MLA--local')
      }
    })

    it('should append --local suffix for Legion faction ID', async () => {
      const metadata = createValidMetadata()
      metadata.identifier = 'Legion'

      const file = await createZipFile({
        'metadata.json': JSON.stringify(metadata),
        'units.json': JSON.stringify(createValidIndex())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.factionId).toBe('Legion--local')
      }
    })

    it('should not modify non-static faction IDs', async () => {
      const metadata = createValidMetadata()
      metadata.identifier = 'CustomFaction'

      const file = await createZipFile({
        'metadata.json': JSON.stringify(metadata),
        'units.json': JSON.stringify(createValidIndex())
      })

      const result = await parseFactionZip(file)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.factionId).toBe('CustomFaction')
      }
    })
  })
})
