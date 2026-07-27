// MUST be first: initialises Sentry before App.tsx's module body wraps the
// router. See instrument.ts — calling initMonitoring() from here instead is
// too late, and fails silently.
import './instrument'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { isMonitoringEnabled } from '@/lib/monitoring'

// React 19 root error hooks, registered ONLY when Sentry can receive the error.
//
// React's defaults route these to reportGlobalError, which logs to the console.
// Sentry.reactErrorHandler() with no callback captures and returns without
// logging, so registering it unconditionally would swallow errors entirely
// wherever there is no DSN — dev, CI, forks — turning a stack trace into a
// blank page with an empty console. Passing a logging callback is not an
// alternative: it flips the SDK's `mechanism.handled` to true and mislabels
// genuinely unhandled errors.
//
// onCaughtError stays unregistered in both cases: ErrorBoundary already reports
// those with component context, and both would double-count against the quota.
const rootOptions = isMonitoringEnabled()
  ? {
      onUncaughtError: Sentry.reactErrorHandler(),
      onRecoverableError: Sentry.reactErrorHandler(),
    }
  : {}

createRoot(document.getElementById('root')!, rootOptions).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
