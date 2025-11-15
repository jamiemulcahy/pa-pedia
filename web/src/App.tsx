import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FactionProvider } from '@/contexts/FactionContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Home } from '@/pages/Home'
import { FactionDetail } from '@/pages/FactionDetail'
import { UnitDetail } from '@/pages/UnitDetail'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <FactionProvider>
          <div className="min-h-screen bg-background text-foreground">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/faction/:id" element={<FactionDetail />} />
              <Route path="/faction/:factionId/unit/:unitId" element={<UnitDetail />} />
            </Routes>
          </div>
        </FactionProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
