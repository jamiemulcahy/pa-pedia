import { useParams, Link } from 'react-router-dom'
import { useFaction } from '@/hooks/useFaction'
import { useAllFactions, type UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { SortableCategorySection } from '@/components/SortableCategorySection'
import { CategoryDragOverlay } from '@/components/CategoryDragOverlay'
import { UnitTable } from '@/components/UnitTable'
import { UnitListView } from '@/components/UnitListView'
import { UnitIcon } from '@/components/UnitIcon'
import { FactionSelector } from '@/components/FactionSelector'
import { SEO } from '@/components/SEO'
import { JsonLd } from '@/components/JsonLd'
import { createWebPageSchema } from '@/components/seoSchemas'
import { useState, useCallback, useMemo } from 'react'
import { groupUnitsByCategory, type UnitCategory } from '@/utils/unitCategories'
import { groupCommanderVariants } from '@/utils/commanderDedup'
import { usePreferences } from '@/hooks/usePreferences'
import { useCategoryOrder } from '@/hooks/useCategoryOrder'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import Select from 'react-select'
import { selectStyles, multiSelectStyles, type SelectOption } from '@/components/selectStyles'
import type { UnitIndexEntry } from '@/types/faction'

interface UnitSearchOption extends SelectOption {
  imagePath?: string
  factionId: string
}

const VIEW_MODES = ['grid', 'table', 'list'] as const

export function FactionDetail() {
  const { id } = useParams<{ id: string }>()
  const factionId = id || ''
  const isAllMode = factionId === ''

  // Use appropriate hook based on mode
  const singleFaction = useFaction(isAllMode ? '__skip__' : factionId)
  const allFactions = useAllFactions()

  // Unified data based on mode
  const metadata = isAllMode ? null : singleFaction.metadata
  const units: (UnitIndexEntry | UnitIndexEntryWithFaction)[] = isAllMode ? allFactions.units : singleFaction.units
  const loading = isAllMode ? allFactions.loading : singleFaction.loading
  const error = isAllMode ? allFactions.error : singleFaction.error
  const exists = isAllMode ? true : singleFaction.exists
  const factionsLoading = isAllMode ? allFactions.factionsLoading : singleFaction.factionsLoading

  // Unified preferences with localStorage persistence
  const { preferences, updatePreference } = usePreferences()
  const { viewMode, compactView, showInaccessible, collapsedCategories: savedCollapsedCategories } = preferences

  // Category ordering with drag-and-drop support
  const { orderedCategories, isCustomOrder, reorder, resetToDefault } = useCategoryOrder()

  // Local state (not persisted)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<UnitCategory | null>(null)
  const [dragAnnouncement, setDragAnnouncement] = useState('')

  // Convert saved collapsed categories array to Set for efficient lookups
  const collapsedCategories = useMemo(
    () => new Set(savedCollapsedCategories),
    [savedCollapsedCategories]
  )

  const cycleViewMode = useCallback(() => {
    const currentIndex = VIEW_MODES.indexOf(viewMode)
    const nextIndex = (currentIndex + 1) % VIEW_MODES.length
    updatePreference('viewMode', VIEW_MODES[nextIndex])
  }, [viewMode, updatePreference])

  const handleImageError = useCallback((unitId: string) => {
    setBrokenImages(prev => new Set(prev).add(unitId))
  }, [])

  const toggleCategory = useCallback((category: UnitCategory) => {
    const current = new Set(savedCollapsedCategories)
    if (current.has(category)) {
      current.delete(category)
    } else {
      current.add(category)
    }
    updatePreference('collapsedCategories', Array.from(current))
  }, [savedCollapsedCategories, updatePreference])


  // Get all unique unit types for filter (memoized for performance)
  // Must be called before any early returns to satisfy Rules of Hooks
  const allTypes = useMemo(() =>
    Array.from(new Set(units.flatMap(u => u.unitTypes))).sort(),
    [units]
  )

  // Count unique factions (only in All mode, for display)
  const factionCount = useMemo(() => {
    if (!isAllMode) return 0
    const factionSet = new Set<string>()
    for (const unit of units as UnitIndexEntryWithFaction[]) {
      factionSet.add(unit.factionId)
    }
    return factionSet.size
  }, [isAllMode, units])

  // Convert units to react-select options for search
  const unitSearchOptions = useMemo((): UnitSearchOption[] =>
    units.map(unit => ({
      value: unit.identifier,
      label: unit.displayName,
      imagePath: unit.unit.image,
      // In "All" mode units have factionId, in single mode use the current factionId
      factionId: 'factionId' in unit ? unit.factionId : factionId,
    })).sort((a, b) => a.label.localeCompare(b.label)),
    [units, factionId]
  )

  // Custom format for unit search options - show icon
  const formatUnitSearchOption = (option: UnitSearchOption) => (
    <div className="flex items-center gap-2 w-full">
      <UnitIcon
        imagePath={option.imagePath}
        alt={option.label}
        factionId={option.factionId}
        className="w-5 h-5 flex-shrink-0"
      />
      <span className="truncate">{option.label}</span>
    </div>
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
      // Multi-select: show units matching ANY selected type (OR logic)
      const matchesType = typeFilters.length === 0 || typeFilters.some(type => unit.unitTypes.includes(type))
      const matchesAccessible = showInaccessible || unit.unit.accessible
      return matchesSearch && matchesType && matchesAccessible
    }),
    [units, searchQuery, typeFilters, showInaccessible]
  )

  // Count inaccessible units for the toggle button badge
  const inaccessibleCount = useMemo(() =>
    units.filter(unit => !unit.unit.accessible).length,
    [units]
  )

  // Group commanders by stats to detect duplicates (always enabled)
  const commanderGrouping = useMemo(
    () => groupCommanderVariants(filteredUnits),
    [filteredUnits]
  )

  // Group filtered units by category
  const groupedUnits = useMemo(
    () => groupUnitsByCategory(filteredUnits),
    [filteredUnits]
  )

  // Calculate which categories have units (for expand/collapse all logic)
  const categoriesWithUnits = useMemo(() =>
    orderedCategories.filter(cat => (groupedUnits.get(cat)?.length ?? 0) > 0),
    [groupedUnits, orderedCategories]
  )

  // Check if all categories with units are expanded or collapsed
  const allExpanded = useMemo(() =>
    categoriesWithUnits.length > 0 && categoriesWithUnits.every(cat => !collapsedCategories.has(cat)),
    [categoriesWithUnits, collapsedCategories]
  )

  const toggleAllCategories = useCallback(() => {
    if (allExpanded) {
      // Collapse all
      updatePreference('collapsedCategories', categoriesWithUnits)
    } else {
      // Expand all
      updatePreference('collapsedCategories', [])
    }
  }, [allExpanded, categoriesWithUnits, updatePreference])


  // Drag-and-drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveCategory(event.active.id as UnitCategory)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveCategory(null)

    if (over && active.id !== over.id) {
      reorder(active.id as string, over.id as string)
      setDragAnnouncement(`${active.id} category moved`)
    }
  }, [reorder])

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
          {isAllMode && allFactions.totalCount > 0 && (
            <div className="text-muted-foreground font-mono">
              {allFactions.loadedCount} / {allFactions.totalCount} factions
            </div>
          )}
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

  // Helper to get faction ID for a unit (handles both modes)
  const getUnitFactionId = (unit: UnitIndexEntry | UnitIndexEntryWithFaction): string => {
    return isAllMode ? (unit as UnitIndexEntryWithFaction).factionId : factionId
  }

  // SEO data based on mode
  const seoTitle = isAllMode ? 'All Factions' : metadata?.displayName
  const seoDescription = isAllMode
    ? `Browse all units from every Planetary Annihilation: Titans faction. Compare stats, weapons, and build costs across ${factionCount} factions.`
    : metadata
      ? `${metadata.displayName} faction unit database for Planetary Annihilation: Titans. Browse ${filteredUnits.length} units with detailed stats, weapons, and build information.`
      : undefined
  const seoPath = `/faction${id ? `/${id}` : ''}`

  // Content wrapped conditionally - only use CurrentFactionProvider for single faction mode
  const content = (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonicalPath={seoPath}
      />
      {seoDescription && (
        <JsonLd schema={createWebPageSchema(seoTitle || 'Faction Units', seoPath, seoDescription)} />
      )}
      <div className="container mx-auto px-4 py-8">
      {/* Screen reader announcement for drag-and-drop operations */}
      <div role="status" aria-live="polite" className="sr-only">
        {dragAnnouncement}
      </div>
      <div className="mb-8">
        <Link to="/" className="text-primary hover:underline mb-4 inline-block font-medium">&larr; Back to factions</Link>
        <div className="text-left md:text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <h1 className="text-5xl font-display font-bold tracking-wide">
              {isAllMode ? 'All' : metadata?.displayName}
            </h1>
            <div className="flex gap-1.5">
              {!isAllMode && metadata?.isAddon && (
                <span className="px-2 py-1 text-sm font-semibold bg-amber-600 text-white rounded">
                  ADDON
                </span>
              )}
              {!isAllMode && metadata?.isLocal && (
                <span className="px-2 py-1 text-sm font-semibold bg-blue-600 text-white rounded">
                  LOCAL
                </span>
              )}
            </div>
          </div>
          {!isAllMode && metadata?.isAddon && metadata.baseFactions && metadata.baseFactions.length > 0 && (
            <p className="text-sm text-amber-400 font-medium mb-1">
              Extends: {metadata.baseFactions.join(', ')}
            </p>
          )}
          <p className="text-muted-foreground font-medium">
            {isAllMode ? 'Browse units from all available factions' : metadata?.description}
          </p>
          <div className="text-sm text-muted-foreground mt-2 font-mono">
            {filteredUnits.length} units{inaccessibleCount > 0 && !showInaccessible && ` (${inaccessibleCount} hidden)`}
            {isAllMode && factionCount > 0 && ` from ${factionCount} factions`}
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:gap-4 sm:flex-wrap sm:items-center">
        {/* Row 1 on mobile: Faction selector (full width) */}
        <div className="w-full sm:w-auto sm:flex-none">
          <FactionSelector currentFactionId={factionId} />
        </div>
        {/* Row 2 on mobile: Search (full width) */}
        <div className="w-full sm:w-auto sm:flex-[2] sm:min-w-[200px]">
          <Select<UnitSearchOption>
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
            formatOptionLabel={formatUnitSearchOption}
          />
        </div>
        {/* Row 3 on mobile: Type filter (full width) */}
        <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px]">
          <Select<SelectOption, true>
            options={typeFilterOptions}
            value={typeFilters.map(type => ({ value: type, label: type }))}
            onChange={(options) => setTypeFilters(options ? options.map(opt => opt.value) : [])}
            styles={multiSelectStyles}
            placeholder="All Types"
            isMulti
            isClearable
            aria-label="Filter units by type"
            closeMenuOnSelect={false}
          />
        </div>
        {/* Row 4 on mobile: All toggle buttons in one row, right-aligned on mobile */}
        {/* Button order: grid-only buttons first, then persistent buttons last (so they don't shift when grid buttons disappear) */}
        <div className="flex gap-2 items-center justify-end sm:justify-start">
          {/* Compact view toggle - only visible in grid mode */}
          {viewMode === 'grid' && (
            <button
              type="button"
              onClick={() => updatePreference('compactView', !compactView)}
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
          {/* Reset category order - visible in grid/list mode when custom order is active */}
          {(viewMode === 'grid' || viewMode === 'list') && isCustomOrder && (
            <button
              type="button"
              onClick={resetToDefault}
              className="p-2 border rounded-md bg-background hover:bg-muted transition-colors"
              aria-label="Reset category order to default"
              title="Reset category order"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {/* Show inaccessible units toggle - only visible if there are inaccessible units */}
          {inaccessibleCount > 0 && (
            <button
              type="button"
              onClick={() => updatePreference('showInaccessible', !showInaccessible)}
              className={`p-2 border rounded-md transition-colors ${
                showInaccessible
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted'
              }`}
              aria-pressed={showInaccessible}
              aria-label={showInaccessible ? 'Hide inaccessible units' : `Show ${inaccessibleCount} inaccessible units`}
              title={showInaccessible ? 'Hide inaccessible units' : `Show ${inaccessibleCount} inaccessible units`}
            >
              {showInaccessible ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          )}
          {/* View mode toggle - cycles: grid -> table -> list -> grid */}
          {/* Shows icon for NEXT mode (what clicking will switch to) */}
          <button
            type="button"
            onClick={cycleViewMode}
            className="p-2 border rounded-md bg-background hover:bg-muted transition-colors"
            aria-label={`Switch to ${VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length]} view`}
            title={`Switch to ${VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length]} view`}
          >
            {/* Grid view -> show table icon (next mode) */}
            {viewMode === 'grid' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {/* Table with header row and columns */}
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9h18M9 9v12M15 9v12" />
              </svg>
            )}
            {/* Table view -> show list icon (next mode) */}
            {viewMode === 'table' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13" />
                <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            )}
            {/* List view -> show grid icon (next mode) */}
            {viewMode === 'list' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
          <UnitTable
            units={filteredUnits}
            factionId={factionId}
            brokenImages={brokenImages}
            onImageError={handleImageError}
            showFactionColumn={isAllMode}
            getUnitFactionId={isAllMode ? getUnitFactionId : undefined}
            commanderGrouping={commanderGrouping}
          />
        ) : filteredUnits.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No units match your filters
          </div>
        ) : (
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {viewMode === 'list' ? (
              <UnitListView
                groupedUnits={groupedUnits}
                orderedCategories={orderedCategories}
                factionId={factionId}
                brokenImages={brokenImages}
                onImageError={handleImageError}
                showFactionBadge={isAllMode}
                getUnitFactionId={isAllMode ? getUnitFactionId : undefined}
                commanderGrouping={commanderGrouping}
              />
            ) : (
              <SortableContext
                items={categoriesWithUnits}
                strategy={verticalListSortingStrategy}
              >
                {orderedCategories.map((category) => (
                  <SortableCategorySection
                    key={category}
                    category={category}
                    units={groupedUnits.get(category) || []}
                    isExpanded={!collapsedCategories.has(category)}
                    onToggle={() => toggleCategory(category)}
                    factionId={factionId}
                    brokenImages={brokenImages}
                    onImageError={handleImageError}
                    compact={compactView}
                    showFactionBadge={isAllMode}
                    getUnitFactionId={isAllMode ? getUnitFactionId : undefined}
                    commanderGroups={category === 'Commanders' ? commanderGrouping.commanders : undefined}
                  />
                ))}
              </SortableContext>
            )}
            <DragOverlay>
              {activeCategory && (
                <CategoryDragOverlay
                  category={activeCategory}
                  unitCount={groupedUnits.get(activeCategory)?.length ?? 0}
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </>
  )

  // Wrap with CurrentFactionProvider only for single faction mode
  if (isAllMode) {
    return content
  }

  return (
    <CurrentFactionProvider factionId={factionId}>
      {content}
    </CurrentFactionProvider>
  )
}
