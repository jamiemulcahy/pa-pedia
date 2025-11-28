import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import type { StylesConfig } from 'react-select'
import { useFactions } from '@/hooks/useFactions'

interface FactionOption {
  value: string
  label: string
  isLocal: boolean
}

interface FactionSelectorProps {
  currentFactionId: string
  /** Base path for navigation (e.g., '/faction' navigates to '/faction/{id}') */
  basePath?: string
}

// Custom styles for react-select to match dark theme (same as BreadcrumbNav)
const selectStyles: StylesConfig<FactionOption, false> = {
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

/**
 * Dropdown selector for switching between factions.
 * Navigates to the selected faction's page when changed.
 * Uses react-select with proper styling and LOCAL badge for uploaded factions.
 */
export function FactionSelector({ currentFactionId, basePath = '/faction' }: FactionSelectorProps) {
  const navigate = useNavigate()
  const { factions, loading } = useFactions()

  // Convert factions to react-select options with "All Factions" at the top
  const factionOptions = useMemo(() => {
    const allOption: FactionOption = {
      value: '',
      label: 'All',
      isLocal: false,
    }
    const factionOpts = factions.map(faction => ({
      value: faction.folderName,
      label: faction.displayName,
      isLocal: faction.isLocal,
    }))
    return [allOption, ...factionOpts]
  }, [factions])

  // Find current selection
  const selectedFaction = factionOptions.find(opt => opt.value === currentFactionId) || null

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

  const handleFactionChange = (option: FactionOption | null) => {
    if (option && option.value !== currentFactionId) {
      // Empty value means "All Factions" - navigate to /faction without trailing slash
      navigate(option.value === '' ? basePath : `${basePath}/${option.value}`)
    }
  }

  return (
    <div className="min-w-[180px]">
      <Select<FactionOption>
        options={factionOptions}
        value={selectedFaction}
        onChange={handleFactionChange}
        styles={selectStyles}
        placeholder="Select faction..."
        isSearchable
        isLoading={loading}
        aria-label="Select faction"
        formatOptionLabel={formatFactionOption}
      />
    </div>
  )
}
