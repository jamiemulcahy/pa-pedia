import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import type { StylesConfig } from 'react-select'
import { useFactionContext } from '@/contexts/FactionContext'

interface SelectOption {
  value: string
  label: string
}

interface FactionOption extends SelectOption {
  isLocal: boolean
}

interface BreadcrumbNavProps {
  factionId: string
  unitId?: string
  /** Optional callback for custom navigation (used in comparison mode) */
  onUnitChange?: (factionId: string, unitId: string) => void
}

// Custom styles for react-select to match dark theme
const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'rgb(31, 41, 55)', // gray-800
    borderColor: state.isFocused ? 'rgb(59, 130, 246)' : 'rgb(75, 85, 99)', // blue-500 : gray-600
    borderRadius: '0.375rem',
    minHeight: '38px',
    boxShadow: state.isFocused ? '0 0 0 1px rgb(59, 130, 246)' : 'none',
    '&:hover': {
      borderColor: 'rgb(107, 114, 128)', // gray-500
    },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'rgb(31, 41, 55)', // gray-800
    border: '1px solid rgb(75, 85, 99)', // gray-600
    borderRadius: '0.375rem',
    zIndex: 50,
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'rgb(59, 130, 246)' // blue-500
      : state.isFocused
      ? 'rgb(55, 65, 81)' // gray-700
      : 'transparent',
    color: 'rgb(243, 244, 246)', // gray-100
    cursor: 'pointer',
    borderRadius: '0.25rem',
    '&:active': {
      backgroundColor: 'rgb(37, 99, 235)', // blue-600
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'rgb(243, 244, 246)', // gray-100
  }),
  input: (base) => ({
    ...base,
    color: 'rgb(243, 244, 246)', // gray-100
  }),
  placeholder: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: 'rgb(75, 85, 99)', // gray-600
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
    '&:hover': {
      color: 'rgb(209, 213, 219)', // gray-300
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
    '&:hover': {
      color: 'rgb(209, 213, 219)', // gray-300
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
  }),
}

export function BreadcrumbNav({ factionId, unitId, onUnitChange }: BreadcrumbNavProps) {
  const navigate = useNavigate()
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
        navigate(`/faction/${selectedFactionId}/unit/${option.value}`)
      }
    }
  }

  return (
    <nav aria-label="Unit navigation">
      <div className="inline-flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 flex-wrap sm:flex-nowrap">
        <div className="w-full sm:w-auto sm:min-w-[180px]">
          <Select<FactionOption>
            options={factionOptions}
            value={selectedFaction}
            onChange={handleFactionChange}
            styles={selectStyles as unknown as StylesConfig<FactionOption, false>}
            placeholder="Select faction..."
            isSearchable
            aria-label="Select faction"
            formatOptionLabel={formatFactionOption}
          />
        </div>

        <span className="text-gray-400 dark:text-gray-500 text-lg hidden sm:inline">&rarr;</span>

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
          />
        </div>
      </div>
    </nav>
  )
}
