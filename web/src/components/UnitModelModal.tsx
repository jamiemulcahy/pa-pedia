/**
 * UnitModelModal
 *
 * Modal wrapper that hosts the 3D {@link UnitModelViewer} at a larger size. The
 * viewer is lazy-loaded here, so the heavy three.js chunk AND the unit's model
 * assets are only fetched once this modal is opened (i.e. the user explicitly
 * clicked "View 3D Model"). Mirrors the app's existing modal pattern
 * (BlueprintModal): backdrop click + ESC to close, panel stops propagation.
 */

import { Suspense, lazy, useEffect, useState } from 'react'
import type { TeamColors } from '@/types/faction'
import { LazyLoadBoundary } from './LazyLoadBoundary'

const loadViewer = () => import('./UnitModelViewer')

// React caches a lazy component's rejected import for good, so Try again has to
// swap in a fresh lazy(). Module-level rather than per-modal so a successful
// retry also fixes the next modal opened, and an ordinary re-render never
// recreates the component.
let UnitModelViewer = lazy(loadViewer)
function retryViewerImport() {
  UnitModelViewer = lazy(loadViewer)
}

const VIEWER_PLACEHOLDER =
  'aspect-square w-full rounded bg-[#0f1420] flex items-center justify-center text-sm text-gray-300'

interface UnitModelModalProps {
  factionId: string
  unitId: string
  version?: string | null
  teamColors?: TeamColors
  /** Human-readable unit name for the modal title. */
  title?: string
  onClose: () => void
}

export function UnitModelModal({
  factionId,
  unitId,
  version,
  teamColors,
  title,
  onClose,
}: UnitModelModalProps) {
  // Bumped after retryViewerImport() so this modal re-renders with the new lazy().
  const [, setAttempt] = useState(0)

  // ESC closes the modal.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ? `3D model: ${title}` : '3D model'}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title ? `${title} — 3D Model` : '3D Model'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-3xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-auto min-h-0">
          <LazyLoadBoundary
            feature="the 3D viewer"
            onRetry={() => {
              retryViewerImport()
              setAttempt(a => a + 1)
            }}
            className={VIEWER_PLACEHOLDER}
          >
            <Suspense fallback={<div className={VIEWER_PLACEHOLDER}>Loading 3D viewer…</div>}>
              {/* Keyed on faction so a faction change remounts the viewer, re-seeding
                  the colour pickers from that faction's defaults rather than keeping
                  the previous faction's picks. */}
              <UnitModelViewer
                key={factionId}
                factionId={factionId}
                unitId={unitId}
                version={version}
                teamColors={teamColors}
                showChrome={false}
              />
            </Suspense>
          </LazyLoadBoundary>
        </div>
      </div>
    </div>
  )
}

export default UnitModelModal
