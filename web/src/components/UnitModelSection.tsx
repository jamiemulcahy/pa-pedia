/**
 * UnitModelSection
 *
 * Graceful gatekeeper for the 3D model viewer on the Unit Detail page.
 *
 * On mount it consults the faction's model availability index (`models.json`,
 * a few KB). If the unit has a model it shows a "View 3D Model" button; if not —
 * or if the faction has no model bundle — it renders nothing, so the page works
 * with specs + icon exactly as before with no failed network request.
 *
 * The heavy work (three.js chunk + the unit's glb/textures) is deferred until
 * the user clicks the button, which opens {@link UnitModelModal}. Nothing large
 * is downloaded on page load.
 */

import { useEffect, useReducer, useState } from 'react'
import type { TeamColors } from '@/types/faction'
import { getFactionModelsIndex } from '@/services/modelLoader'
import { UnitModelModal } from './UnitModelModal'

interface UnitModelSectionProps {
  factionId: string
  unitId: string
  version?: string | null
  teamColors?: TeamColors
  /** Human-readable unit name for the modal title. */
  unitName?: string
}

type Availability = 'checking' | 'available' | 'none'
type AvailabilityAction = { type: 'CHECK' } | { type: 'RESOLVE'; available: boolean }

// useReducer (rather than useState) so we can dispatch synchronously inside the
// effect without tripping react-hooks/set-state-in-effect (mirrors useFaction).
function availabilityReducer(_state: Availability, action: AvailabilityAction): Availability {
  switch (action.type) {
    case 'CHECK':
      return 'checking'
    case 'RESOLVE':
      return action.available ? 'available' : 'none'
    default:
      return _state
  }
}

export function UnitModelSection({
  factionId,
  unitId,
  version,
  teamColors,
  unitName,
}: UnitModelSectionProps) {
  const [availability, dispatch] = useReducer(availabilityReducer, 'checking')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'CHECK' })

    getFactionModelsIndex(factionId, version)
      .then((index) => {
        if (cancelled) return
        dispatch({ type: 'RESOLVE', available: !!index?.units[unitId] })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'RESOLVE', available: false })
      })

    return () => {
      cancelled = true
    }
  }, [factionId, unitId, version])

  // While checking, or when unavailable, render nothing extra.
  if (availability !== 'available') return null

  return (
    <>
      <button
        type="button"
        data-testid="view-3d-model"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span aria-hidden="true">🧊</span>
        View 3D Model
      </button>

      {open && (
        <UnitModelModal
          factionId={factionId}
          unitId={unitId}
          version={version}
          teamColors={teamColors}
          title={unitName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default UnitModelSection
