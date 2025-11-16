import { Link } from 'react-router-dom'
import { useFactions } from '@/hooks/useFactions'

export function Home() {
  const { factions, loading, error } = useFactions()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-3xl font-display font-bold mb-2">LOADING FACTIONS...</div>
          <div className="text-muted-foreground font-medium">Please wait</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-3xl font-display font-bold text-destructive mb-4">ERROR LOADING FACTIONS</div>
          <div className="text-muted-foreground font-mono">{error.message}</div>
        </div>
      </div>
    )
  }

  if (factions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-2xl px-4">
          <div className="text-6xl font-display font-bold mb-4 tracking-wider">PA-PEDIA</div>
          <div className="text-xl text-muted-foreground mb-6">No factions available</div>
          <div className="text-sm text-muted-foreground font-mono bg-muted/50 p-4 rounded-lg border border-border">
            <div className="mb-2 font-bold">To generate faction data:</div>
            <div className="text-left">
              <div className="mb-1">1. Use the CLI tool to extract faction data:</div>
              <div className="ml-4 mb-3 text-muted-foreground/80">
                <code>pa-pedia extract --faction MLA --output ./web/public/factions/MLA</code>
              </div>
              <div className="mb-1">2. Refresh this page</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-display font-bold mb-4 tracking-wider">PA-PEDIA</h1>
        <p className="text-xl text-muted-foreground font-medium">
          Browse Planetary Annihilation Titans faction data
        </p>
      </div>

      <div className="grid">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {factions.map((faction) => (
            <Link
              key={faction.folderName}
              to={`/faction/${faction.folderName}`}
              className="block p-6 border rounded-lg hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20"
            >
              <div className="text-3xl font-display font-bold mb-2 tracking-wide">{faction.displayName}</div>
              <div className="text-sm text-muted-foreground mb-2 font-medium">{faction.description}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {faction.author && `By ${faction.author} • `}
                Version {faction.version}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
