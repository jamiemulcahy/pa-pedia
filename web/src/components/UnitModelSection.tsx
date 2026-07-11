/**
 * UnitModelSection
 *
 * Graceful gatekeeper for the 3D model viewer on the Unit Detail page.
 *
 * On mount it consults the faction's model availability index (`models.json`).
 * If the unit has a model it lazy-loads {@link UnitModelViewer} (keeping the
 * heavy three.js bundle out of the main chunk). If not — or if the faction has
 * no model bundle at all — it renders nothing, so the page works with specs +
 * icon exactly as before with no failed network request.
 */

import { Suspense, lazy, useEffect, useReducer } from 'react'
import type { TeamColors } from '@/types/faction'
import { getFactionModelsIndex } from '@/services/modelLoader'

const UnitModelViewer = lazy(() => import('./UnitModelViewer'))

interface UnitModelSectionProps {
  factionId: string
  unitId: string
  version?: string | null
  teamColors?: TeamColors
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

export function UnitModelSection({ factionId, unitId, version, teamColors }: UnitModelSectionProps) {
  const [availability, dispatch] = useReducer(availabilityReducer, 'checking')

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
    <Suspense
      fallback={
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <h2 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">3D Model</h2>
          <div className="aspect-square w-full rounded bg-[#0f1420] flex items-center justify-center text-sm text-gray-300">
            Loading 3D viewer…
          </div>
        </div>
      }
    >
      <UnitModelViewer
        factionId={factionId}
        unitId={unitId}
        version={version}
        teamColors={teamColors}
      />
    </Suspense>
  )
}

export default UnitModelSection
