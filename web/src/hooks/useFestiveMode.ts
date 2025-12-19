import { useState, useEffect } from 'react'

const FESTIVE_MODE_KEY = 'pa-pedia-festive-mode'

/**
 * Hook to manage festive mode state with localStorage persistence
 * Festive mode enables Christmas decorations and snow effects
 */
export function useFestiveMode() {
  const [isFestiveMode, setIsFestiveMode] = useState<boolean>(() => {
    // Check if it's December (0-indexed, so 11 = December)
    const isDecember = new Date().getMonth() === 11

    // Load from localStorage, defaulting to true if it's December
    const stored = localStorage.getItem(FESTIVE_MODE_KEY)
    if (stored !== null) {
      return stored === 'true'
    }
    return isDecember
  })

  useEffect(() => {
    // Persist to localStorage when state changes
    localStorage.setItem(FESTIVE_MODE_KEY, String(isFestiveMode))
  }, [isFestiveMode])

  const toggleFestiveMode = () => {
    setIsFestiveMode(prev => !prev)
  }

  return {
    isFestiveMode,
    toggleFestiveMode,
  }
}
