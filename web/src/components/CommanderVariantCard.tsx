import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UnitIcon } from '@/components/UnitIcon'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import type { CommanderGroup } from '@/utils/commanderDedup'

interface CommanderVariantCardProps {
  group: CommanderGroup
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
  compact?: boolean
  showFactionBadge?: boolean
  getUnitFactionId?: (unit: UnitIndexEntry | UnitIndexEntryWithFaction) => string
}

/**
 * Renders a commander group with expand/collapse for variants.
 * Shows the representative commander with a "Show variants" button.
 * When expanded, all variants are shown as full-size cards.
 */
export function CommanderVariantCard({
  group,
  factionId,
  brokenImages,
  onImageError,
  compact = false,
  showFactionBadge = false,
  getUnitFactionId,
}: CommanderVariantCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { representative, variants } = group
  const hasVariants = variants.length > 0

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsExpanded((prev) => !prev)
  }, [])

  // Render a single unit card (full-size, same as regular units)
  const renderUnitCard = (
    unit: UnitIndexEntry | UnitIndexEntryWithFaction,
    isVariant = false
  ) => {
    const cardFactionId = getUnitFactionId ? getUnitFactionId(unit) : factionId
    const cardFactionDisplayName = showFactionBadge
      ? (unit as UnitIndexEntryWithFaction).factionDisplayName
      : ''

    return (
      <Link
        key={showFactionBadge ? `${cardFactionId}:${unit.identifier}` : unit.identifier}
        to={
          showFactionBadge
            ? `/faction/${cardFactionId}/unit/${unit.identifier}?from=all`
            : `/faction/${cardFactionId}/unit/${unit.identifier}`
        }
        className={
          compact
            ? `block border rounded p-1 hover:border-primary transition-all hover:shadow-md hover:shadow-primary/20 text-center ${isVariant ? 'border-dashed border-muted-foreground/50' : ''}`
            : `block border rounded-lg p-3 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 text-center ${isVariant ? 'border-dashed border-muted-foreground/50' : ''}`
        }
        role="listitem"
        aria-label={`View ${unit.displayName} details`}
        title={
          showFactionBadge
            ? `${unit.displayName} (${cardFactionDisplayName})`
            : unit.displayName
        }
      >
        <div
          className={
            compact
              ? 'aspect-square flex items-center justify-center'
              : 'aspect-square mb-2 flex items-center justify-center'
          }
        >
          {brokenImages.has(unit.identifier) ? (
            <div
              className={
                compact
                  ? 'w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-mono'
                  : 'w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs font-mono'
              }
              aria-label={`${unit.displayName} icon not available`}
            >
              No Icon
            </div>
          ) : (
            <UnitIcon
              imagePath={unit.unit.image}
              alt={`${unit.displayName} icon`}
              className="max-w-full max-h-full object-contain"
              onError={() => onImageError(unit.identifier)}
              factionId={cardFactionId}
            />
          )}
        </div>
        {!compact && (
          <>
            <div className="text-sm font-semibold truncate">
              {unit.displayName}
            </div>
            {showFactionBadge && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {cardFactionDisplayName}
              </div>
            )}
            <div className="text-xs text-muted-foreground flex gap-1 flex-wrap justify-center mt-1">
              {unit.unitTypes.slice(0, 2).map((type) => (
                <span
                  key={type}
                  className="px-1 py-0.5 bg-muted rounded text-xs font-mono"
                >
                  {type}
                </span>
              ))}
            </div>
            {isVariant && (
              <div className="text-[10px] text-muted-foreground mt-1 italic">
                (identical stats)
              </div>
            )}
          </>
        )}
      </Link>
    )
  }

  // If no variants, render as a simple card
  if (!hasVariants) {
    return renderUnitCard(representative)
  }

  // Render representative with expand button, and variants when expanded
  return (
    <>
      {/* Representative card with expand button */}
      <div className="relative" role="listitem">
        {renderUnitCard(representative)}

        {/* Expand/collapse button - more prominent */}
        <button
          type="button"
          onClick={toggleExpanded}
          className={`absolute ${compact ? '-bottom-1 left-1/2 -translate-x-1/2' : 'bottom-2 left-1/2 -translate-x-1/2'} px-2 py-1 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors shadow-md whitespace-nowrap`}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? `Hide ${variants.length} commander variants`
              : `Show ${variants.length} commander variants`
          }
        >
          {isExpanded ? `Hide ${variants.length}` : `+${variants.length} variants`}
        </button>
      </div>

      {/* Expanded variants - rendered as full-size cards */}
      {isExpanded &&
        variants.map((variant) => renderUnitCard(variant, true))}
    </>
  )
}
