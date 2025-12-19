import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FactionProvider } from '@/contexts/FactionContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Header } from '@/components/Header'
import { ScrollToTop } from '@/components/ScrollToTop'
import { FactionUpload } from '@/components/FactionUpload'
import { CliDownload } from '@/components/CliDownload'
import { ChristmasSnow } from '@/components/ChristmasSnow'
import { Home } from '@/pages/Home'
import { FactionDetail } from '@/pages/FactionDetail'
import { UnitDetail } from '@/pages/UnitDetail'
import { useFestiveMode } from '@/hooks/useFestiveMode'

function App() {
  const [showUpload, setShowUpload] = useState(false)
  const [showCliDownload, setShowCliDownload] = useState(false)
  const { isFestiveMode, toggleFestiveMode } = useFestiveMode()

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <ErrorBoundary>
        <FactionProvider>
          <div className="min-h-screen bg-background text-foreground">
            {isFestiveMode && <ChristmasSnow />}
            <div className="relative z-20">
            <Header
              onUploadClick={() => setShowUpload(true)}
              onDownloadClick={() => setShowCliDownload(true)}
              isFestiveMode={isFestiveMode}
              onToggleFestiveMode={toggleFestiveMode}
            />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/faction" element={<FactionDetail />} />
              <Route path="/faction/:id" element={<FactionDetail />} />
              <Route path="/faction/:factionId/unit/:unitId" element={<UnitDetail />} />
            </Routes>
            </div>

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
