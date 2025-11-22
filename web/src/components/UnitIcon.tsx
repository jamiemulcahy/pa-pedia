import { useUnitIcon } from '@/hooks/useUnitIcon'
import { useCurrentFaction } from '@/contexts/CurrentFactionContext'

interface UnitIconProps {
  imagePath: string | undefined
  alt: string
  className?: string
  onError?: () => void
}

export function UnitIcon({ imagePath, alt, className, onError }: UnitIconProps) {
  const { factionId } = useCurrentFaction()
  const { iconUrl, loading, error } = useUnitIcon(factionId, imagePath)

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className || ''}`}>
        <div className="animate-pulse w-8 h-8 bg-muted-foreground/20 rounded" />
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
