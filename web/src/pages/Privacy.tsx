import { Link } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { CLI_RELEASE } from '@/config/releases'

/**
 * Privacy policy.
 *
 * Exists to satisfy GDPR Art. 13 transparency rather than to gather consent:
 * the site sets no cookies, and everything it does store client-side is either
 * a preference the visitor chose or a cache of the data they asked to see, so
 * no consent banner is required. Keep it that way — anything that introduces a
 * cross-site identifier (ad tags, Sentry Session Replay, a hotlinked
 * third-party asset) changes that answer and needs this page revisited first.
 *
 * The storage keys below are load-bearing documentation: they must stay in
 * step with usePreferences.ts, teamColorPref.ts, staticFactionCache.ts,
 * modelLoader.ts and localFactionStorage.ts.
 */

const LAST_UPDATED = '1 August 2026'

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-xl sm:text-2xl font-display font-bold tracking-wide text-foreground mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  )
}

/** Inline reference to a browser storage key. */
function StorageKey({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-sm text-foreground bg-muted px-1.5 py-0.5 rounded">
      {children}
    </code>
  )
}

export function Privacy() {
  const githubUrl = `https://github.com/${CLI_RELEASE.githubRepo}`

  return (
    <>
      <SEO
        title="Privacy"
        description="How PA-Pedia handles your data: no cookies, no accounts, no advertising, and no cross-site tracking."
        canonicalPath="/privacy"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <nav className="mb-6 text-sm">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back to factions
            </Link>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-wider text-foreground mb-2">
            PRIVACY
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated {LAST_UPDATED}
          </p>

          <div className="border border-border rounded-lg p-5 mb-10 bg-card">
            <p className="text-foreground leading-relaxed">
              PA-Pedia is a free, open-source reference site for Planetary
              Annihilation: Titans. It does not use cookies, does not require an
              account, and carries no advertising or cross-site tracking.
            </p>
          </div>

          <Section title="Data stored on your device">
            <p>
              The site stores data locally in your browser in order to function.
              This data remains on your device: it is not transmitted to us, and
              we have no means of accessing it.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <StorageKey>pa-pedia-preferences</StorageKey> and{' '}
                <StorageKey>pa-pedia-team-colors</StorageKey> — display settings
                you have selected, such as list or table view, sort order, active
                filters and unit colours.
              </li>
              <li>
                <StorageKey>pa-pedia-static-factions</StorageKey> and{' '}
                <StorageKey>pa-pedia-model-cache</StorageKey> — cached faction
                data and 3D models you have already viewed, so that returning to
                a faction does not require downloading it again.
              </li>
              <li>
                <StorageKey>pa-pedia-local-factions</StorageKey> — faction
                folders you have uploaded yourself. These are held locally so
                that they persist between visits; they are not uploaded to us and
                are visible only to you.
              </li>
            </ul>
            <p>
              None of this is a cookie, and none of it is transmitted with your
              requests. You may remove all of it at any time by clearing site data
              for pa-pedia.com in your browser settings.
            </p>
          </Section>

          <Section title="Analytics">
            <p>
              We use Cloudflare Web Analytics to measure overall traffic: how
              many visits the site receives and which pages are viewed. It is
              cookieless. It sets no cookies, stores nothing on your device, and
              does not fingerprint your browser or construct a profile of you. It
              cannot track you across other sites, and the figures available to
              us are aggregate totals rather than individual visitors.
            </p>
          </Section>

          <Section title="Error reporting">
            <p>
              When an error occurs, a diagnostic report is sent to Sentry so that
              the fault can be identified and corrected. A report contains the
              error message, a technical stack trace, and the page on which the
              error occurred.
            </p>
            <p>
              Sentry is configured not to collect personal data. IP addresses are
              not retained, and session replay, which would record your activity
              on the page, is disabled. These reports are used solely to maintain
              the site, and not for advertising or analytics.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>
              No third-party fonts, scripts, embeds or images are loaded while you
              browse. Fonts are served from our own domain so that no external
              provider receives your IP address as a result of your visit. Faction
              data, unit icons and 3D models are likewise served from this domain.
            </p>
            <p>
              The site is hosted on Cloudflare Pages. As with any web host,
              Cloudflare processes your IP address and request data in order to
              deliver pages to you and to protect the site against abuse.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              We hold no account, profile or contact record relating to you, so
              there is no personal data for us to provide, export or erase on
              request. Data held on your device remains under your control and can
              be cleared through your browser at any time.
            </p>
            <p>
              If you have a question about this notice, or believe any part of it
              to be inaccurate, please open an issue on{' '}
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                the project&apos;s GitHub repository
              </a>
              .
            </p>
          </Section>

          <Section title="Changes to this notice">
            <p>
              We may change how the site operates, and this notice along with it,
              at any time and without prior notification. This notice describes
              the site as it currently operates.
            </p>
            <p>
              The date above indicates when it was last revised, and its full
              revision history is publicly available in the project&apos;s Git
              repository.
            </p>
          </Section>

          <Section title="Game data and attribution">
            <p>
              Planetary Annihilation: Titans is a game by Planetary Annihilation
              Inc. PA-Pedia is an unofficial, community-run project and is not
              affiliated with or endorsed by them. Unit data and artwork remain
              the property of their respective owners, including the authors of
              the community mods featured here.
            </p>
          </Section>
        </div>
      </div>
    </>
  )
}
