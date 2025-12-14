import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CategoryListColumn } from '@/components/CategoryListColumn'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import type { UnitCategory } from '@/utils/unitCategories'

interface SortableCategoryListColumnProps {
  category: UnitCategory
  units: (UnitIndexEntry | UnitIndexEntryWithFaction)[]
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
  showFactionBadge?: boolean
  getUnitFactionId?: (unit: UnitIndexEntry | UnitIndexEntryWithFaction) => string
}

/**
 * Wrapper component that makes CategoryListColumn draggable using dnd-kit.
 * Provides drag handle and visual feedback during drag operations.
 * Memoized to prevent unnecessary re-renders during drag operations.
 */
export const SortableCategoryListColumn = memo(function SortableCategoryListColumn({
  category,
  units,
  factionId,
  brokenImages,
  onImageError,
  isExpanded,
  onToggleExpand,
  showFactionBadge = false,
  getUnitFactionId,
}: SortableCategoryListColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Don't render empty categories
  if (units.length === 0) {
    return null
  }

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryListColumn
        category={category}
        units={units}
        factionId={factionId}
        brokenImages={brokenImages}
        onImageError={onImageError}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        showFactionBadge={showFactionBadge}
        getUnitFactionId={getUnitFactionId}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  )
})
