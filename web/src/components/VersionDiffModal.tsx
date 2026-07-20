import { useEffect, useMemo, useReducer } from 'react'
import { Link } from 'react-router-dom'
import { useFaction } from '@/hooks/useFaction'
import { UnitIcon } from '@/components/UnitIcon'
import {
  diffFactionVersions,
  hasChanges,
  type UnitRef,
  type ChangedUnit,
  type VersionDiff,
} from '@/utils/versionDiff'
import {
  diffAssets,
  groupAssetChanges,
  type AssetChangeGroup,
  type AssetFileChange,
  type GroupedAssetChanges,
} from '@/utils/assetDiff'
import { loadFactionAssets } from '@/services/factionLoader'
import type { FactionIndex, FactionMetadata } from '@/types/faction'

interface VersionDiffModalProps {
  isOpen: boolean
  onClose: () => void
  factionId: string
  /** Older version: both the display label and the key used to load its data. */
  previousVersion: string
  /** Newer version being viewed (display label only). */
  currentVersion: string
  /**
   * Cache key of the version being viewed for asset lookup: the raw URL version
   * (null = latest, stored unversioned). Distinct from {@link currentVersion},
   * which is only the display label.
   */
  currentVersionKey: string | null
  /** Already-loaded index for the current version. */
  currentIndex: FactionIndex
  /** Metadata for the current version, for the info (author/description) diff. */
  currentMetadata?: FactionMetadata
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
  currentVersionKey,
  currentIndex,
  currentMetadata,
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
            currentVersionKey={currentVersionKey}
            currentIndex={currentIndex}
            currentMetadata={currentMetadata}
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
  currentVersionKey: string | null
  currentIndex: FactionIndex
  currentMetadata?: FactionMetadata
  onNavigate: () => void
}

/** Result of comparing the raw source-file trees of both versions. */
interface RawDiff {
  grouped: GroupedAssetChanges
  metaChanges: string[]
}

type RawState =
  | { phase: 'loading' }
  | { phase: 'ready'; diff: RawDiff }
  | { phase: 'unavailable' } // no cached asset maps (dev file mode / local)

type RawAction = { type: 'RESET' } | { type: 'READY'; diff: RawDiff } | { type: 'UNAVAILABLE' }

function rawReducer(_state: RawState, action: RawAction): RawState {
  switch (action.type) {
    case 'RESET':
      return { phase: 'loading' }
    case 'READY':
      return { phase: 'ready', diff: action.diff }
    case 'UNAVAILABLE':
      return { phase: 'unavailable' }
  }
}

/** UnitRef for every current-version unit, keyed by identifier (icons/links/names). */
function buildUnitRefs(index: FactionIndex): Map<string, UnitRef> {
  const map = new Map<string, UnitRef>()
  for (const entry of index.units) {
    map.set(entry.identifier, {
      identifier: entry.identifier,
      displayName: entry.displayName || entry.unit?.displayName || entry.identifier,
      image: entry.unit?.image,
    })
  }
  return map
}

/** Identifiers already shown in the resolved diff, so raw changes don't duplicate them. */
function resolvedUnitIds(diff: VersionDiff): Set<string> {
  const ids = new Set<string>()
  for (const u of diff.added) ids.add(u.identifier)
  for (const u of diff.removed) ids.add(u.identifier)
  for (const u of diff.changed) ids.add(u.identifier)
  return ids
}

/** Diff faction-level metadata (author/description). Version is the title, not a change. */
function diffMetadata(prev?: FactionMetadata, curr?: FactionMetadata): string[] {
  if (!prev || !curr) return []
  const out: string[] = []
  if (prev.author !== curr.author) {
    out.push(`Author: "${prev.author ?? '–'}" → "${curr.author ?? '–'}"`)
  }
  if (prev.description !== curr.description) out.push('Description updated')
  return out
}

