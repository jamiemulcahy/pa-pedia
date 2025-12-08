import { useState, useCallback, useEffect, useRef } from 'react'
import type { UnitCategory } from '@/utils/unitCategories'

const STORAGE_KEY = 'pa-pedia-preferences'
const OLD_VIEW_MODE_KEY = 'pa-pedia-view-mode'

export interface Preferences {
  viewMode: 'grid' | 'table'
  categoryOrder: UnitCategory[] | null // null = default order
  collapsedCategories: UnitCategory[]
  compactView: boolean
  showInaccessible: boolean
}

const DEFAULT_PREFERENCES: Preferences = {
  viewMode: 'grid',
  categoryOrder: null,
  collapsedCategories: [],
  compactView: false,
  showInaccessible: false,
}

/**
 * Validates that a value is a valid Preferences object.
 * Returns the validated preferences or null if invalid.
 */
function validatePreferences(value: unknown): Preferences | null {
  if (!value || typeof value !== 'object') return null

  const obj = value as Record<string, unknown>

  // Validate viewMode
  if (obj.viewMode !== 'grid' && obj.viewMode !== 'table') return null

  // Validate categoryOrder (null or array of strings)
  if (obj.categoryOrder !== null && !Array.isArray(obj.categoryOrder)) return null
  if (Array.isArray(obj.categoryOrder) && !obj.categoryOrder.every(c => typeof c === 'string')) {
    return null
  }

  // Validate collapsedCategories (array of strings)
  if (!Array.isArray(obj.collapsedCategories)) return null
  if (!obj.collapsedCategories.every(c => typeof c === 'string')) return null

  // Validate booleans
  if (typeof obj.compactView !== 'boolean') return null
  if (typeof obj.showInaccessible !== 'boolean') return null

  // All validations passed, safe to cast
  return {
    viewMode: obj.viewMode,
    categoryOrder: obj.categoryOrder,
    collapsedCategories: obj.collapsedCategories,
    compactView: obj.compactView,
    showInaccessible: obj.showInaccessible,
  } as Preferences
}

/**
 * Loads preferences from localStorage, handling migration from old keys.
 */
function loadPreferences(): Preferences {
  try {
    // Check for existing preferences
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const validated = validatePreferences(parsed)
      if (validated) return validated
    }

    // Migrate from old view mode key if present
    const oldViewMode = localStorage.getItem(OLD_VIEW_MODE_KEY)
    if (oldViewMode === 'table' || oldViewMode === 'grid') {
      const viewMode: 'grid' | 'table' = oldViewMode
      const migrated: Preferences = { ...DEFAULT_PREFERENCES, viewMode }
      // Save migrated preferences and remove old key
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      localStorage.removeItem(OLD_VIEW_MODE_KEY)
      return migrated
    }
  } catch {
    // localStorage may not be available or JSON may be invalid
  }

  return DEFAULT_PREFERENCES
}

/**
 * Saves preferences to localStorage.
 */
function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // localStorage may not be available
  }
}

export interface UsePreferencesReturn {
  preferences: Preferences
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  resetPreference: <K extends keyof Preferences>(key: K) => void
  resetAllPreferences: () => void
}

/**
 * Unified preferences hook for managing all user preferences with localStorage persistence.
 */
export function usePreferences(): UsePreferencesReturn {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)
  const isInitialized = useRef(false)

  // Save to localStorage whenever preferences change (but not on initial load)
  useEffect(() => {
    if (isInitialized.current) {
      savePreferences(preferences)
    } else {
      isInitialized.current = true
    }
  }, [preferences])

  const updatePreference = useCallback(<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetPreference = useCallback(<K extends keyof Preferences>(key: K) => {
    setPreferences(prev => ({ ...prev, [key]: DEFAULT_PREFERENCES[key] }))
  }, [])

  const resetAllPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
  }, [])

  return {
    preferences,
    updatePreference,
    resetPreference,
    resetAllPreferences,
  }
}
