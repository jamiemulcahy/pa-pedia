import { Link } from 'react-router-dom'
import { UnitIcon } from '@/components/UnitIcon'
import { DragHandleIcon } from '@/components/DragHandleIcon'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import type { UnitCategory } from '@/utils/unitCategories'

interface CategoryListColumnProps {
  category: UnitCategory
  units: (UnitIndexEntry | UnitIndexEntryWithFaction)[]
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
  showFactionBadge?: boolean
  getUnitFactionId?: (unit: UnitIndexEntry | UnitIndexEntryWithFaction) => string
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  isDragging?: boolean
}

export function CategoryListColumn({
  category,
  units,
  factionId,
  brokenImages,
  onImageError,
  showFactionBadge = false,
  getUnitFactionId,
  dragHandleProps,
  isDragging = false,
}: CategoryListColumnProps) {
  if (units.length === 0) {
    return null
  }

  return (
    <div
      className={`border rounded-lg bg-card ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 rounded-t-lg">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing rounded transition-colors"
            aria-label={`Drag to reorder ${category} category`}
          >
            <DragHandleIcon />
          </span>
        )}
        <h3 className="flex-1 font-display font-semibold text-sm">{category}</h3>
        <span className="px-1.5 py-0.5 text-xs font-mono bg-primary/20 text-primary rounded">
          {units.length}
        </span>
      </div>

      {/* Unit list */}
      <div className="py-1" role="list">
        {units.map((unit) => {
          const unitFactionId = getUnitFactionId ? getUnitFactionId(unit) : factionId
          const factionDisplayName = showFactionBadge
            ? (unit as UnitIndexEntryWithFaction).factionDisplayName
            : ''

          return (
            <Link
              key={showFactionBadge ? `${unitFactionId}:${unit.identifier}` : unit.identifier}
              to={
                showFactionBadge
                  ? `/faction/${unitFactionId}/unit/${unit.identifier}?from=all`
                  : `/faction/${unitFactionId}/unit/${unit.identifier}`
              }
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors"
              role="listitem"
              title={showFactionBadge ? `${unit.displayName} (${factionDisplayName})` : unit.displayName}
            >
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                {brokenImages.has(unit.identifier) ? (
                  <div className="w-full h-full bg-muted rounded text-[8px] flex items-center justify-center text-muted-foreground">
                    ?
                  </div>
                ) : (
                  <UnitIcon
                    imagePath={unit.unit.image}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    onError={() => onImageError(unit.identifier)}
                    factionId={unitFactionId}
                  />
                )}
              </div>
              <span className="text-sm truncate flex-1">{unit.displayName}</span>
              {showFactionBadge && (
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  {factionDisplayName}
                </span>
              )}
            </Link>
          )
        })}
      </div>

    </div>
  )
}
