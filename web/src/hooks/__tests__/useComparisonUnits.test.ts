import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useComparisonUnits } from '../useComparisonUnits'
import { FactionProvider } from '@/contexts/FactionContext'
import { setupMockFetch } from '@/tests/mocks/factionData'
import React from 'react'

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(FactionProvider, null, children)
}

describe('useComparisonUnits', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return empty arrays when no refs provided', () => {
    const { result } = renderHook(() => useComparisonUnits([]), { wrapper })

    expect(result.current.units).toEqual([])
    expect(result.current.loading).toEqual([])
    expect(result.current.errors).toEqual([])
    expect(result.current.anyLoading).toBe(false)
  })

  it('should load a single comparison unit', async () => {
    const refs = [{ factionId: 'MLA', unitId: 'tank' }]
    const { result } = renderHook(() => useComparisonUnits(refs), { wrapper })

    // Initially loading
    expect(result.current.anyLoading).toBe(true)

    // Wait for unit to load
    await waitFor(() => {
      expect(result.current.units[0]).toBeDefined()
    })

    expect(result.current.units[0]?.displayName).toBe('Tank')
    expect(result.current.anyLoading).toBe(false)
  })

  it('should load multiple comparison units in parallel', async () => {
    const refs = [
      { factionId: 'MLA', unitId: 'tank' },
      { factionId: 'MLA', unitId: 'bot' }
    ]
    const { result } = renderHook(() => useComparisonUnits(refs), { wrapper })

    await waitFor(() => {
      expect(result.current.units[0]).toBeDefined()
      expect(result.current.units[1]).toBeDefined()
    })

    expect(result.current.units[0]?.displayName).toBe('Tank')
    expect(result.current.units[1]?.displayName).toBe('Bot')
  })

  it('should handle empty unitId (pending selection)', async () => {
    const refs = [{ factionId: 'MLA', unitId: '' }]
    const { result } = renderHook(() => useComparisonUnits(refs), { wrapper })

    // Should not try to load and should not show loading
    await waitFor(() => {
      expect(result.current.units[0]).toBeUndefined()
    })

    expect(result.current.loading[0]).toBe(false)
    expect(result.current.anyLoading).toBe(false)
  })

  it('should handle cross-faction units', async () => {
    const refs = [
      { factionId: 'MLA', unitId: 'tank' },
      { factionId: 'Legion', unitId: 'legion_tank' }
    ]
    const { result } = renderHook(() => useComparisonUnits(refs), { wrapper })

    await waitFor(() => {
      expect(result.current.units[0]).toBeDefined()
      expect(result.current.units[1]).toBeDefined()
    })

    expect(result.current.units[0]?.displayName).toBe('Tank')
    expect(result.current.units[1]?.displayName).toBe('Legion Tank')
  })

  it('should return arrays aligned with input order', async () => {
    const refs = [
      { factionId: 'MLA', unitId: 'bot' },
      { factionId: 'MLA', unitId: 'tank' },
      { factionId: 'MLA', unitId: 'air_fighter' }
    ]
    const { result } = renderHook(() => useComparisonUnits(refs), { wrapper })

    await waitFor(() => {
      expect(result.current.units.every(u => u !== undefined)).toBe(true)
    })

    // Order should match input refs
    expect(result.current.units[0]?.displayName).toBe('Bot')
    expect(result.current.units[1]?.displayName).toBe('Tank')
    expect(result.current.units[2]?.displayName).toBe('Fighter')
  })

  it('should handle refs changes without infinite loops', async () => {
    const initialRefs = [{ factionId: 'MLA', unitId: 'tank' }]
    const { result, rerender } = renderHook(
      (refs) => useComparisonUnits(refs),
      { wrapper, initialProps: initialRefs }
    )

    await waitFor(() => {
      expect(result.current.units[0]).toBeDefined()
    })

    // Change refs - should not cause infinite loop
    const newRefs = [
      { factionId: 'MLA', unitId: 'tank' },
      { factionId: 'MLA', unitId: 'bot' }
    ]
    rerender(newRefs)

    await waitFor(() => {
      expect(result.current.units[1]).toBeDefined()
    })

    expect(result.current.units[0]?.displayName).toBe('Tank')
    expect(result.current.units[1]?.displayName).toBe('Bot')
  })

  it('should clean up states when refs are removed', async () => {
    const initialRefs = [
      { factionId: 'MLA', unitId: 'tank' },
      { factionId: 'MLA', unitId: 'bot' }
    ]
    const { result, rerender } = renderHook(
      (refs) => useComparisonUnits(refs),
      { wrapper, initialProps: initialRefs }
    )

    await waitFor(() => {
      expect(result.current.units.length).toBe(2)
    })

    // Remove one ref
    const newRefs = [{ factionId: 'MLA', unitId: 'tank' }]
    rerender(newRefs)

    await waitFor(() => {
      expect(result.current.units.length).toBe(1)
    })

    expect(result.current.units[0]?.displayName).toBe('Tank')
  })
})
