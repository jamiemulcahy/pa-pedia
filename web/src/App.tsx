import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { FactionProvider } from '@/contexts/FactionContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ScrollToTop } from '@/components/ScrollToTop'
import { FactionUpload } from '@/components/FactionUpload'
import { CliDownload } from '@/components/CliDownload'
import { Home } from '@/pages/Home'
import { FactionDetail } from '@/pages/FactionDetail'
import { UnitDetail } from '@/pages/UnitDetail'
import { Privacy } from '@/pages/Privacy'

// Gives Sentry the parameterised route (/faction/:id) rather than the raw URL,
// so navigations group into one transaction per page instead of one per unit.
const SentryRoutes = Sentry.wrapReactRouterRouting(Routes)

function App() {
  const [showUpload, setShowUpload] = useState(false)
  const [showCliDownload, setShowCliDownload] = useState(false)

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <ErrorBoundary>
        <FactionProvider>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Header
              onUploadClick={() => setShowUpload(true)}
              onDownloadClick={() => setShowCliDownload(true)}
            />
            {/* flex-1 keeps the footer at the bottom of the viewport on short
                pages rather than floating mid-screen. */}
            <main className="flex-1">
              <SentryRoutes>
                <Route path="/" element={<Home />} />
                <Route path="/faction" element={<FactionDetail />} />
                <Route path="/faction/:id" element={<FactionDetail />} />
                <Route path="/faction/:factionId/unit/:unitId" element={<UnitDetail />} />
                <Route path="/privacy" element={<Privacy />} />
              </SentryRoutes>
            </main>
            <Footer />

            {/* Modals */}
            {showUpload && (
              <FactionUpload
                onClose={() => setShowUpload(false)}
                onOpenCliDownload={() => setShowCliDownload(true)}
              />
            )}
            {showCliDownload && (
              <CliDownload onClose={() => setShowCliDownload(false)} />
            )}
          </div>
        </FactionProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
