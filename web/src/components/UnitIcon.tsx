import { useUnitIcon } from '@/hooks/useUnitIcon'

interface UnitIconProps {
  factionId: string
  imagePath: string | undefined
  alt: string
  className?: string
  onError?: () => void
}

export function UnitIcon({ factionId, imagePath, alt, className, onError }: UnitIconProps) {
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
