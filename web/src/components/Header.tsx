import { Link } from 'react-router-dom'
import { CLI_RELEASE } from '@/config/releases'

interface HeaderProps {
  onUploadClick: () => void
  onDownloadClick: () => void
  isFestiveMode: boolean
  onToggleFestiveMode: () => void
}

export function Header({ onUploadClick, onDownloadClick, isFestiveMode, onToggleFestiveMode }: HeaderProps) {
  const githubUrl = `https://github.com/${CLI_RELEASE.githubRepo}`

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="relative flex items-center justify-between sm:justify-center h-16 px-4">
        {/* Center - Title and subtitle */}
        <Link
          to="/"
          className="flex flex-col items-start sm:items-center hover:opacity-80 transition-opacity min-w-0 flex-shrink relative"
        >
          <span className="text-xl sm:text-2xl font-display font-bold tracking-wider text-foreground relative">
            {isFestiveMode && (
              <span className="absolute -top-3 -right-4 text-2xl transform -rotate-12" title="Happy Holidays!">
                🎅
              </span>
            )}
            PA-PEDIA
          </span>
          <span className="text-xs text-muted-foreground font-medium hidden sm:block">
            Browse Planetary Annihilation Titans faction data
            {isFestiveMode && ' 🎄'}
          </span>
        </Link>

        {/* Right - Actions */}
        <div className="flex items-center gap-1 sm:absolute sm:right-4 sm:w-32 justify-end">
          <button
            onClick={onToggleFestiveMode}
            className={`p-2 rounded-lg transition-colors ${
              isFestiveMode
                ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={isFestiveMode ? 'Disable festive mode' : 'Enable festive mode'}
            aria-label={isFestiveMode ? 'Disable festive mode' : 'Enable festive mode'}
          >
            <span className="text-xl">{isFestiveMode ? '🎅' : '☃️'}</span>
          </button>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="View on GitHub"
            aria-label="View on GitHub"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          <button
            onClick={onDownloadClick}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Download CLI tool"
            aria-label="Download CLI tool"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
          <button
            onClick={onUploadClick}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Upload local faction"
            aria-label="Upload local faction"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
