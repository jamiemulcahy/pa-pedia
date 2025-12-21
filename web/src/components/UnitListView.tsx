import { useMemo } from 'react'
import Masonry from 'react-masonry-css'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SortableCategoryListColumn } from '@/components/SortableCategoryListColumn'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import type { UnitCategory } from '@/utils/unitCategories'
import type { CommanderGroupingResult } from '@/utils/commanderDedup'

// Responsive breakpoints for masonry columns (matches Tailwind breakpoints)
const MASONRY_BREAKPOINTS = {
  default: 5,  // xl and above
  1280: 5,     // xl
  1024: 4,     // lg
  768: 3,      // md
  640: 2,      // sm
  0: 1,        // mobile
}

interface UnitListViewProps {
  groupedUnits: Map<UnitCategory, (UnitIndexEntry | UnitIndexEntryWithFaction)[]>
  orderedCategories: UnitCategory[]
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
  showFactionBadge?: boolean
  getUnitFactionId?: (unit: UnitIndexEntry | UnitIndexEntryWithFaction) => string
  /** Commander grouping result for deduplication */
  commanderGrouping?: CommanderGroupingResult | null
}

export function UnitListView({
  groupedUnits,
  orderedCategories,
  factionId,
  brokenImages,
  onImageError,
  showFactionBadge = false,
  getUnitFactionId,
  commanderGrouping,
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
      {/* Masonry layout with horizontal reading order */}
      <Masonry
        breakpointCols={MASONRY_BREAKPOINTS}
        className="flex -ml-4 w-auto"
        columnClassName="pl-4 bg-clip-padding"
      >
        {categoriesWithUnits.map((category) => {
          const units = groupedUnits.get(category) || []

          return (
            <div key={category} className="mb-4">
              <SortableCategoryListColumn
                category={category}
                units={units}
                factionId={factionId}
                brokenImages={brokenImages}
                onImageError={onImageError}
                showFactionBadge={showFactionBadge}
                getUnitFactionId={getUnitFactionId}
                commanderGroups={category === 'Commanders' ? commanderGrouping?.commanders : undefined}
              />
            </div>
          )
        })}
      </Masonry>
    </SortableContext>
  )
}
