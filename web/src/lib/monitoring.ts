import React from 'react'
import * as Sentry from '@sentry/react'
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom'
import type { ErrorEvent, EventHint, SeverityLevel } from '@sentry/react'

/**
 * Sentry error monitoring.
 *
 * Only initialises when VITE_SENTRY_DSN is set, so local dev and CI builds stay
 * silent and never burn quota. The free Sentry tier allows 5k errors/month —
 * every filter below exists to keep a single bad day from consuming it.
 *
 * Deliberately no Session Replay: the free tier includes 50 replays/month
 * (gone after one bad deploy) and the integration roughly doubles the SDK's
 * bundle cost. Add `Sentry.replayIntegration()` here if that trade changes.
 */

/** Fraction of chunk-load errors that get reported. See isChunkLoadError. */
const CHUNK_LOAD_SAMPLE_RATE = 0.05

/**
 * Tag marking failures that hit every affected visitor exactly once — an
 * outage shape, not a per-user bug. A broken manifest or an unreadable model
 * bundle produces one event per visitor for as long as it lasts, which is the
 * same quota risk as a chunk-load storm and needs the same treatment.
 */
const PER_VISITOR_TAG = 'per-visitor'
const PER_VISITOR_SAMPLE_RATE = 0.1

/**
 * Errors that are never actionable for us: browser extensions injecting into
 * the page, and the benign ResizeObserver notification that fires whenever a
 * resize handler itself resizes something (our masonry/table layouts trigger it).
 */
const IGNORED_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  'Non-Error promise rejection captured with value: undefined',
  // Safari/Firefox private mode blocks IndexedDB entirely; the app already
  // degrades gracefully and there is nothing to fix on our side.
  'A mutation operation was attempted on a database that did not allow mutations',
]

const DENIED_URLS = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
]

/**
 * Detects the "stale index.html points at a deleted bundle" failure — the exact
 * outage documented in web/public/_headers and .github/workflows/deploy.yml.
 *
 * Every user still on the old chunk graph throws one of these, so a single bad
 * deploy can produce thousands of events. We keep them (they are the earliest
 * signal that a deploy stranded users) but sample them hard.
 */
export function isChunkLoadError(message: string): boolean {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Unable to preload CSS/i.test(message)
  )
}

/**
 * Detects rejections thrown when the browser tears IndexedDB down underneath an
 * open transaction — site data cleared, or the origin evicted under storage
 * pressure. Chromium aborts every in-flight transaction with "Connection is
 * closing because of: <reason>"; `idb` then rejects each transaction's `done`
 * promise, falling back to a bare `AbortError: AbortError` when the abort left
 * `tx.error` unset.
 *
 * Unactionable, and already covered: the failure the visitor actually feels is
 * reported deliberately from the catch sites in factionLoader. These are the
 * duplicate. We suppress our own leak of `tx.done` (see idbTransaction.ts), but
 * `idb`'s read shortcuts (`db.get`, `db.getAllKeys`) never attach a handler to
 * it at all — that one is inside the library, so it has to be filtered here.
 */
export function isIdbTeardownError(message: string): boolean {
  return (
    /AbortError: AbortError/.test(message) ||
    /Connection is closing because of:/i.test(message)
  )
}

/**
 * Whether the SDK captured this event from a global handler rather than from a
 * `captureException` call.
 *
 * Load-bearing for the teardown filter below: a force-close rejects our own
 * `reportError` path with the very same message, and `beforeSend` sees handled
 * and unhandled events alike. Matching on the message alone would drop the
 * deliberate report too, leaving the storage-teardown failure invisible —
 * the opposite of what that filter is for.
 */
export function isUnhandled(event: ErrorEvent): boolean {
  return event.exception?.values?.some(v => v.mechanism?.handled === false) ?? false
}

