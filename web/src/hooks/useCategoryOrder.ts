import { useMemo, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { usePreferences } from '@/hooks/usePreferences'
import { CATEGORY_ORDER, type UnitCategory } from '@/utils/unitCategories'

export interface UseCategoryOrderReturn {
  /** Categories in the current order (custom or default) */
  orderedCategories: UnitCategory[]
  /** True if the user has a custom order saved */
  isCustomOrder: boolean
  /** Reorder categories by moving one to a new position */
  reorder: (activeId: string, overId: string) => void
  /** Reset to the default category order */
  resetToDefault: () => void
}

/**
 * Validates that a saved category order contains exactly all the expected categories.
 * Returns true if valid, false if categories have been added/removed since the order was saved.
 */
function isValidCategoryOrder(order: UnitCategory[]): boolean {
  if (order.length !== CATEGORY_ORDER.length) return false

  const orderSet = new Set(order)
  return CATEGORY_ORDER.every(cat => orderSet.has(cat))
}

/**
 * Hook for managing category display order with drag-and-drop support.
 * Uses unified preferences storage for persistence.
 */
export function useCategoryOrder(): UseCategoryOrderReturn {
  const { preferences, updatePreference, resetPreference } = usePreferences()

  // Validate saved order and fall back to default if invalid
  const orderedCategories = useMemo(() => {
    const savedOrder = preferences.categoryOrder
    if (savedOrder && isValidCategoryOrder(savedOrder)) {
      return savedOrder
    }
    return CATEGORY_ORDER
  }, [preferences.categoryOrder])

  const isCustomOrder = preferences.categoryOrder !== null &&
    isValidCategoryOrder(preferences.categoryOrder)

  const reorder = useCallback((activeId: string, overId: string) => {
    if (activeId === overId) return

    // Validate that IDs are valid categories before casting
    const isValidCategory = (id: string): id is UnitCategory =>
      orderedCategories.includes(id as UnitCategory)

    if (!isValidCategory(activeId) || !isValidCategory(overId)) {
      if (import.meta.env.DEV) {
        console.warn(`Invalid category ID in reorder: ${activeId} or ${overId}`)
      }
      return
    }

    const oldIndex = orderedCategories.indexOf(activeId)
    const newIndex = orderedCategories.indexOf(overId)

    const newOrder = arrayMove(orderedCategories, oldIndex, newIndex)
    updatePreference('categoryOrder', newOrder)
  }, [orderedCategories, updatePreference])

  const resetToDefault = useCallback(() => {
    resetPreference('categoryOrder')
  }, [resetPreference])

  return {
    orderedCategories,
    isCustomOrder,
    reorder,
    resetToDefault,
  }
}
