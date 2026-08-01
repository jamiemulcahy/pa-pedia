import { Link } from 'react-router-dom'

/**
 * Site footer.
 *
 * Exists for the privacy link — GDPR Art. 13 expects the notice to be reachable
 * from anywhere on the site, and the header is already full. Deliberately not a
 * general nav: GitHub and the CLI download live in the header, and repeating
 * them here would only dilute the one link this footer is for.
 */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-card/40">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-5">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Unofficial community project. Not affiliated with Planetary
            Annihilation Inc.
          </p>
          {/* Full foreground contrast rather than the muted grey used for the
              disclaimer: a privacy notice nobody can pick out of the page is
              not meaningfully reachable. */}
          <nav className="font-display text-sm tracking-wide">
            <Link
              to="/privacy"
              className="px-3 py-2 rounded-lg text-foreground hover:bg-muted hover:text-primary transition-colors"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
