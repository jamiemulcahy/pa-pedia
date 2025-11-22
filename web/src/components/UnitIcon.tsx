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
  const { iconUrl, loading } = useUnitIcon(factionId, imagePath)

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className || ''}`}>
        <div className="animate-pulse w-8 h-8 bg-muted-foreground/20 rounded" />
      </div>
    )
  }

  if (!iconUrl) {
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
