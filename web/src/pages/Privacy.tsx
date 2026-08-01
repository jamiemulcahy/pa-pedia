import { Link } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { CLI_RELEASE } from '@/config/releases'

/**
 * Privacy notice.
 *
 * Exists to satisfy GDPR Art. 13 transparency rather than to gather consent:
 * the site sets no cookies, and everything it does store client-side is either
 * a preference the visitor chose or a cache of the data they asked to see, so
 * no consent banner is required. Keep it that way — anything that introduces a
 * cross-site identifier (ad tags, Sentry Session Replay, a hotlinked
 * third-party asset) changes that answer and needs this page revisited first.
 *
 * Scope is deliberately narrow: what visitor data is processed and who receives
 * it. It is not documentation of how the site works, so individual storage keys
 * and service configuration stay out. The one detail that cannot be dropped is
 * the list of recipients — Art. 13(1)(e) requires them, hence Cloudflare and
 * Sentry being named. Adding a new processor means adding it here.
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
              The site uses your browser&apos;s local storage to hold your display
              preferences and to cache the faction data you have viewed. This
              stays on your device, is not transmitted to us, and is not used to
              identify you. You may remove it at any time by clearing site data
              for pa-pedia.com in your browser settings.
            </p>
          </Section>

          <Section title="Analytics">
            <p>
              We collect aggregate visitor statistics using a cookieless
              analytics service. It sets no cookies, stores nothing on your
              device, and does not profile you or track you across other sites.
            </p>
          </Section>

          <Section title="Error reporting">
            <p>
              When an error occurs, a diagnostic report is sent to our
              error-monitoring provider so that the fault can be corrected. IP
              addresses are not retained, and session recording is disabled.
            </p>
          </Section>

          <Section title="Who receives your data">
            <p>
              The site is hosted by Cloudflare, which also provides our
              analytics. As with any web host, Cloudflare necessarily processes
              your IP address in order to deliver pages and to protect the site
              against abuse. Error reports are processed by Sentry.
            </p>
            <p>
              No other third-party content is loaded while you browse, and your
              data is not sold or shared with anyone else.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              We hold no account, profile or contact record relating to you, so
              there is no personal data for us to provide, export or erase on
              request. If you are in the UK or EU, you have the right to lodge a
              complaint with your data protection authority.
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
              at any time and without prior notification. The date above indicates
              when it was last revised.
            </p>
          </Section>
        </div>
      </div>
    </>
  )
}
