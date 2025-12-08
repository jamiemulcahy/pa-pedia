import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Select from 'react-select'
import { useFactionContext } from '@/contexts/FactionContext'
import { selectStyles, type SelectOption } from './selectStyles'
import { findBestMatchingUnit } from '@/utils/unitMatcher'

interface FactionOption extends SelectOption {
  isLocal: boolean
}

interface BreadcrumbNavProps {
  factionId: string
  unitId?: string
  /** Optional callback for custom navigation (used in comparison mode) */
  onUnitChange?: (factionId: string, unitId: string) => void
  /** Source unit types for auto-matching when faction changes (comparison mode) */
  sourceUnitTypes?: string[]
}

export function BreadcrumbNav({ factionId, unitId, onUnitChange, sourceUnitTypes }: BreadcrumbNavProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { factions, getFactionIndex, loadFaction } = useFactionContext()

  // Track selected faction for filtering units (may differ from URL during selection)
  const [selectedFactionId, setSelectedFactionId] = useState(factionId)
  const [isLoadingFaction, setIsLoadingFaction] = useState(false)

  // Get faction options - use Map key (folder name) for URL, not metadata.identifier
  const factionOptions = useMemo(() => {
    return Array.from(factions.entries()).map(([folderId, faction]) => ({
      value: folderId,
      label: faction.displayName,
      isLocal: faction.isLocal,
    }))
  }, [factions])

  // Get unit options for selected faction (not necessarily current URL faction)
  const unitOptions = useMemo(() => {
    const factionIndex = getFactionIndex(selectedFactionId)
    if (!factionIndex) return []

    return factionIndex.units.map(entry => ({
      value: entry.identifier,
      label: entry.displayName,
    })).sort((a, b) => a.label.localeCompare(b.label))
  }, [selectedFactionId, getFactionIndex])

  // Current selections
  const selectedFaction = factionOptions.find(opt => opt.value === selectedFactionId) || null
  const selectedUnit = unitId && selectedFactionId === factionId
    ? unitOptions.find(opt => opt.value === unitId) || null
    : null

  // Custom format for faction options to show LOCAL tag
  const formatFactionOption = (option: FactionOption) => (
    <div className="flex items-center gap-2">
      <span>{option.label}</span>
      {option.isLocal && (
        <span className="px-1.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded">
          LOCAL
        </span>
      )}
    </div>
  )

  const handleFactionChange = async (option: FactionOption | null) => {
    if (option) {
      setSelectedFactionId(option.value)
      // Load faction data if not already loaded (for unit options)
      setIsLoadingFaction(true)
      try {
        await loadFaction(option.value)

        // Auto-match unit if in comparison mode with source types
        if (sourceUnitTypes && onUnitChange) {
          const factionIndex = getFactionIndex(option.value)
          if (factionIndex) {
            const match = findBestMatchingUnit(sourceUnitTypes, factionIndex.units)
            if (match) {
              onUnitChange(option.value, match.identifier)
            } else {
              console.debug('No matching unit found for auto-selection in faction:', option.value)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load faction:', error)
      } finally {
        setIsLoadingFaction(false)
      }
    }
  }

  const handleUnitChange = (option: SelectOption | null) => {
    if (option) {
      if (onUnitChange) {
        onUnitChange(selectedFactionId, option.value)
      } else {
        // Preserve compare parameter when changing primary unit
        const compareParam = searchParams.get('compare')
        const url = compareParam
          ? `/faction/${selectedFactionId}/unit/${option.value}?compare=${compareParam}`
          : `/faction/${selectedFactionId}/unit/${option.value}`
        navigate(url)
      }
    }
  }

  return (
    <nav aria-label="Unit navigation" className="w-full sm:w-auto">
      <div className="flex flex-col sm:flex-row sm:inline-flex items-stretch sm:items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="w-full sm:w-auto sm:min-w-[140px]">
          <Select<FactionOption>
            options={factionOptions}
            value={selectedFaction}
            onChange={handleFactionChange}
            styles={selectStyles}
            placeholder="Select faction..."
            isSearchable
            aria-label="Select faction"
            formatOptionLabel={formatFactionOption}
            menuPortalTarget={document.body}
            menuPosition="fixed"
          />
        </div>

        <span className="text-gray-400 dark:text-gray-500 text-lg hidden sm:inline self-center">&rarr;</span>

        <div className="w-full sm:w-auto sm:min-w-[200px]">
          <Select<SelectOption>
            options={unitOptions}
            value={selectedUnit}
            onChange={handleUnitChange}
            styles={selectStyles}
            placeholder={isLoadingFaction ? "Loading..." : unitOptions.length ? "Select unit..." : "Loading units..."}
            isSearchable
            isLoading={isLoadingFaction}
            aria-label="Select unit"
            noOptionsMessage={() => unitOptions.length === 0 ? "Loading units..." : "No units found"}
            menuPortalTarget={document.body}
            menuPosition="fixed"
          />
        </div>
      </div>
    </nav>
  )
}