/** Extracts a searchable message from a Sentry event and its original error. */
export function eventMessage(event: ErrorEvent, hint?: EventHint): string {
  const values = event.exception?.values ?? []
  const fromException = values
    .map(v => `${v.type ?? ''}: ${v.value ?? ''}`)
    .join(' ')
  // Structural check rather than `instanceof Error`: DOMException (thrown by
  // IndexedDB and fetch) does not inherit from Error in browsers, and errors
  // crossing a realm boundary fail instanceof too.
  const original = hint?.originalException as { message?: unknown } | undefined
  const fromHint = typeof original?.message === 'string' ? original.message : ''
  return [event.message ?? '', fromException, fromHint].join(' ').trim()
}

/**
 * beforeSend hook: drops noise and rate-limits chunk-load storms.
 *
 * `random` is injected so the sampling decision is testable.
 */
export function filterEvent(
  event: ErrorEvent,
  hint?: EventHint,
  random: () => number = Math.random,
): ErrorEvent | null {
  const message = eventMessage(event, hint)

  // Only the escaped duplicates. Handled events reach here too, and the
  // reportError() call in factionLoader's catch site carries this same message.
  if (isUnhandled(event) && isIdbTeardownError(message)) return null

  if (isChunkLoadError(message)) {
    if (random() >= CHUNK_LOAD_SAMPLE_RATE) return null

    // Collapse every variant (each references a different hashed filename)
    // into one issue instead of one issue per deploy per chunk.
    event.fingerprint = ['chunk-load-error']
    event.tags = { ...event.tags, error_class: 'chunk-load' }
    event.level = 'warning'
    return event
  }

  // Outage-shaped failures reported via reportError({ perVisitor: true }).
  // Sampled for the same reason as chunk-load errors: the event count scales
  // with how many people visit during the outage, not with how many distinct
  // bugs exist. 10% still surfaces the issue within a handful of visitors.
  if (event.tags?.volume === PER_VISITOR_TAG && random() >= PER_VISITOR_SAMPLE_RATE) {
    return null
  }

  return event
}

/** Whether monitoring is configured for this build. */
export function isMonitoringEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN)
}

/**
 * Parses a sample rate from an env var, falling back to the default.
 *
 * `.env` files yield empty strings for unset keys, and `Number('')` is 0 —
 * which would silently disable tracing rather than use the default.
 */
export function parseSampleRate(raw: unknown, fallback: number): number {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) return fallback
  return value
}

/**
 * Initialise Sentry. Call once, before React renders, so errors thrown during
 * the first paint are captured.
 */
export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  const tracesSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    0.1,
  )

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,

    integrations: [
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],

    // Performance tracing shares the free-tier quota with errors, so keep the
    // sample rate low. Errors are always sent at 100% (minus the filters above).
    tracesSampleRate,

    // This is a public reference site with no accounts. Never attach IPs,
    // cookies or headers that could identify a visitor.
    sendDefaultPii: false,

    ignoreErrors: IGNORED_ERRORS,
    denyUrls: DENIED_URLS,
    beforeSend: (event, hint) => filterEvent(event, hint),
  })
}

/**
 * Report a handled error with extra context.
 *
 * Most of this app's interesting failures are caught and degraded gracefully
 * (a missing manifest, an unreadable model bundle), so they never reach a
 * global handler. Call this at those catch sites — otherwise the failure is
 * invisible to us and only the user sees the degraded UI.
 *
 * Safe to call when monitoring is disabled: Sentry's capture functions are
 * no-ops until init runs.
 */
export interface ReportOptions {
  /** Extra detail attached to the event. Never put visitor data here. */
  context?: Record<string, unknown>
  level?: SeverityLevel
  /**
   * Set for failures that hit every affected visitor once, rather than
   * indicating a bug specific to one user. Such events are sampled — see
   * PER_VISITOR_SAMPLE_RATE — so an outage cannot drain the monthly quota.
   */
  perVisitor?: boolean
}
export function reportError(error: unknown, options: ReportOptions = {}): void {
  const { context, level = 'error', perVisitor = false } = options

  Sentry.captureException(error, {
    level,
    ...(context ? { extra: context } : {}),
    ...(perVisitor ? { tags: { volume: PER_VISITOR_TAG } } : {}),
  })
}