function VersionDiffBody({
  factionId,
  previousVersion,
  currentVersion,
  currentVersionKey,
  currentIndex,
  currentMetadata,
  onNavigate,
}: VersionDiffBodyProps) {
  const { index: previousIndex, metadata: previousMetadata, loading, error, retry } = useFaction(
    factionId,
    previousVersion
  )

  const diff = useMemo(() => {
    if (!previousIndex) return null
    return diffFactionVersions(previousIndex, currentIndex, previousVersion, currentVersion)
  }, [previousIndex, currentIndex, previousVersion, currentVersion])

  const [rawState, dispatch] = useReducer(rawReducer, { phase: 'loading' })

  // Compare the raw source-file trees once the resolved diff is available. This is
  // what catches changes invisible to units.json (ammo fields, icons, …).
  useEffect(() => {
    if (!diff) return
    let cancelled = false
    dispatch({ type: 'RESET' })

    ;(async () => {
      try {
        const [prevAssets, currAssets] = await Promise.all([
          loadFactionAssets(factionId, false, previousVersion),
          loadFactionAssets(factionId, false, currentVersionKey),
        ])
        const metaChanges = diffMetadata(previousMetadata, currentMetadata)

        if (!prevAssets || !currAssets) {
          // No cached file trees (e.g. dev file mode). Metadata may still differ.
          if (cancelled) return
          if (metaChanges.length > 0) {
            dispatch({
              type: 'READY',
              diff: { grouped: { groups: [], changedFileCount: 0 }, metaChanges },
            })
          } else {
            dispatch({ type: 'UNAVAILABLE' })
          }
          return
        }

        const fileChanges = await diffAssets(prevAssets, currAssets)
        const grouped = groupAssetChanges(fileChanges, resolvedUnitIds(diff), buildUnitRefs(currentIndex))
        if (!cancelled) dispatch({ type: 'READY', diff: { grouped, metaChanges } })
      } catch (err) {
        console.error('Failed to compare source files for version diff:', err)
        if (!cancelled) dispatch({ type: 'UNAVAILABLE' })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [diff, factionId, previousVersion, currentVersionKey, currentIndex, previousMetadata, currentMetadata])

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

  const resolvedHas = hasChanges(diff)
  const rawReady = rawState.phase === 'ready' ? rawState.diff : null
  const hasOther =
    !!rawReady && (rawReady.grouped.changedFileCount > 0 || rawReady.metaChanges.length > 0)

  // Fallback: only claim "version bump only" once the source comparison has finished
  // and found nothing on either side.
  if (!resolvedHas && !hasOther) {
    if (rawState.phase === 'loading') {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Analysing source files…
        </div>
      )
    }
    if (rawState.phase === 'unavailable') {
      return (
        <div className="text-center py-12 text-muted-foreground">
          No tracked changes between v{previousVersion} and v{currentVersion}.
        </div>
      )
    }
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">Version-number bump only.</p>
        <p className="text-sm">
          The version changed from v{previousVersion} to v{currentVersion}, but nothing in the
          extracted faction data did.
        </p>
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

      {rawState.phase === 'loading' && (
        <p className="text-xs text-muted-foreground italic">Analysing source files…</p>
      )}

      {hasOther && rawReady && (
        <OtherChangesSection
          factionId={factionId}
          grouped={rawReady.grouped}
          metaChanges={rawReady.metaChanges}
          onNavigate={onNavigate}
        />
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

interface OtherChangesSectionProps {
  factionId: string
  grouped: GroupedAssetChanges
  metaChanges: string[]
  onNavigate: () => void
}

/**
 * Secondary, technical section for changes that don't surface as resolved unit
 * stats — raw source-file edits (verbatim PA field names), icon changes, and
 * faction-info edits. Deliberately muted so the balance sections stay prominent.
 */
function OtherChangesSection({ factionId, grouped, metaChanges, onNavigate }: OtherChangesSectionProps) {
  const count = grouped.changedFileCount + (metaChanges.length > 0 ? 1 : 0)
  return (
    <section className="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-muted-foreground">
        Other changes ({count})
      </h3>
      <p className="text-xs text-muted-foreground mb-2">
        Source-level edits not reflected in unit stats (raw PA field names).
      </p>
      <ul className="space-y-2">
        {metaChanges.length > 0 && (
          <li className="bg-muted/40 rounded-md p-2">
            <span className="text-sm font-semibold">Faction info</span>
            <ul className="mt-1 ml-2 list-disc list-inside space-y-0.5">
              {metaChanges.map((line) => (
                <li key={line} className="text-xs font-mono text-muted-foreground">
                  {line}
                </li>
              ))}
            </ul>
          </li>
        )}
        {grouped.groups.map((group) => (
          <OtherChangeGroup key={group.key} factionId={factionId} group={group} onNavigate={onNavigate} />
        ))}
      </ul>
    </section>
  )
}

function fileStatusLabel(file: AssetFileChange): string {
  if (file.status === 'added') return `${file.name} (added)`
  if (file.status === 'removed') return `${file.name} (removed)`
  return file.name
}

function OtherChangeGroup({
  factionId,
  group,
  onNavigate,
}: {
  factionId: string
  group: AssetChangeGroup
  onNavigate: () => void
}) {
  const heading = group.ref ? (
    <Link
      to={`/faction/${factionId}/unit/${group.ref.identifier}`}
      onClick={onNavigate}
      className="inline-flex items-center gap-2 hover:text-primary transition-colors"
    >
      <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-muted rounded">
        <UnitIcon imagePath={group.ref.image} alt={group.label} className="w-6 h-6" factionId={factionId} />
      </span>
      <span className="text-sm font-semibold">{group.label}</span>
    </Link>
  ) : (
    <span className="text-sm font-semibold">{group.label}</span>
  )

  return (
    <li className="bg-muted/40 rounded-md p-2">
      {heading}
      <ul className="mt-1 ml-2 space-y-1">
        {group.files.map((file) => (
          <li key={file.path}>
            <span className="text-xs font-mono text-muted-foreground/80">{fileStatusLabel(file)}</span>
            {file.lines.length > 0 && (
              <ul className="ml-3 list-disc list-inside space-y-0.5">
                {file.lines.map((line, i) => (
                  <li key={i} className="text-xs font-mono text-muted-foreground">
                    {line}
                  </li>
                ))}
                {file.truncatedLines > 0 && (
                  <li className="text-xs italic text-muted-foreground">
                    …and {file.truncatedLines} more
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </li>
  )
}
