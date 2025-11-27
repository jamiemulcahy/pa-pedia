import { useParams, Link } from 'react-router-dom'
import { useFaction } from '@/hooks/useFaction'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { UnitCategorySection } from '@/components/UnitCategorySection'
import { UnitTable } from '@/components/UnitTable'
import { FactionSelector } from '@/components/FactionSelector'
import { useState, useCallback, useMemo } from 'react'
import { groupUnitsByCategory, CATEGORY_ORDER, type UnitCategory } from '@/utils/unitCategories'
import Select from 'react-select'
import { selectStyles, type SelectOption } from '@/components/selectStyles'

type ViewMode = 'grid' | 'table'

const VIEW_MODE_STORAGE_KEY = 'pa-pedia-view-mode'

function getStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    if (stored === 'table' || stored === 'grid') {
      return stored
    }
  } catch {
    // localStorage may not be available
  }
  return 'grid'
}

export function FactionDetail() {
  const { id } = useParams<{ id: string }>()
  const factionId = id || ''
  const { metadata, units, loading, error, exists, factionsLoading } = useFaction(factionId)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const [collapsedCategories, setCollapsedCategories] = useState<Set<UnitCategory>>(new Set())
  const [compactView, setCompactView] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode)

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
    } catch {
      // localStorage may not be available
    }
  }, [])

  const handleImageError = useCallback((unitId: string) => {
    setBrokenImages(prev => new Set(prev).add(unitId))
  }, [])

  const toggleCategory = useCallback((category: UnitCategory) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // Get all unique unit types for filter (memoized for performance)
  // Must be called before any early returns to satisfy Rules of Hooks
  const allTypes = useMemo(() =>
    Array.from(new Set(units.flatMap(u => u.unitTypes))).sort(),
    [units]
  )

  // Convert units to react-select options for search
  const unitSearchOptions = useMemo(() =>
    units.map(unit => ({
      value: unit.identifier,
      label: unit.displayName,
    })).sort((a, b) => a.label.localeCompare(b.label)),
    [units]
  )

  // Convert types to react-select options for filter
  const typeFilterOptions = useMemo(() =>
    allTypes.map(type => ({
      value: type,
      label: type,
    })),
    [allTypes]
  )

  // Filter units (memoized for performance with large unit lists)
  const filteredUnits = useMemo(() =>
    units.filter(unit => {
      const matchesSearch = unit.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = !typeFilter || unit.unitTypes.includes(typeFilter)
      return matchesSearch && matchesType
    }),
    [units, searchQuery, typeFilter]
  )

  // Group filtered units by category
  const groupedUnits = useMemo(
    () => groupUnitsByCategory(filteredUnits),
    [filteredUnits]
  )

  // Calculate which categories have units (for expand/collapse all logic)
  const categoriesWithUnits = useMemo(() =>
    CATEGORY_ORDER.filter(cat => (groupedUnits.get(cat)?.length ?? 0) > 0),
    [groupedUnits]
  )

  // Check if all categories with units are expanded or collapsed
  const allExpanded = useMemo(() =>
    categoriesWithUnits.length > 0 && categoriesWithUnits.every(cat => !collapsedCategories.has(cat)),
    [categoriesWithUnits, collapsedCategories]
  )

  const toggleAllCategories = useCallback(() => {
    if (allExpanded) {
      // Collapse all
      setCollapsedCategories(new Set(categoriesWithUnits))
    } else {
      // Expand all
      setCollapsedCategories(new Set())
    }
  }, [allExpanded, categoriesWithUnits])

  // Show loading while factions metadata is being loaded
  if (factionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-3xl font-display font-bold mb-2">LOADING...</div>
        </div>
      </div>
    )
  }

  // Only show "not found" after factions are loaded
  if (!exists) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-3xl font-display font-bold text-destructive mb-4">FACTION NOT FOUND</div>
          <Link to="/" className="text-primary hover:underline font-medium">Go back home</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-3xl font-display font-bold mb-2">LOADING UNITS...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-3xl font-display font-bold text-destructive mb-4">ERROR LOADING UNITS</div>
          <div className="text-muted-foreground font-mono">{error.message}</div>
        </div>
      </div>
    )
  }

  return (
    <CurrentFactionProvider factionId={factionId}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/" className="text-primary hover:underline mb-4 inline-block font-medium">&larr; Back to factions</Link>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-5xl font-display font-bold tracking-wide">{metadata?.displayName}</h1>
            {metadata?.isLocal && (
              <span className="px-2 py-1 text-sm font-semibold bg-blue-600 text-white rounded">
                LOCAL
              </span>
            )}
          </div>
          <p className="text-muted-foreground font-medium">{metadata?.description}</p>
          <div className="text-sm text-muted-foreground mt-2 font-mono">
            {units.length} units total
          </div>
        </div>

      <div className="mb-6 flex gap-4 flex-wrap items-center">
        <FactionSelector currentFactionId={factionId} />
        <div className="flex-[2] min-w-[200px]">
          <Select<SelectOption>
            options={unitSearchOptions}
            value={searchQuery ? unitSearchOptions.find(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase())) || null : null}
            onChange={(option) => setSearchQuery(option?.label || '')}
            onInputChange={(inputValue, { action }) => {
              if (action === 'input-change') {
                setSearchQuery(inputValue)
              }
            }}
            inputValue={searchQuery}
            styles={selectStyles}
            placeholder="Search units..."
            isClearable
            aria-label="Search units by name"
            noOptionsMessage={() => "No units found"}
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <Select<SelectOption>
            options={typeFilterOptions}
            value={typeFilter ? { value: typeFilter, label: typeFilter } : null}
            onChange={(option) => setTypeFilter(option?.value || '')}
            styles={selectStyles}
            placeholder="All Types"
            isClearable
            aria-label="Filter units by type"
          />
        </div>
        {/* View mode toggle - single button that toggles between grid and table */}
        <button
          type="button"
          onClick={() => handleViewModeChange(viewMode === 'grid' ? 'table' : 'grid')}
          className="p-2 border rounded-md bg-background hover:bg-muted transition-colors"
          aria-label={viewMode === 'grid' ? 'Switch to table view' : 'Switch to grid view'}
          title={viewMode === 'grid' ? 'Switch to table view' : 'Switch to grid view'}
        >
          {viewMode === 'grid' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          )}
        </button>
        {/* Compact view toggle - only visible in grid mode */}
        {viewMode === 'grid' && (
          <button
            type="button"
            onClick={() => setCompactView(!compactView)}
            className={`p-2 border rounded-md transition-colors ${
              compactView
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted'
            }`}
            aria-pressed={compactView}
            aria-label={compactView ? 'Switch to normal view' : 'Switch to compact view'}
            title={compactView ? 'Normal view' : 'Compact view'}
          >
            {compactView ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            )}
          </button>
        )}
        {/* Expand/collapse all - only visible in grid mode */}
        {viewMode === 'grid' && (
          <button
            type="button"
            onClick={toggleAllCategories}
            className="p-2 border rounded-md bg-background hover:bg-muted transition-colors"
            aria-label={allExpanded ? 'Collapse all categories' : 'Expand all categories'}
            title={allExpanded ? 'Collapse all categories' : 'Expand all categories'}
          >
            {allExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        )}
      </div>

      {viewMode === 'table' ? (
          <UnitTable
            units={filteredUnits}
            factionId={factionId}
            brokenImages={brokenImages}
            onImageError={handleImageError}
          />
        ) : filteredUnits.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No units match your filters
          </div>
        ) : (
          CATEGORY_ORDER.map((category) => (
            <UnitCategorySection
              key={category}
              category={category}
              units={groupedUnits.get(category) || []}
              isExpanded={!collapsedCategories.has(category)}
              onToggle={() => toggleCategory(category)}
              factionId={factionId}
              brokenImages={brokenImages}
              onImageError={handleImageError}
              compact={compactView}
            />
          ))
        )}
      </div>
    </CurrentFactionProvider>
  )
}
