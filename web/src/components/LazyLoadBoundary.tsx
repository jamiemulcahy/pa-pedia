/**
 * LazyLoadBoundary
 *
 * Error boundary for a lazy-loaded feature, so a failure stays inside that
 * feature instead of reaching the app-wide ErrorBoundary and blanking a page
 * that was otherwise working.
 *
 * The case it exists for is a tab left open across a deploy: the deploy deleted
 * the chunk this tab's build asks for, and only a reload can fetch the new
 * build. We never reload on the visitor's behalf. When a newer build is
 * confirmed ({@link checkForNewBuild}) we say so and offer a Reload button;
 * otherwise (offline, flaky connection, same build) Try again comes first, with
 * Reload as the fallback. With no automatic reload there is no loop to guard
 * against, and nothing the visitor was looking at disappears without them
 * choosing it.
 */

import React, { useEffect, useState } from 'react'
import { isChunkLoadError, reportError } from '@/lib/monitoring'
import { checkForNewBuild, type BuildStatus } from '@/lib/staleBuild'

interface Props {
  children: React.ReactNode
  /** What failed to load, for the message, e.g. "the 3D viewer". */
  feature: string
  /**
   * Called by Try again after a chunk-load failure, before the children remount.
   * Must make the next mount re-attempt the import — see retryableLazy.
   */
  retryImport: () => void
  /** Changing this clears a shown failure, e.g. when the unit being viewed changes. */
  resetKey?: string
  /** Wraps the fallback so it can match the size of what it replaces. */
  className?: string
}

interface State {
  error: Error | null
}

export class LazyLoadBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Chunk-load failures are reported by the fallback once the build check
    // has classified them; everything else is reported now, as ErrorBoundary would.
    if (isChunkLoadError(error.message)) return
    console.error('Error caught by boundary:', error, errorInfo)
    reportError(error, { context: { componentStack: errorInfo.componentStack } })
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.retry()
  }

  private retry = () => {
    // A render error needs only a remount; a failed import also needs a fresh lazy().
    if (this.state.error && isChunkLoadError(this.state.error.message)) this.props.retryImport()
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className={this.props.className}>
        {isChunkLoadError(error.message) ? (
          <ChunkLoadFailure error={error} feature={this.props.feature} onRetry={this.retry} />
        ) : (
          <FailureMessage
            message={`Something went wrong displaying ${this.props.feature}.`}
            action={{ label: 'Try again', onClick: this.retry }}
          />
        )}
      </div>
    )
  }
}

function ChunkLoadFailure({
  error,
  feature,
  onRetry,
}: {
  error: Error
  feature: string
  onRetry: () => void
}) {
  const [build, setBuild] = useState<BuildStatus | 'checking'>('checking')

  useEffect(() => {
    let active = true
    checkForNewBuild().then(status => {
      // Tagged so stale-tab failures (expected after every deploy) can be told
      // apart from same-build ones, which point at a real problem.
      reportError(error, { level: 'warning', tags: { build_status: status } })
      if (active) setBuild(status)
    })
    return () => {
      active = false
    }
  }, [error])

  if (build === 'checking') {
    return <FailureMessage message={`Couldn't load ${feature}. Checking for a site update…`} />
  }

  const reload = { label: 'Reload page', onClick: () => window.location.reload() }

  if (build === 'stale') {
    return (
      <FailureMessage
        message={`PA-Pedia has been updated since this page was opened. Reload the page to load ${feature}.`}
        action={reload}
      />
    )
  }

  // Reload stays on offer as the fallback: some browsers remember a failed
  // module import, so Try again can keep failing where a new document won't.
  return (
    <FailureMessage
      message={
        build === 'unknown'
          ? `Couldn't load ${feature}. Check your connection and try again.`
          : `Couldn't load ${feature}. Try again, or reload the page if it keeps failing.`
      }
      action={{ label: 'Try again', onClick: onRetry }}
      secondaryAction={reload}
    />
  )
}

interface Action {
  label: string
  onClick: () => void
}

function FailureMessage({
  message,
  action,
  secondaryAction,
}: {
  message: string
  action?: Action
  secondaryAction?: Action
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 text-center p-4">
      <p className="text-sm text-gray-300">{message}</p>
      <div className="flex gap-2">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-gray-700"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 underline hover:text-gray-100"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}
