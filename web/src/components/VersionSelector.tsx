import { useState, useEffect } from 'react'
import Select from 'react-select'
import { selectStyles, type SelectOption } from './selectStyles'
import { getFactionVersions, type VersionEntry } from '@/services/manifestLoader'

interface VersionSelectorProps {
  factionId: string
  currentVersion: string | null // null = latest
  onVersionChange: (version: string | null) => void
  className?: string
  isDisabled?: boolean
}

interface VersionOption extends SelectOption {
  version: string | null
}

/**
 * Dropdown selector for faction versions.
 * Only renders if the faction has multiple versions available.
 * Shows loading state to prevent layout shifts.
 * Returns null only after loading confirms single/no version.
 */
export function VersionSelector({
  factionId,
  currentVersion,
  onVersionChange,
  className = '',
  isDisabled = false,
}: VersionSelectorProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Clear versions immediately when factionId changes to prevent
    // showing stale versions from the previous faction
    setVersions([])
    setLoading(true)
    setError(null)

    async function loadVersions() {
      try {
        const versionList = await getFactionVersions(factionId)
        if (!cancelled) {
          setVersions(versionList)
        }
      } catch (err) {
        console.error(`Failed to load versions for ${factionId}:`, err)
        if (!cancelled) {
          setVersions([])
          setError('Failed to load versions')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadVersions()

    return () => {
      cancelled = true
    }
  }, [factionId])

  // Only hide after loading confirms single/no version (prevents layout shift)
  if (!loading && versions.length <= 1 && !error) {
    return null
  }

  // Show error state with tooltip
  if (error) {
    return (
      <div className={`inline-flex items-center text-xs text-amber-600 dark:text-amber-400 ${className}`} title={error}>
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Version error</span>
      </div>
    )
  }

  // Show loading placeholder to prevent layout shift
  if (loading) {
    return (
      <div className={`inline-block ${className}`}>
        <Select<VersionOption, false>
          value={{ value: '', label: 'Loading...', version: null }}
          onChange={() => {}}
          options={[]}
          styles={selectStyles}
          isSearchable={false}
          isDisabled={true}
          classNamePrefix="version-select"
          menuPortalTarget={document.body}
          menuPosition="fixed"
        />
      </div>
    )
  }

  // Build options list - just version numbers, first option is latest (null)
  const options: VersionOption[] = versions.map((v, index) => ({
    value: index === 0 ? '' : v.version, // First version uses empty string to represent "latest"
    label: `v${v.version}`,
    version: index === 0 ? null : v.version,
  }))

  // Find current selection
  const selectedOption = currentVersion
    ? options.find((o) => o.version === currentVersion) || options[0]
    : options[0]

  return (
    <Select<VersionOption, false>
      value={selectedOption}
      onChange={(option) => {
        if (option) {
          onVersionChange(option.version)
        }
      }}
      options={options}
      styles={selectStyles}
      isSearchable={false}
      isDisabled={isDisabled}
      className={className}
      classNamePrefix="version-select"
      menuPortalTarget={document.body}
      menuPosition="fixed"
    />
  )
}
