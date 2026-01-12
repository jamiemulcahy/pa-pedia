import { useContext } from 'react'
import { useUnitIcon } from '@/hooks/useUnitIcon'
import { CurrentFactionContext } from '@/contexts/CurrentFactionContextValue'

interface UnitIconProps {
  imagePath: string | undefined
  alt: string
  className?: string
  onError?: () => void
  /** Optional faction ID override (required when not inside CurrentFactionProvider) */
  factionId?: string
}

export function UnitIcon({ imagePath, alt, className, onError, factionId: propFactionId }: UnitIconProps) {
  // Use context directly to avoid throwing when outside provider
  const context = useContext(CurrentFactionContext)
  const factionId = propFactionId || context?.factionId || ''
  const { iconUrl, loading, error } = useUnitIcon(factionId, imagePath)

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className || ''}`}>
        <div className="animate-pulse w-full h-full bg-muted-foreground/20 rounded" />
      </div>
    )
  }

  if (error || !iconUrl) {
    // Call onError callback if provided, to let parent handle the missing icon
    if (error && onError) {
      onError()
    }
    return null
  }

  return (
    <img
      src={iconUrl}
      alt={alt}
      className={className}
      onError={onError}
    />
  )
}
