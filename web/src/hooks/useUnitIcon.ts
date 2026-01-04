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
  const [iconUrl, setIconUrl] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isLocal = isLocalFaction(factionId)

  useEffect(() => {
    if (!imagePath) {
      setIconUrl(undefined)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    getAssetUrl(factionId, imagePath, isLocal)
      .then((url: string | undefined) => {
        if (isMounted) {
          setIconUrl(url)
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err)
          setIconUrl(undefined)
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    // Cleanup: release asset URL when component unmounts or deps change
    return () => {
      isMounted = false
      if (imagePath) {
        releaseAssetUrl(factionId, imagePath)
      }
    }
  }, [factionId, imagePath, isLocal])

  return { iconUrl, loading, error }
}
