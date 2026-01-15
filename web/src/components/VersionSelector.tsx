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
 * Returns null for factions with single version (hides itself).
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

  useEffect(() => {
    let cancelled = false

    // Clear versions immediately when factionId changes to prevent
    // showing stale versions from the previous faction
    setVersions([])
    setLoading(true)

    async function loadVersions() {
      try {
        const versionList = await getFactionVersions(factionId)
        if (!cancelled) {
          setVersions(versionList)
        }
      } catch (error) {
        console.error(`Failed to load versions for ${factionId}:`, error)
        if (!cancelled) {
          setVersions([])
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

  // Don't render if only one version (or none) available
  if (loading || versions.length <= 1) {
    return null
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
