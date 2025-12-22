import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UnitIcon } from '@/components/UnitIcon'
import { DragHandleIcon } from '@/components/DragHandleIcon'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import type { UnitCategory } from '@/utils/unitCategories'
import type { CommanderGroup } from '@/utils/commanderDedup'
import { useCommanderGroupMaps } from '@/hooks/useCommanderGroupMaps'

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
  /** Commander groups for deduplication (only used for Commanders category) */
  commanderGroups?: CommanderGroup[]
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
  commanderGroups,
}: CategoryListColumnProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = useCallback((statsHash: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(statsHash)) {
        next.delete(statsHash)
      } else {
        next.add(statsHash)
      }
      return next
    })
  }, [])

  // Use commander groups when available for the Commanders category
  const useCommanderGroups = category === 'Commanders' && commanderGroups

  // Build lookup maps for commander group membership
  const { groupMap: commanderGroupMap, variantIdentifiers } = useCommanderGroupMaps(commanderGroups)

  // Calculate display count and hidden variant count
  const displayCount = useCommanderGroups
    ? commanderGroups.length
    : units.length

  const hiddenVariantCount = useCommanderGroups
    ? commanderGroups.reduce((sum, g) => sum + g.variants.length, 0)
    : 0

  // Build display items: filter out variants that are collapsed, insert expanded variants after their representative
  const displayItems = useMemo(() => {
    if (!useCommanderGroups) {
      return units.map(unit => ({ unit, isVariant: false, group: undefined as CommanderGroup | undefined }))
    }

    const items: Array<{
      unit: UnitIndexEntry | UnitIndexEntryWithFaction
      isVariant: boolean
      group?: CommanderGroup
    }> = []

    for (const unit of units) {
      const group = commanderGroupMap.get(unit.identifier)
      const isVariant = variantIdentifiers.has(unit.identifier)

      if (isVariant) {
        // Skip variants in main iteration - they'll be added after their representative
        continue
      }

      // Add the unit (representative or non-grouped)
      items.push({ unit, isVariant: false, group: group?.variants.length ? group : undefined })

      // If this is a representative of an expanded group, add its variants
      if (group && group.variants.length > 0 && expandedGroups.has(group.statsHash)) {
        const sortedVariants = [...group.variants].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        )
        for (const variant of sortedVariants) {
          items.push({ unit: variant, isVariant: true, group })
        }
      }
    }

    return items
  }, [units, useCommanderGroups, commanderGroupMap, variantIdentifiers, expandedGroups])

  if (units.length === 0 && (!commanderGroups || commanderGroups.length === 0)) {
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
          {displayCount}
        </span>
        {hiddenVariantCount > 0 && (
          <span
            className="px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground rounded"
            title={`${hiddenVariantCount} variant${hiddenVariantCount !== 1 ? 's' : ''} hidden (identical stats)`}
          >
            +{hiddenVariantCount}
          </span>
        )}
      </div>

      {/* Unit list */}
      <div className="py-1" role="list">
        {displayItems.map(({ unit, isVariant, group }) => {
          const unitFactionId = getUnitFactionId ? getUnitFactionId(unit) : factionId
          const factionDisplayName = showFactionBadge
            ? (unit as UnitIndexEntryWithFaction).factionDisplayName
            : ''
          const hasVariants = group && group.variants.length > 0
          const isExpanded = group && expandedGroups.has(group.statsHash)

          return (
            <div
              key={showFactionBadge ? `${unitFactionId}:${unit.identifier}` : unit.identifier}
              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors ${isVariant ? 'bg-muted/20 border-l-2 border-dashed border-muted-foreground/30 ml-2' : ''}`}
              role="listitem"
            >
              {isVariant && (
                <span className="text-muted-foreground text-xs">↳</span>
              )}
              <Link
                to={
                  showFactionBadge
                    ? `/faction/${unitFactionId}/unit/${unit.identifier}?from=all`
                    : `/faction/${unitFactionId}/unit/${unit.identifier}`
                }
                className="flex items-center gap-2 flex-1 min-w-0"
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
                {isVariant && (
                  <span className="text-[10px] text-muted-foreground italic whitespace-nowrap">(identical)</span>
                )}
                {showFactionBadge && !isVariant && (
                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                    {factionDisplayName}
                  </span>
                )}
              </Link>
              {hasVariants && !isVariant && (
                <button
                  type="button"
                  onClick={(e) => toggleGroup(group.statsHash, e)}
                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/80 transition-colors whitespace-nowrap"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `Hide ${group.variants.length} variants` : `Show ${group.variants.length} variants`}
                >
                  {isExpanded ? `Hide ${group.variants.length}` : `+${group.variants.length}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
