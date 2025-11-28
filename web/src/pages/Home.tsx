import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFactions } from '@/hooks/useFactions'
import { FactionUpload } from '@/components/FactionUpload'

export function Home() {
  const { factions, loading, error, deleteFaction } = useFactions()
  const [showUpload, setShowUpload] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (factionId: string) => {
    setIsDeleting(true)
    try {
      await deleteFaction(factionId)
    } catch (err) {
      console.error('Failed to delete faction:', err)
    } finally {
      setIsDeleting(false)
      setDeleteConfirm(null)
    }
  }

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
        <p className="text-xl text-muted-foreground font-medium mb-6">
          Browse Planetary Annihilation Titans faction data
        </p>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Faction
        </button>
      </div>

      <div className="grid">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* All card */}
          <Link
            to="/faction"
            className="block h-full p-6 border rounded-lg hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 flex flex-col bg-muted/30"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="text-3xl font-display font-bold tracking-wide">All</div>
            </div>
            <div className="text-sm text-muted-foreground mb-2 font-medium flex-grow">
              Browse units from all available factions in one view
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-auto">
              {factions.length} factions available
            </div>
          </Link>
          {factions.map((faction) => (
            <div key={faction.folderName} className="relative group h-full">
              <Link
                to={`/faction/${faction.folderName}`}
                className="block h-full p-6 border rounded-lg hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 flex flex-col"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-3xl font-display font-bold tracking-wide">{faction.displayName}</div>
                  {faction.isLocal && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded">
                      LOCAL
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mb-2 font-medium flex-grow">{faction.description}</div>
                <div className="text-xs text-muted-foreground font-mono mt-auto">
                  {faction.author && `By ${faction.author} • `}
                  Version {faction.version}
                </div>
              </Link>
              {faction.isLocal && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setDeleteConfirm(faction.folderName)
                  }}
                  className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete local faction"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showUpload && (
        <FactionUpload
          onClose={() => setShowUpload(false)}
        />
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 id="delete-dialog-title" className="text-xl font-semibold text-white mb-4">Delete Local Faction</h2>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete the local faction "{deleteConfirm}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
