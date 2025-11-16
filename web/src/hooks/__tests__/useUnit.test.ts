import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUnit } from '../useUnit'
import { FactionProvider } from '@/contexts/FactionContext'
import { mockTankUnit, mockBotUnit, setupMockFetch } from '@/tests/mocks/factionData'

type MockFetch = Mock<[input: string | URL | Request, init?: RequestInit], Promise<Response>>

describe('useUnit', () => {
  beforeEach(() => {
    setupMockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return undefined unit initially', () => {
    const { result } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    expect(result.current.unit).toBeUndefined()
  })

  it('should show loading state while fetching', async () => {
    const { result } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    // Should show loading immediately
    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })
  })

  it('should lazy-load unit data', async () => {
    const { result } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.unit).toBeDefined()
    })

    expect(result.current.unit).toEqual(mockTankUnit)
  })

  it('should stop loading after fetch completes', async () => {
    const { result } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.unit).toBeDefined()
  })

  it('should use cache on second render', async () => {
    // Use rerender to stay in the same provider instance
    const { result, rerender } = renderHook(
      ({ factionId, unitId }) => useUnit(factionId, unitId),
      {
        wrapper: FactionProvider,
        initialProps: { factionId: 'MLA', unitId: 'tank' }
      }
    )

    await waitFor(() => {
      expect(result.current.unit).toBeDefined()
    })

    const firstFetchCount = (global.fetch as MockFetch).mock.calls.length

    // Force a re-render by temporarily changing to a different unit
    rerender({ factionId: 'MLA', unitId: 'bot' })

    await waitFor(() => {
      expect(result.current.unit?.identifier).toBe('bot')
    })

    // Change back to tank (should use cache)
    rerender({ factionId: 'MLA', unitId: 'tank' })

    await waitFor(() => {
      expect(result.current.unit?.identifier).toBe('tank')
    })

    const secondFetchCount = (global.fetch as MockFetch).mock.calls.length

    // Should have fetched bot (1 additional) but not tank again
    // Initial: 2 metadata + 1 tank = 3
    // After bot: +1 = 4
    // After back to tank: 0 (cached) = 4
    expect(secondFetchCount).toBe(firstFetchCount + 1) // Only bot was fetched
    expect(result.current.unit).toEqual(mockTankUnit)
  })

  it('should load different units independently', async () => {
    const { result: tankResult } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    const { result: botResult } = renderHook(() => useUnit('MLA', 'bot'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(tankResult.current.unit).toBeDefined()
    })

    await waitFor(() => {
      expect(botResult.current.unit).toBeDefined()
    })

    expect(tankResult.current.unit).toEqual(mockTankUnit)
    expect(botResult.current.unit).toEqual(mockBotUnit)
  })

  it('should handle errors when loading fails', async () => {
    const { result } = renderHook(() => useUnit('MLA', 'invalid_unit'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    }, { timeout: 3000 })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.unit).toBeUndefined()
  })

  it('should update when faction or unit ID changes', async () => {
    const { result, rerender } = renderHook(
      ({ factionId, unitId }) => useUnit(factionId, unitId),
      {
        wrapper: FactionProvider,
        initialProps: { factionId: 'MLA', unitId: 'tank' }
      }
    )

    await waitFor(() => {
      expect(result.current.unit?.identifier).toBe('tank')
    })

    // Change to different unit
    rerender({ factionId: 'MLA', unitId: 'bot' })

    await waitFor(() => {
      expect(result.current.unit?.identifier).toBe('bot')
    })
  })

  it('should handle empty faction or unit ID', () => {
    const { result } = renderHook(() => useUnit('', ''), {
      wrapper: FactionProvider
    })

    expect(result.current.unit).toBeUndefined()
    expect(result.current.loading).toBe(false)
  })

  it('should return complete unit specification', async () => {
    const { result } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.unit).toBeDefined()
    })

    const unit = result.current.unit!
    expect(unit).toHaveProperty('identifier')
    expect(unit).toHaveProperty('displayName')
    expect(unit).toHaveProperty('specs')
    expect(unit).toHaveProperty('unitTypes')
    expect(unit.specs).toHaveProperty('combat')
    expect(unit.specs).toHaveProperty('economy')
  })

  it('should include weapons if available', async () => {
    const { result } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.unit).toBeDefined()
    })

    expect(result.current.unit?.weapons).toBeDefined()
    expect(Array.isArray(result.current.unit?.weapons)).toBe(true)
    expect(result.current.unit?.weapons?.length).toBeGreaterThan(0)
  })

  it('should clear error on successful load', async () => {
    const { result } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.unit).toBeDefined()
  })
})
