import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFaction } from '@/hooks/useFaction'
import { UnitIcon } from '@/components/UnitIcon'
import {
  diffFactionVersions,
  hasChanges,
  type UnitRef,
  type ChangedUnit,
} from '@/utils/versionDiff'
import type { FactionIndex } from '@/types/faction'

interface VersionDiffModalProps {
  isOpen: boolean
  onClose: () => void
  factionId: string
  /** Older version: both the display label and the key used to load its data. */
  previousVersion: string
  /** Newer version being viewed (display label only). */
  currentVersion: string
  /** Already-loaded index for the current version. */
  currentIndex: FactionIndex
}

/**
 * Modal that shows a human-readable, computed diff between the faction version
 * currently being viewed and the immediately previous version.
 *
 * Loading of the previous version's data is deferred: the body (which triggers
 * the fetch via {@link useFaction}) is only mounted while the modal is open.
 */
export function VersionDiffModal({
  isOpen,
  onClose,
  factionId,
  previousVersion,
  currentVersion,
  currentIndex,
}: VersionDiffModalProps) {
  // Close on Escape while open
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-diff-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] min-h-[300px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 id="version-diff-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
            What changed: <span className="font-mono">v{previousVersion}</span>
            {' → '}
            <span className="font-mono">v{currentVersion}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-3xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body (deferred load) */}
        <div className="flex-1 overflow-auto p-4 min-h-0">
          <VersionDiffBody
            factionId={factionId}
            previousVersion={previousVersion}
            currentVersion={currentVersion}
            currentIndex={currentIndex}
            onNavigate={onClose}
          />
        </div>
      </div>
    </div>
  )
}

interface VersionDiffBodyProps {
  factionId: string
  previousVersion: string
  currentVersion: string
  currentIndex: FactionIndex
  onNavigate: () => void
}

function VersionDiffBody({
  factionId,
  previousVersion,
  currentVersion,
  currentIndex,
  onNavigate,
}: VersionDiffBodyProps) {
  const { index: previousIndex, loading, error, retry } = useFaction(factionId, previousVersion)

  const diff = useMemo(() => {
    if (!previousIndex) return null
    return diffFactionVersions(previousIndex, currentIndex, previousVersion, currentVersion)
  }, [previousIndex, currentIndex, previousVersion, currentVersion])

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400 mb-3">
          Failed to load v{previousVersion} for comparison.
        </p>
        <button
          onClick={retry}
          className="px-4 py-2 border rounded-md bg-background hover:bg-muted transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (loading || !diff) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading v{previousVersion}…
      </div>
    )
  }

  if (!hasChanges(diff)) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tracked changes between v{previousVersion} and v{currentVersion}.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {diff.added.length > 0 && (
        <DiffSection
          title="Added"
          count={diff.added.length}
          accentClass="text-green-600 dark:text-green-400"
        >
          {diff.added.map((unit) => (
            <UnitRow key={unit.identifier} factionId={factionId} unit={unit} onNavigate={onNavigate} />
          ))}
        </DiffSection>
      )}

      {diff.changed.length > 0 && (
        <DiffSection
          title="Changed"
          count={diff.changed.length}
          accentClass="text-amber-600 dark:text-amber-400"
        >
          {diff.changed.map((unit) => (
            <ChangedUnitRow key={unit.identifier} factionId={factionId} unit={unit} onNavigate={onNavigate} />
          ))}
        </DiffSection>
      )}

      {diff.removed.length > 0 && (
        <DiffSection
          title="Removed"
          count={diff.removed.length}
          accentClass="text-red-600 dark:text-red-400"
        >
          {diff.removed.map((unit) => (
            <UnitRow key={unit.identifier} factionId={factionId} unit={unit} onNavigate={onNavigate} linkable={false} />
          ))}
        </DiffSection>
      )}
    </div>
  )
}

interface DiffSectionProps {
  title: string
  count: number
  accentClass: string
  children: React.ReactNode
}

function DiffSection({ title, count, accentClass, children }: DiffSectionProps) {
  return (
    <section>
      <h3 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${accentClass}`}>
        {title} ({count})
      </h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

interface UnitRowProps {
  factionId: string
  unit: UnitRef
  onNavigate: () => void
  /** Removed units no longer exist in the current version, so don't link them. */
  linkable?: boolean
}

function UnitRow({ factionId, unit, onNavigate, linkable = true }: UnitRowProps) {
  const content = (
    <span className="flex items-center gap-2">
      <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-muted rounded">
        <UnitIcon imagePath={unit.image} alt={unit.displayName} className="w-6 h-6" factionId={factionId} />
      </span>
      <span className="text-sm font-semibold">{unit.displayName}</span>
    </span>
  )

  if (!linkable) {
    return <li className="text-muted-foreground line-through">{content}</li>
  }

  return (
    <li>
      <Link
        to={`/faction/${factionId}/unit/${unit.identifier}`}
        onClick={onNavigate}
        className="inline-flex hover:text-primary transition-colors"
      >
        {content}
      </Link>
    </li>
  )
}

interface ChangedUnitRowProps {
  factionId: string
  unit: ChangedUnit
  onNavigate: () => void
}

function ChangedUnitRow({ factionId, unit, onNavigate }: ChangedUnitRowProps) {
  return (
    <li className="bg-muted/50 rounded-md p-2">
      <Link
        to={`/faction/${factionId}/unit/${unit.identifier}`}
        onClick={onNavigate}
        className="inline-flex items-center gap-2 hover:text-primary transition-colors"
      >
        <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-muted rounded">
          <UnitIcon imagePath={unit.image} alt={unit.displayName} className="w-6 h-6" factionId={factionId} />
        </span>
        <span className="text-sm font-semibold">{unit.displayName}</span>
      </Link>
      <ul className="mt-1 ml-9 list-disc list-inside space-y-0.5">
        {unit.fields.map((field) => (
          <li key={field.label} className="text-xs font-mono text-muted-foreground">
            {field.display}
          </li>
        ))}
      </ul>
    </li>
  )
}
