/**
 * UnitModelSection
 *
 * Graceful gatekeeper for the 3D model viewer on the Unit Detail page.
 *
 * On mount it consults the faction's model availability index (`models.json`,
 * a few KB) and always renders a button, in one of four states:
 *
 * - `checking` — disabled "Checking…" while the lookup is in flight
 * - `available` — the live "View 3D Model" trigger
 * - `none` — disabled; the unit has no model, or the faction has no bundle
 * - `error` — disabled; the lookup FAILED, so we don't know either way
 *
 * Showing a disabled button rather than hiding it is deliberate: absence should
 * be explained, not silent. `none` and `error` are kept apart just as carefully
 * — a failed check must never claim the model doesn't exist, and the error
 * tooltip carries no detail from the underlying failure.
 *
 * The heavy work (three.js chunk + the unit's glb/textures) is deferred until
 * the user clicks the live trigger, which opens {@link UnitModelModal}. Nothing
 * large is downloaded on page load.
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

type Availability = 'checking' | 'available' | 'none' | 'error'
type AvailabilityAction =
  | { type: 'CHECK' }
  | { type: 'RESOLVE'; available: boolean }
  | { type: 'FAIL' }

/**
 * Tooltip when the unit genuinely has no model — the unit is missing from the
 * faction's bundle, or the faction has no bundle at all. Both are permanent
 * states for this version, so the wording is a statement of fact.
 */
const UNAVAILABLE_REASON = 'No 3D model is available for this unit at this version.'

/**
 * Tooltip when the availability check FAILED. Deliberately says nothing about
 * whether a model exists (we don't know) and carries no detail from the
 * underlying error — that stays in the console. Claiming "no model" here would
 * assert something false about data that may well exist.
 */
const ERROR_REASON = "Couldn't check for a 3D model. Try reloading the page."

const BUTTON_BASE =
  'mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors'

/** Shared look for the two non-actionable states (checking, unavailable). */
const INERT_BUTTON = `${BUTTON_BASE} cursor-not-allowed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 opacity-60`

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// useReducer (rather than useState) so we can dispatch synchronously inside the
// effect without tripping react-hooks/set-state-in-effect (mirrors useFaction).
function availabilityReducer(_state: Availability, action: AvailabilityAction): Availability {
  switch (action.type) {
    case 'CHECK':
      return 'checking'
    case 'RESOLVE':
      return action.available ? 'available' : 'none'
    case 'FAIL':
      return 'error'
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
        // The error object is intentionally not captured: modelLoader already
        // logs the detail for developers, and nothing about it may reach the UI.
        // A failure is NOT "no model" — see ERROR_REASON.
        if (!cancelled) dispatch({ type: 'FAIL' })
      })

    return () => {
      cancelled = true
    }
  }, [factionId, unitId, version])

  if (availability === 'checking') {
    return (
      <button type="button" data-testid="view-3d-model-checking" disabled className={INERT_BUTTON}>
        <Spinner />
        Checking…
      </button>
    )
  }

  if (availability === 'none' || availability === 'error') {
    // aria-disabled, not the disabled attribute: a truly disabled button suppresses
    // pointer events, so the title tooltip explaining the absence would never show.
    // This keeps it hoverable and focusable, so the reason reaches keyboard and
    // screen-reader users too.
    return (
      <button
        type="button"
        data-testid="view-3d-model"
        data-state={availability}
        aria-disabled="true"
        title={availability === 'error' ? ERROR_REASON : UNAVAILABLE_REASON}
        onClick={(e) => e.preventDefault()}
        className={INERT_BUTTON}
      >
        <span aria-hidden="true">🧊</span>
        View 3D Model
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        data-testid="view-3d-model"
        onClick={() => setOpen(true)}
        className={`${BUTTON_BASE} border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700`}
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
