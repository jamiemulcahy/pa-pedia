import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FactionProvider } from '@/contexts/FactionContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Header } from '@/components/Header'
import { ScrollToTop } from '@/components/ScrollToTop'
import { FactionUpload } from '@/components/FactionUpload'
import { CliDownload } from '@/components/CliDownload'
import { Home } from '@/pages/Home'
import { FactionDetail } from '@/pages/FactionDetail'
import { UnitDetail } from '@/pages/UnitDetail'

function App() {
  const [showUpload, setShowUpload] = useState(false)
  const [showCliDownload, setShowCliDownload] = useState(false)

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <ErrorBoundary>
        <FactionProvider>
          <div className="min-h-screen bg-background text-foreground">
            <Header
              onUploadClick={() => setShowUpload(true)}
              onDownloadClick={() => setShowCliDownload(true)}
            />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/faction" element={<FactionDetail />} />
              <Route path="/faction/:id" element={<FactionDetail />} />
              <Route path="/faction/:factionId/unit/:unitId" element={<UnitDetail />} />
            </Routes>

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
