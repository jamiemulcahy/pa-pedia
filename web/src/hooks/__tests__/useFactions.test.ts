import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFactions } from '../useFactions'
import { FactionProvider } from '@/contexts/FactionContext'
import { mockMLAMetadata, mockLegionMetadata, setupMockFetch, type MockFetch } from '@/tests/mocks/factionData'

describe('useFactions', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useFactions(), {
      wrapper: FactionProvider
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.factions).toEqual([])
  })

  it('should load factions on mount', async () => {
    const { result } = renderHook(() => useFactions(), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.factions.length).toBe(3)
  })

  it('should return factions with folder names attached', async () => {
    const { result } = renderHook(() => useFactions(), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const mlaFaction = result.current.factions.find(f => f.folderName === 'MLA')
    expect(mlaFaction).toBeDefined()
    expect(mlaFaction?.displayName).toBe(mockMLAMetadata.displayName)
    expect(mlaFaction?.identifier).toBe(mockMLAMetadata.identifier)
  })

  it('should return factionsMap as Map', async () => {
    const { result } = renderHook(() => useFactions(), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.factionsMap instanceof Map).toBe(true)
    expect(result.current.factionsMap.size).toBe(3)
    expect(result.current.factionsMap.get('MLA')).toEqual(mockMLAMetadata)
  })

  it('should contain both MLA and Legion factions', async () => {
    const { result } = renderHook(() => useFactions(), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const folderNames = result.current.factions.map(f => f.folderName)
    expect(folderNames).toContain('MLA')
    expect(folderNames).toContain('Legion')
  })

  it('should handle errors gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as unknown as MockFetch

    const { result } = renderHook(() => useFactions(), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.factions).toEqual([])
  })

  it('should include all metadata fields', async () => {
    const { result } = renderHook(() => useFactions(), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const legion = result.current.factions.find(f => f.folderName === 'Legion')
    expect(legion).toMatchObject({
      identifier: mockLegionMetadata.identifier,
      displayName: mockLegionMetadata.displayName,
      version: mockLegionMetadata.version,
      author: mockLegionMetadata.author,
      description: mockLegionMetadata.description,
      type: mockLegionMetadata.type,
      folderName: 'Legion'
    })
  })
})
