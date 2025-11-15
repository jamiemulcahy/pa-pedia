import { useParams, Link } from 'react-router-dom'
import { useFaction } from '@/hooks/useFaction'
import { getUnitIconPath } from '@/services/factionLoader'
import { useState } from 'react'

export function FactionDetail() {
  const { id } = useParams<{ id: string }>()
  const factionId = id || ''
  const { metadata, units, loading, error, exists, factionsLoading } = useFaction(factionId)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')

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

  // Get all unique unit types for filter
  const allTypes = Array.from(new Set(units.flatMap(u => u.unitTypes))).sort()

  // Filter units
  const filteredUnits = units.filter(unit => {
    const matchesSearch = unit.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = !typeFilter || unit.unitTypes.includes(typeFilter)
    return matchesSearch && matchesType
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link to="/" className="text-primary hover:underline mb-4 inline-block font-medium">&larr; Back to factions</Link>
        <h1 className="text-5xl font-display font-bold mb-2 tracking-wide">{metadata?.displayName}</h1>
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
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background font-medium"
        >
          <option value="">All Types</option>
          {allTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredUnits.map((unit) => (
          <Link
            key={unit.identifier}
            to={`/faction/${factionId}/unit/${unit.identifier}`}
            className="block border rounded-lg p-3 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 text-center"
          >
            <div className="aspect-square mb-2 flex items-center justify-center">
              <img
                src={getUnitIconPath(factionId, unit.identifier)}
                alt={unit.displayName}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
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
  )
}
