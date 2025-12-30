import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFactions } from '@/hooks/useFactions'
import { getFactionBackgroundPath, getLocalFactionBackgroundUrl } from '@/services/factionLoader'
import { SEO } from '@/components/SEO'
import { JsonLd } from '@/components/JsonLd'
import { WEBSITE_SCHEMA, PA_TITANS_GAME } from '@/components/seoSchemas'
import type { FactionWithFolder } from '@/types/faction'

interface FactionCardProps {
  faction: FactionWithFolder
  onDeleteClick: (factionId: string) => void
}

function FactionCard({ faction, onDeleteClick }: FactionCardProps) {
  const [localBackgroundUrl, setLocalBackgroundUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // For static factions, compute the URL directly (no need for state)
  const staticBackgroundUrl = !faction.isLocal && faction.backgroundImage
    ? getFactionBackgroundPath(faction.folderName, faction.backgroundImage)
    : null

  // For local factions, load from IndexedDB asynchronously
  useEffect(() => {
    if (!faction.isLocal || !faction.backgroundImage) {
      return
    }

    let isMounted = true

    getLocalFactionBackgroundUrl(faction.folderName, faction.backgroundImage)
      .then(url => {
        if (isMounted && url) {
          blobUrlRef.current = url
          setLocalBackgroundUrl(url)
        } else if (url) {
          // Component unmounted before we could use the URL, revoke it immediately
          URL.revokeObjectURL(url)
        }
      })
      .catch(err => {
        console.warn('Failed to load local faction background:', err)
      })

    return () => {
      isMounted = false
      // Revoke blob URL on cleanup
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [faction.folderName, faction.backgroundImage, faction.isLocal])

  // Use the appropriate URL based on faction type
  const rawBackgroundUrl = faction.isLocal ? localBackgroundUrl : staticBackgroundUrl

  // Sanitize URL to prevent XSS - only allow blob:, http:, https:, or relative paths
  const backgroundUrl = rawBackgroundUrl && (
    rawBackgroundUrl.startsWith('blob:') ||
    rawBackgroundUrl.startsWith('http://') ||
    rawBackgroundUrl.startsWith('https://') ||
    rawBackgroundUrl.startsWith('/')
  ) ? rawBackgroundUrl : null

  return (
    <div key={faction.folderName} className="relative group h-full">
      <Link
        to={`/faction/${faction.folderName}`}
        className="relative block h-full min-h-[280px] border rounded-lg hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 overflow-hidden"
      >
        {/* Background image layer */}
        {backgroundUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          />
        )}
        {/* Content layer */}
        <div className="relative z-10 p-8 h-full flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="text-4xl font-display font-bold tracking-wide">{faction.displayName}</div>
            <div className="flex gap-1.5">
              {faction.isAddon && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-600 text-white rounded">
                  ADDON
                </span>
              )}
              {faction.isLocal && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded">
                  LOCAL
                </span>
              )}
            </div>
          </div>
          {faction.isAddon && faction.baseFactions && faction.baseFactions.length > 0 && (
            <div className="text-sm text-amber-400 mb-2 font-medium">
              Extends: {faction.baseFactions.join(', ')}
            </div>
          )}
          <div className="text-base text-muted-foreground mb-4 font-medium flex-grow">{faction.description}</div>
          <div className="text-sm text-muted-foreground font-mono mt-auto">
            {faction.author && `By ${faction.author} • `}
            Version {faction.version}
          </div>
        </div>
      </Link>
      {faction.isLocal && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onDeleteClick(faction.folderName)
          }}
          className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20"
          title="Delete local faction"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  )
}

export function Home() {
  const { factions, loading, error, deleteFaction } = useFactions()
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
    <>
      <SEO
        canonicalPath="/"
        description="Browse unit databases for Planetary Annihilation: Titans factions. View detailed stats, weapons, build costs, and more for MLA, Legion, Bugs, Exiles, and custom factions."
      />
      <JsonLd schema={[WEBSITE_SCHEMA, PA_TITANS_GAME]} />
      <div className="container mx-auto px-4 py-8">
        {/* Community & Affiliate Links */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="flex gap-4 justify-center">
            <a
              href="https://ggleaderboards.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 p-3 sm:w-96 sm:px-6 sm:py-4 text-lg font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded-md transition-colors border animate-border-glow whitespace-nowrap relative overflow-hidden group"
            >
              <span className="absolute top-0 left-0 h-full w-[200%] animate-shimmer bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <img
                src="/gg-leaderboards.png"
                alt="GG Leaderboards"
                className="w-6 h-6 relative z-10"
              />
              <span className="relative z-10 hidden sm:inline">GG Leaderboards</span>
            </a>
            <a
              href="https://discord.gg/pa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 p-3 sm:w-96 sm:px-6 sm:py-4 text-lg font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded-md transition-colors border animate-border-glow-delay whitespace-nowrap relative overflow-hidden group"
            >
              <span className="absolute top-0 left-0 h-full w-[200%] animate-shimmer-delay bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <svg
                className="w-6 h-6 relative z-10"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span className="relative z-10 hidden sm:inline">PA Discord</span>
            </a>
          </div>
        </div>

        <div className="grid">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-6 max-w-7xl mx-auto">
          {factions.map((faction) => (
            <FactionCard
              key={faction.folderName}
              faction={faction}
              onDeleteClick={setDeleteConfirm}
            />
          ))}
          {/* All card - at end as secondary option */}
          <Link
            to="/faction"
            className="block h-full p-8 border rounded-lg hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 flex flex-col bg-muted/30 min-h-[280px]"
            aria-label="Browse all factions"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl font-display font-bold tracking-wide">All</div>
            </div>
            <div className="text-base text-muted-foreground mb-4 font-medium flex-grow">
              Browse units from all available factions in one view
            </div>
            <div className="text-sm text-muted-foreground font-mono mt-auto">
              {factions.length} factions available
            </div>
          </Link>
        </div>
      </div>

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
    </>
  )
}
