import { useState, useEffect } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'
import { getUnitIconPathFromImage, getLocalAssetUrl } from '@/services/factionLoader'

/**
 * Hook to get the icon URL for a unit
 * Handles both static factions (URL path) and local factions (blob URL from IndexedDB)
 */
export function useUnitIcon(factionId: string, imagePath: string | undefined) {
  const { isLocalFaction } = useFactionContext()
  const [iconUrl, setIconUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isLocal = isLocalFaction(factionId)

  useEffect(() => {
    if (!imagePath) {
      setIconUrl('')
      return
    }

    if (!isLocal) {
      // Static faction - use direct URL path
      setIconUrl(getUnitIconPathFromImage(factionId, imagePath))
      return
    }

    // Local faction - load from IndexedDB
    let blobUrl: string | undefined
    setLoading(true)
    setError(null)

    getLocalAssetUrl(factionId, imagePath)
      .then((url) => {
        if (url) {
          blobUrl = url
          setIconUrl(url)
        } else {
          setIconUrl('')
        }
      })
      .catch((err) => {
        setError(err)
        setIconUrl('')
      })
      .finally(() => {
        setLoading(false)
      })

    // Cleanup: revoke blob URL when component unmounts or deps change
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [factionId, imagePath, isLocal])

  return { iconUrl, loading, error }
}
