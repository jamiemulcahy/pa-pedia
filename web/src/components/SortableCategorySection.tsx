import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { UnitCategorySection } from '@/components/UnitCategorySection'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import type { UnitCategory } from '@/utils/unitCategories'

interface SortableCategorySectionProps {
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
}

/**
 * Wrapper component that makes UnitCategorySection draggable using dnd-kit.
 * Provides drag handle and visual feedback during drag operations.
 * Memoized to prevent unnecessary re-renders during drag operations.
 */
export const SortableCategorySection = memo(function SortableCategorySection({
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
}: SortableCategorySectionProps) {
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

  // Don't render empty categories (they shouldn't be draggable)
  if (units.length === 0) {
    return null
  }

  return (
    <div ref={setNodeRef} style={style}>
      <UnitCategorySection
        category={category}
        units={units}
        isExpanded={isExpanded}
        onToggle={onToggle}
        factionId={factionId}
        brokenImages={brokenImages}
        onImageError={onImageError}
        compact={compact}
        showFactionBadge={showFactionBadge}
        getUnitFactionId={getUnitFactionId}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  )
})
