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
    <footer className="mt-16 border-t border-border bg-card/40">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-5">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Unofficial community project. Not affiliated with Planetary
            Annihilation Inc.
          </p>
          {/* Links carry full foreground contrast rather than the muted grey
              used for the disclaimer: a privacy notice nobody can pick out of
              the page is not meaningfully reachable. */}
          <nav className="flex items-center gap-2 font-display text-sm tracking-wide">
            <Link
              to="/privacy"
              className="px-3 py-2 rounded-lg text-foreground hover:bg-muted hover:text-primary transition-colors"
            >
              Privacy
            </Link>
            <span aria-hidden="true" className="text-border">
              |
            </span>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg text-foreground hover:bg-muted hover:text-primary transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
