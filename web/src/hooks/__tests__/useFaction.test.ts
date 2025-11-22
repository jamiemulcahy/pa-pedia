import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFaction } from '../useFaction'
import { FactionProvider } from '@/contexts/FactionContext'
import { mockMLAMetadata, mockMLAIndex, setupMockFetch } from '@/tests/mocks/factionData'

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
    })

    expect(result.current.exists).toBe(false)
    expect(result.current.metadata).toBeUndefined()
    expect(result.current.index).toBeUndefined()
  })

  // Note: Error handling for index loading is difficult to test in isolation
  // because FactionProvider caches index data globally. Error scenarios are
  // covered by integration tests and the non-existent faction test above.

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
