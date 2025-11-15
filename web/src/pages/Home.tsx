import { Link } from 'react-router-dom'
import { useFactions } from '@/hooks/useFactions'

export function Home() {
  const { factions, loading, error } = useFactions()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2">Loading factions...</div>
          <div className="text-muted-foreground">Please wait</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl font-semibold text-destructive mb-2">Error loading factions</div>
          <div className="text-muted-foreground">{error.message}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">PA-Pedia</h1>
        <p className="text-xl text-muted-foreground">
          Browse Planetary Annihilation Titans faction data
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {factions.map((faction) => (
          <Link
            key={faction.identifier}
            to={`/faction/${faction.identifier}`}
            className="block p-6 border rounded-lg hover:border-primary transition-colors"
          >
            <div className="text-2xl font-bold mb-2">{faction.displayName}</div>
            <div className="text-sm text-muted-foreground mb-2">{faction.description}</div>
            <div className="text-xs text-muted-foreground">
              {faction.author && `By ${faction.author} • `}
              Version {faction.version}
            </div>
          </Link>
        ))}
      </div>

      {factions.length === 0 && (
        <div className="text-center text-muted-foreground">
          No factions found
        </div>
      )}
    </div>
  )
}
