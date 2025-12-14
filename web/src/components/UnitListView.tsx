import { useMemo } from 'react'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SortableCategoryListColumn } from '@/components/SortableCategoryListColumn'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import type { UnitCategory } from '@/utils/unitCategories'

interface UnitListViewProps {
  groupedUnits: Map<UnitCategory, (UnitIndexEntry | UnitIndexEntryWithFaction)[]>
  orderedCategories: UnitCategory[]
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
  showFactionBadge?: boolean
  getUnitFactionId?: (unit: UnitIndexEntry | UnitIndexEntryWithFaction) => string
  expandedCategories: Set<UnitCategory>
  onToggleCategoryExpanded: (category: UnitCategory) => void
}

export function UnitListView({
  groupedUnits,
  orderedCategories,
  factionId,
  brokenImages,
  onImageError,
  showFactionBadge = false,
  getUnitFactionId,
  expandedCategories,
  onToggleCategoryExpanded,
}: UnitListViewProps) {

  // Filter to only categories that have units
  const categoriesWithUnits = useMemo(
    () => orderedCategories.filter(cat => (groupedUnits.get(cat)?.length ?? 0) > 0),
    [groupedUnits, orderedCategories]
  )

  if (categoriesWithUnits.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No units match your filters
      </div>
    )
  }

  return (
    <SortableContext items={categoriesWithUnits} strategy={rectSortingStrategy}>
      {/* CSS Grid with horizontal flow (left-to-right, top-to-bottom) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start">
        {orderedCategories.map((category) => {
          const units = groupedUnits.get(category) || []
          if (units.length === 0) return null

          return (
            <SortableCategoryListColumn
              key={category}
              category={category}
              units={units}
              factionId={factionId}
              brokenImages={brokenImages}
              onImageError={onImageError}
              isExpanded={expandedCategories.has(category)}
              onToggleExpand={() => onToggleCategoryExpanded(category)}
              showFactionBadge={showFactionBadge}
              getUnitFactionId={getUnitFactionId}
            />
          )
        })}
      </div>
    </SortableContext>
  )
}
