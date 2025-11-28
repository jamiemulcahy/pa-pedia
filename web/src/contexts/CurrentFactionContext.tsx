import React, { useContext } from 'react'
import { useFactionContext } from './FactionContext'
import { CurrentFactionContext, type CurrentFactionContextValue } from './CurrentFactionContextValue'

// Re-export for backwards compatibility
export { CurrentFactionContext } from './CurrentFactionContextValue'

interface CurrentFactionProviderProps {
  factionId: string
  children: React.ReactNode
}

/**
 * Provider that wraps a faction's component subtree, allowing any child
 * component to access the current faction's details without prop drilling.
 *
 * Use this when displaying faction content - each faction gets its own provider,
 * enabling multiple factions on screen simultaneously (e.g., comparison views).
 */
export function CurrentFactionProvider({ factionId, children }: CurrentFactionProviderProps) {
  const { getFaction, isLocalFaction } = useFactionContext()
  const metadata = getFaction(factionId)
  const isLocal = isLocalFaction(factionId)

  return (
    <CurrentFactionContext.Provider value={{ factionId, isLocal, metadata }}>
      {children}
    </CurrentFactionContext.Provider>
  )
}

/**
 * Hook to access the current faction's context.
 * Must be used within a CurrentFactionProvider.
 *
 * @example
 * const { factionId, isLocal, metadata } = useCurrentFaction()
 *
 * @throws {Error} If used outside of CurrentFactionProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentFaction(): CurrentFactionContextValue {
  const context = useContext(CurrentFactionContext)
  if (!context) {
    throw new Error('useCurrentFaction must be used within a CurrentFactionProvider')
  }
  return context
}
