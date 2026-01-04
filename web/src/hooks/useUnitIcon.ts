import { useState, useEffect } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'
import { getAssetUrl, releaseAssetUrl } from '@/services/assetUrlManager'

/**
 * Hook to get the icon URL for a unit
 * Handles both static factions (in dev: URL path, in prod: blob from cache)
 * and local factions (blob URL from IndexedDB)
 */
export function useUnitIcon(factionId: string, imagePath: string | undefined) {
  const { isLocalFaction } = useFactionContext()
  // Combined state with request key to track which request the result is for
  const [state, setState] = useState<{
    key: string | null
    iconUrl: string | undefined
    error: Error | null
  }>({ key: null, iconUrl: undefined, error: null })

  const isLocal = isLocalFaction(factionId)
  // Create a unique key for the current request to track loading state
  const currentKey = imagePath ? `${factionId}:${imagePath}:${isLocal}` : null

  useEffect(() => {
    // Early return if no image path - no state updates needed
    if (!imagePath) {
      return
    }

    let isMounted = true

    getAssetUrl(factionId, imagePath, isLocal)
      .then((url: string | undefined) => {
        if (isMounted) {
          setState({ key: currentKey, iconUrl: url, error: null })
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setState({ key: currentKey, iconUrl: undefined, error: err })
        }
      })

    // Cleanup: release asset URL when component unmounts or deps change
    return () => {
      isMounted = false
      releaseAssetUrl(factionId, imagePath)
    }
  }, [factionId, imagePath, isLocal, currentKey])

  // Compute loading: we have a request but state doesn't match current key yet
  const loading = currentKey !== null && state.key !== currentKey
  // Return undefined iconUrl when no imagePath is provided
  const effectiveIconUrl = imagePath ? state.iconUrl : undefined

  return { iconUrl: effectiveIconUrl, loading, error: state.error }
}
