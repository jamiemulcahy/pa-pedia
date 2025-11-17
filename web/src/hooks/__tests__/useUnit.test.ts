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
      expect(result.current.loading).toBe(false)
    })

    const firstFetchCount = (global.fetch as MockFetch).mock.calls.length

    // Force a re-render by temporarily changing to a different unit
    rerender({ factionId: 'MLA', unitId: 'bot' })

    await waitFor(() => {
      expect(result.current.unit?.id).toBe('bot')
      expect(result.current.loading).toBe(false)
    })

    const secondFetchCount = (global.fetch as MockFetch).mock.calls.length

    // Change back to tank (should use cache, no additional fetch)
    rerender({ factionId: 'MLA', unitId: 'tank' })

    await waitFor(() => {
      expect(result.current.unit?.id).toBe('tank')
    })

    const thirdFetchCount = (global.fetch as MockFetch).mock.calls.length

    // Units are now embedded in the faction index, so all units are loaded when the index is fetched.
    // Therefore, switching between units doesn't trigger additional fetches.
    // Initial state: discovery + MLA metadata + MLA index (with all units embedded) = 3 fetches
    // After bot: 0 (already cached from index load) = 3 fetches
    // After back to tank: 0 (already cached from index load) = 3 fetches
    expect(secondFetchCount).toBe(firstFetchCount) // Bot was already cached
    expect(thirdFetchCount).toBe(secondFetchCount) // Tank was already cached
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
    })

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
      expect(result.current.unit?.id).toBe('tank')
    })

    // Change to different unit
    rerender({ factionId: 'MLA', unitId: 'bot' })

    await waitFor(() => {
      expect(result.current.unit?.id).toBe('bot')
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
    expect(unit).toHaveProperty('id')
    expect(unit).toHaveProperty('displayName')
    expect(unit).toHaveProperty('specs')
    expect(unit).toHaveProperty('unitTypes')
    expect(unit.specs).toHaveProperty('combat')
    expect(unit.specs).toHaveProperty('economy')
  })

  it('should include weapons in combat specs if available', async () => {
    const { result } = renderHook(() => useUnit('MLA', 'tank'), {
      wrapper: FactionProvider
    })

    await waitFor(() => {
      expect(result.current.unit).toBeDefined()
    })

    expect(result.current.unit?.specs.combat.weapons).toBeDefined()
    expect(Array.isArray(result.current.unit?.specs.combat.weapons)).toBe(true)
    expect(result.current.unit?.specs.combat.weapons?.length).toBeGreaterThan(0)
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
