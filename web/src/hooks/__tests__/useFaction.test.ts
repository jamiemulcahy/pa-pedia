import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFaction } from '../useFaction'
import { FactionProvider } from '@/contexts/FactionContext'
import { mockMLAMetadata, mockMLAIndex, setupMockFetch } from '@/tests/mocks/factionData'

type MockFetch = Mock<[input: string | URL | Request, init?: RequestInit], Promise<Response>>

describe('useFaction', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return undefined metadata initially', () => {
    const { result } = renderHook(() => useFaction('MLA'), {
      wrapper: FactionProvider
    })

    expect(result.current.metadata).toBeUndefined()
    expect(result.current.exists).toBe(false)
  })

  it('should load faction metadata', async () => {
    const { result } = renderHook(() => useFaction('MLA'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.metadata).toBeDefined()
    })

    expect(result.current.metadata).toEqual(mockMLAMetadata)
    expect(result.current.exists).toBe(true)
  })

  it('should lazy-load faction index', async () => {
    const { result } = renderHook(() => useFaction('MLA'), {
      wrapper: FactionProvider
    })

    // Wait for metadata to load
    await waitFor(() => {
      expect(result.current.metadata).toBeDefined()
    })

    // Wait for index to load
    await waitFor(() => {
      expect(result.current.index).toBeDefined()
    })

    expect(result.current.index).toEqual(mockMLAIndex)
  })

  it('should return units from index', async () => {
    const { result } = renderHook(() => useFaction('MLA'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.units.length).toBeGreaterThan(0)
    })

    expect(result.current.units).toEqual(mockMLAIndex.units)
  })

  it('should show loading state while fetching', async () => {
    const { result } = renderHook(() => useFaction('MLA'), {
      wrapper: FactionProvider
    })

    // Initially not loading (waiting for metadata)
    expect(result.current.loading).toBe(false)

    // Wait for metadata
    await waitFor(() => {
      expect(result.current.metadata).toBeDefined()
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.index).toBeDefined()
  })

  it('should handle non-existent faction', async () => {
    const { result } = renderHook(() => useFaction('NonExistent'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    }, { timeout: 3000 })

    expect(result.current.exists).toBe(false)
    expect(result.current.metadata).toBeUndefined()
    expect(result.current.index).toBeUndefined()
  })

  it('should handle errors when loading index', async () => {
    const { result } = renderHook(() => useFaction('MLA'), {
      wrapper: FactionProvider
    })

    // Wait for metadata
    await waitFor(() => {
      expect(result.current.metadata).toBeDefined()
    })

    // Mock fetch to fail for index
    global.fetch = vi.fn((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('units.json')) {
        return Promise.reject(new Error('Failed to load index'))
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockMLAMetadata
      } as Response)
    }) as unknown as MockFetch

    // Trigger re-render by changing faction
    const { result: result2 } = renderHook(() => useFaction('Legion'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result2.current.metadata).toBeDefined()
    })

    // Try to load index which should fail
    await waitFor(() => {
      expect(result2.current.error).toBeDefined()
    }, { timeout: 3000 })
  })

  it('should return empty units array when index not loaded', () => {
    const { result } = renderHook(() => useFaction('MLA'), {
      wrapper: FactionProvider
    })

    expect(result.current.units).toEqual([])
  })

  it('should update when faction ID changes', async () => {
    const { result, rerender } = renderHook(
      ({ factionId }) => useFaction(factionId),
      {
        wrapper: FactionProvider,
        initialProps: { factionId: 'MLA' }
      }
    )

    await waitFor(() => {
      expect(result.current.metadata?.identifier).toBe('mla')
    })

    rerender({ factionId: 'Legion' })

    await waitFor(() => {
      expect(result.current.metadata?.identifier).toBe('legion')
    })
  })
})
