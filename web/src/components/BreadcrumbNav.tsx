import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Select from 'react-select'
import { useFactionContext } from '@/contexts/FactionContext'
import { selectStyles, type SelectOption } from './selectStyles'
import { findBestMatchingUnit } from '@/utils/unitMatcher'

const ALL_FACTIONS_VALUE = '__all__'

interface FactionOption extends SelectOption {
  isLocal: boolean
}

interface UnitOptionWithFaction extends SelectOption {
  factionId: string
  factionName: string
}

interface BreadcrumbNavProps {
  factionId: string
  unitId?: string
  /** Optional callback for custom navigation (used in comparison mode) */
  onUnitChange?: (factionId: string, unitId: string) => void
  /** Source unit types for auto-matching when faction changes (comparison mode) */
  sourceUnitTypes?: string[]
  /** Enable "All factions" option even without onUnitChange (for primary unit in comparison mode) */
  enableAllFactions?: boolean
}

export function BreadcrumbNav({ factionId, unitId, onUnitChange, sourceUnitTypes, enableAllFactions }: BreadcrumbNavProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { factions, getFactionIndex, loadFaction, factionIndexes } = useFactionContext()

  // Track selected faction for filtering units (may differ from URL during selection)
  const [selectedFactionId, setSelectedFactionId] = useState(factionId)
  const [isLoadingFaction, setIsLoadingFaction] = useState(false)

  // Show "All factions" when explicitly enabled or when onUnitChange is provided (comparison slots)
  const showAllFactionsOption = enableAllFactions || !!onUnitChange
  const isAllFactionsSelected = selectedFactionId === ALL_FACTIONS_VALUE

  // Get faction options - use Map key (folder name) for URL, not metadata.identifier
  const factionOptions = useMemo(() => {
    const options: FactionOption[] = Array.from(factions.entries()).map(([folderId, faction]) => ({
      value: folderId,
      label: faction.displayName,
      isLocal: faction.isLocal,
    }))

    // Add "All" option at the start when enabled
    if (showAllFactionsOption) {
      options.unshift({
        value: ALL_FACTIONS_VALUE,
        label: 'All',
        isLocal: false,
      })
    }

    return options
  }, [factions, showAllFactionsOption])

  // Get unit options for selected faction (not necessarily current URL faction)
  // When "All factions" is selected, aggregate units from all loaded factions
  const unitOptions = useMemo((): UnitOptionWithFaction[] => {
    if (isAllFactionsSelected) {
      // Aggregate units from ALL loaded faction indexes
      const allUnits: UnitOptionWithFaction[] = []

      for (const [facId, index] of factionIndexes.entries()) {
        const factionMeta = factions.get(facId)
        const factionName = factionMeta?.displayName || facId

        for (const entry of index.units) {
          allUnits.push({
            value: `${facId}/${entry.identifier}`, // Encode faction in value
            label: entry.displayName,
            factionId: facId,
            factionName: factionName,
          })
        }
      }

      // Sort by unit name, then by faction
      return allUnits.sort((a, b) =>
        a.label.localeCompare(b.label) || a.factionName.localeCompare(b.factionName)
      )
    }

    // Single faction mode
    const factionIndex = getFactionIndex(selectedFactionId)
    if (!factionIndex) return []

    const factionMeta = factions.get(selectedFactionId)
    const factionName = factionMeta?.displayName || selectedFactionId

    return factionIndex.units.map(entry => ({
      value: entry.identifier,
      label: entry.displayName,
      factionId: selectedFactionId,
      factionName: factionName,
    })).sort((a, b) => a.label.localeCompare(b.label))
  }, [selectedFactionId, getFactionIndex, isAllFactionsSelected, factionIndexes, factions])

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

      // Handle "All factions" selection - load all faction indexes
      if (option.value === ALL_FACTIONS_VALUE) {
        setIsLoadingFaction(true)
        try {
          // Load all factions in parallel
          const factionIds = Array.from(factions.keys())
          await Promise.all(factionIds.map(id => loadFaction(id)))
        } catch (error) {
          console.error('Failed to load factions:', error)
        } finally {
          setIsLoadingFaction(false)
        }
        return
      }

      // Load single faction data if not already loaded (for unit options)
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

  const handleUnitChange = (option: UnitOptionWithFaction | null) => {
    if (option) {
      // In "All factions" mode, the value is "factionId/unitId"
      // In single faction mode, value is just "unitId"
      const targetFactionId = isAllFactionsSelected ? option.factionId : selectedFactionId
      const targetUnitId = isAllFactionsSelected ? option.value.split('/')[1] : option.value

      if (onUnitChange) {
        onUnitChange(targetFactionId, targetUnitId)
      } else {
        // Preserve compare parameter when changing primary unit
        const compareParam = searchParams.get('compare')
        const url = compareParam
          ? `/faction/${targetFactionId}/unit/${targetUnitId}?compare=${compareParam}`
          : `/faction/${targetFactionId}/unit/${targetUnitId}`
        navigate(url)
      }
    }
  }

  // Custom format for unit options - show faction tag when in "All factions" mode
  const formatUnitOption = (option: UnitOptionWithFaction) => (
    <div className="flex items-center justify-between gap-2 w-full">
      <span className="truncate">{option.label}</span>
      {isAllFactionsSelected && (
        <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-600 text-gray-200 rounded flex-shrink-0">
          {option.factionName}
        </span>
      )}
    </div>
  )

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

        <div className={`w-full sm:w-auto ${isAllFactionsSelected ? 'sm:min-w-[280px]' : 'sm:min-w-[200px]'}`}>
          <Select<UnitOptionWithFaction>
            options={unitOptions}
            value={selectedUnit}
            onChange={handleUnitChange}
            styles={selectStyles}
            placeholder={isLoadingFaction ? "Loading..." : unitOptions.length ? "Select unit..." : "Loading units..."}
            isSearchable
            isLoading={isLoadingFaction}
            aria-label="Select unit"
            noOptionsMessage={() => unitOptions.length === 0 ? "Loading units..." : "No units found"}
            formatOptionLabel={formatUnitOption}
            menuPortalTarget={document.body}
            menuPosition="fixed"
          />
        </div>
      </div>
    </nav>
  )
}
