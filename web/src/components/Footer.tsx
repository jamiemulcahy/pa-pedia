import { Link } from 'react-router-dom'
import { CLI_RELEASE } from '@/config/releases'

/**
 * Site footer.
 *
 * Primarily the home for the privacy link — GDPR Art. 13 expects the notice to
 * be reachable from anywhere on the site, and the header is already full.
 */
export function Footer() {
  const githubUrl = `https://github.com/${CLI_RELEASE.githubRepo}`

  return (
    <footer className="mt-16 border-t border-border">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            Unofficial community project. Not affiliated with Planetary
            Annihilation Inc.
          </p>
          <nav className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
