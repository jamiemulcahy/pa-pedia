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
              Annihilation: Titans. There are no accounts, no cookies, no
              advertising, and no tracking across other websites. You can browse
              the whole site without giving us anything.
            </p>
          </div>

          <Section title="What is stored in your browser">
            <p>
              The site keeps some data on your own device so it loads quickly and
              remembers how you like it. This stays in your browser — it is not
              uploaded to us and we cannot read it.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <StorageKey>pa-pedia-preferences</StorageKey> and{' '}
                <StorageKey>pa-pedia-team-colors</StorageKey> — display settings
                you have chosen, such as list or table view, sort order, filters
                and unit colours.
              </li>
              <li>
                <StorageKey>pa-pedia-static-factions</StorageKey> and{' '}
                <StorageKey>pa-pedia-model-cache</StorageKey> — a cache of the
                faction data and 3D models you have viewed, so revisiting a
                faction does not download it again.
              </li>
              <li>
                <StorageKey>pa-pedia-local-factions</StorageKey> — any faction
                folder you upload yourself. Uploaded factions never leave your
                device; they are stored locally so they survive a page reload,
                and they are visible only to you.
              </li>
            </ul>
            <p>
              You can delete all of it at any time by clearing site data for
              pa-pedia.com in your browser settings. Nothing here identifies you,
              and none of it is a cookie — no part of it is sent to us or to
              anyone else when you make a request.
            </p>
          </Section>

          <Section title="Analytics">
            <p>
              We use Cloudflare Web Analytics to see roughly how many people
              visit and which pages are popular. It is cookieless by design: it
              sets no cookies, stores nothing on your device, and does not
              fingerprint your browser or build a profile of you. It cannot
              follow you to other sites, and we only ever see aggregate counts —
              never individual visitors.
            </p>
          </Section>

          <Section title="Error reporting">
            <p>
              When something on the site breaks, a report is sent to Sentry so we
              can fix it. A report contains the error message, the technical stack
              trace, and which page it happened on.
            </p>
            <p>
              Sentry is configured not to collect personally identifying
              information: IP addresses are not retained, and session replay —
              which would record what you did on the page — is deliberately
              switched off. We rely on this to keep the site working, and it is
              not used for advertising or analytics.
            </p>
          </Section>

          <Section title="Third parties">
            <p>
              The site loads no third-party fonts, scripts, embeds, or images
              while you browse. Fonts are served from our own domain
              specifically so that no outside company receives your IP address
              just because you opened a page.
            </p>
            <p>
              The site is hosted on Cloudflare Pages. Like any web host,
              Cloudflare processes your IP address and request in order to
              deliver the page to you and to protect the site from abuse.
              Faction data, unit icons and 3D models are all served from this
              same domain.
            </p>
          </Section>

          <Section title="Your data rights">
            <p>
              We hold no account, profile or contact record for you, so there is
              nothing personal for us to look up, export or delete. The data on
              your own device is under your control and can be cleared from your
              browser settings at any time.
            </p>
            <p>
              If you have a question about any of this, or believe something on
              this page is inaccurate, please open an issue on{' '}
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

          <Section title="Changes to this page">
            <p>
              If we ever add something that collects more than the above, this
              page will be updated before that change goes live. The full history
              of this page is public in the project&apos;s git repository.
            </p>
          </Section>

          <Section title="About the game data">
            <p>
              Planetary Annihilation: Titans is a game by Planetary Annihilation
              Inc. PA-Pedia is an unofficial, community-run project and is not
              affiliated with or endorsed by them. Unit data and artwork belong
              to their respective owners, including the authors of the community
              mods featured here.
            </p>
          </Section>
        </div>
      </div>
    </>
  )
}
