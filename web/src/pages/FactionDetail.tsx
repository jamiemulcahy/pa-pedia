import { useParams, Link } from 'react-router-dom'
import { useFaction } from '@/hooks/useFaction'
import { UnitIcon } from '@/components/UnitIcon'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { useState, useCallback, useMemo } from 'react'

export function FactionDetail() {
  const { id } = useParams<{ id: string }>()
  const factionId = id || ''
  const { metadata, units, loading, error, exists, factionsLoading } = useFaction(factionId)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())

  const handleImageError = useCallback((unitId: string) => {
    setBrokenImages(prev => new Set(prev).add(unitId))
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" role="list">
        {filteredUnits.map((unit) => (
          <Link
            key={unit.identifier}
            to={`/faction/${factionId}/unit/${unit.identifier}`}
            className="block border rounded-lg p-3 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 text-center"
            role="listitem"
            aria-label={`View ${unit.displayName} details`}
          >
            <div className="aspect-square mb-2 flex items-center justify-center">
              {brokenImages.has(unit.identifier) ? (
                <div
                  className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs font-mono"
                  aria-label={`${unit.displayName} icon not available`}
                >
                  No Icon
                </div>
              ) : (
                <UnitIcon
                  imagePath={unit.unit.image}
                  alt={`${unit.displayName} icon`}
                  className="max-w-full max-h-full object-contain"
                  onError={() => handleImageError(unit.identifier)}
                />
              )}
            </div>
            <div className="text-sm font-semibold truncate">{unit.displayName}</div>
            <div className="text-xs text-muted-foreground flex gap-1 flex-wrap justify-center mt-1">
              {unit.unitTypes.slice(0, 2).map(type => (
                <span key={type} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                  {type}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

        {filteredUnits.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No units match your filters
          </div>
        )}
      </div>
    </CurrentFactionProvider>
  )
}
