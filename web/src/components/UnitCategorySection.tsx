import { Link } from 'react-router-dom'
import { UnitIcon } from '@/components/UnitIcon'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import type { UnitCategory } from '@/utils/unitCategories'

interface UnitCategorySectionProps {
  category: UnitCategory
  units: (UnitIndexEntry | UnitIndexEntryWithFaction)[]
  isExpanded: boolean
  onToggle: () => void
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
  compact?: boolean
  showFactionBadge?: boolean
  getUnitFactionId?: (unit: UnitIndexEntry | UnitIndexEntryWithFaction) => string
  /** Props for the drag handle element (from useSortable) */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  /** Whether this section is currently being dragged */
  isDragging?: boolean
}

export function UnitCategorySection({
  category,
  units,
  isExpanded,
  onToggle,
  factionId,
  brokenImages,
  onImageError,
  compact = false,
  showFactionBadge = false,
  getUnitFactionId,
  dragHandleProps,
  isDragging = false,
}: UnitCategorySectionProps) {
  if (units.length === 0) {
    return null
  }

  return (
    <section className={`mb-6 ${isDragging ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-1">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className="flex items-center justify-center w-8 h-10 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing rounded transition-colors"
            aria-label={`Drag to reorder ${category} category`}
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 py-3 px-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left"
          aria-expanded={isExpanded}
          aria-controls={`category-${category}`}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="sr-only">{isExpanded ? 'Collapse' : 'Expand'} {category} section</span>
          <h2 className="text-xl font-display font-bold">{category}</h2>
          <span className="px-2 py-0.5 text-sm font-mono bg-primary/20 text-primary rounded">
            {units.length}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div
          id={`category-${category}`}
          className={
            compact
              ? 'grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 mt-4'
              : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4'
          }
          role="list"
        >
          {units.map((unit) => {
            const unitFactionId = getUnitFactionId ? getUnitFactionId(unit) : factionId
            const factionDisplayName = showFactionBadge ? (unit as UnitIndexEntryWithFaction).factionDisplayName : ''

            return (
              <Link
                key={showFactionBadge ? `${unitFactionId}:${unit.identifier}` : unit.identifier}
                to={showFactionBadge
                  ? `/faction/${unitFactionId}/unit/${unit.identifier}?from=all`
                  : `/faction/${unitFactionId}/unit/${unit.identifier}`
                }
                className={
                  compact
                    ? 'block border rounded p-1 hover:border-primary transition-all hover:shadow-md hover:shadow-primary/20 text-center'
                    : 'block border rounded-lg p-3 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 text-center'
                }
                role="listitem"
                aria-label={`View ${unit.displayName} details`}
                title={showFactionBadge ? `${unit.displayName} (${factionDisplayName})` : unit.displayName}
              >
                <div className={compact ? 'aspect-square flex items-center justify-center' : 'aspect-square mb-2 flex items-center justify-center'}>
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
                      factionId={unitFactionId}
                    />
                  )}
                </div>
                {!compact && (
                  <>
                    <div className="text-sm font-semibold truncate">{unit.displayName}</div>
                    {showFactionBadge && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{factionDisplayName}</div>
                    )}
                    <div className="text-xs text-muted-foreground flex gap-1 flex-wrap justify-center mt-1">
                      {unit.unitTypes.slice(0, 2).map((type) => (
                        <span key={type} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                          {type}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
