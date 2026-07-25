import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { initMonitoring } from '@/lib/monitoring'

// Before render, so errors thrown during the first paint are captured.
initMonitoring()

createRoot(document.getElementById('root')!, {
  // React 19 root error hooks. onCaughtError is deliberately omitted: errors
  // our ErrorBoundary catches are reported there with component context, and
  // registering both would double-count them against the Sentry quota.
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
