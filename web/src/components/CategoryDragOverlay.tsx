import { DragHandleIcon } from '@/components/DragHandleIcon'
import type { UnitCategory } from '@/utils/unitCategories'

interface CategoryDragOverlayProps {
  category: UnitCategory
  unitCount: number
}

/**
 * Simplified category preview shown during drag operations.
 * Displays just the category header with name and count.
 */
export function CategoryDragOverlay({ category, unitCount }: CategoryDragOverlayProps) {
  return (
    <div className="flex items-center gap-1 bg-background rounded-lg shadow-xl scale-[1.02] border border-primary">
      <span className="flex items-center justify-center w-8 h-10 text-muted-foreground cursor-grabbing">
        <DragHandleIcon />
      </span>
      <div className="flex-1 flex items-center gap-3 py-3 px-4 bg-muted/50 rounded-lg">
        <svg
          className="w-5 h-5"
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
        <span className="text-xl font-display font-bold">{category}</span>
        <span className="px-2 py-0.5 text-sm font-mono bg-primary/20 text-primary rounded">
          {unitCount}
        </span>
      </div>
    </div>
  )
}
