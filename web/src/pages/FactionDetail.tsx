import { useParams, Link } from 'react-router-dom'
import { useFaction } from '@/hooks/useFaction'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { UnitCategorySection } from '@/components/UnitCategorySection'
import { useState, useCallback, useMemo } from 'react'
import { groupUnitsByCategory, CATEGORY_ORDER, type UnitCategory } from '@/utils/unitCategories'

export function FactionDetail() {
  const { id } = useParams<{ id: string }>()
  const factionId = id || ''
  const { metadata, units, loading, error, exists, factionsLoading } = useFaction(factionId)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const [collapsedCategories, setCollapsedCategories] = useState<Set<UnitCategory>>(new Set())

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

      <div className="mb-6 flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search units..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded-md flex-1 min-w-[200px] bg-background font-medium"
          aria-label="Search units by name"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background font-medium"
          aria-label="Filter units by type"
        >
          <option value="">All Types</option>
          {allTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {CATEGORY_ORDER.map((category) => (
          <UnitCategorySection
            key={category}
            category={category}
            units={groupedUnits.get(category) || []}
            isExpanded={!collapsedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
            factionId={factionId}
            brokenImages={brokenImages}
            onImageError={handleImageError}
          />
        ))}

        {filteredUnits.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No units match your filters
          </div>
        )}
      </div>
    </CurrentFactionProvider>
  )
}
