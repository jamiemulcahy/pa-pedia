import { Component, type ReactNode } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { setupMockFetch } from '@/tests/mocks/factionData'
import { startLiveTranslation, translatedNodeCount } from '@/tests/translation'
import { FactionProvider } from '@/contexts/FactionContext'
import { Home } from '@/pages/Home'
import { FactionDetail } from '@/pages/FactionDetail'
import { UnitDetail } from '@/pages/UnitDetail'
import { Privacy } from '@/pages/Privacy'

/**
 * Browser page translation regression test (issue #519).
 *
 * Renders the real pages under a simulated live translator, which moves every
 * text node into a <font> as soon as it appears, then drives the state changes
 * that have crashed production (PA-PEDIA-4, PA-PEDIA-6) plus the other common
 * structural updates on each page.
 *
 * The app-wide guard (src/lib/translationGuard.ts) is deliberately NOT installed
 * here. It would make every one of these pass regardless; this test checks that
 * the components themselves never leave React tracking a text node beside a
 * sibling, which is what `local/no-bare-text-siblings` enforces statically. The
 * lint rule cannot see through component boundaries or runtime values, so this
 * is the runtime half of that check.
 */

class CaptureBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return <div data-testid="boundary-tripped">{this.state.error.message}</div>
    }
    return this.props.children
  }
}

/** Test-only control to change route without a full remount, as in-app links do. */
function GoTo({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" data-testid={`goto:${to}`} onClick={() => navigate(to)}>
      go
    </button>
  )
}

let stopTranslation: (() => void) | null = null

function renderTranslated(initialRoute: string, links: string[] = []) {
  const result = render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <FactionProvider>
        <CaptureBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/faction" element={<FactionDetail />} />
            <Route path="/faction/:id" element={<FactionDetail />} />
            <Route path="/faction/:factionId/unit/:unitId" element={<UnitDetail />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </CaptureBoundary>
        {links.map((to) => (
          <GoTo key={to} to={to} />
        ))}
      </FactionProvider>
    </MemoryRouter>
  )
  // Translation starts on first paint, while the page is still loading, so the
  // loading → loaded transition is exercised too.
  stopTranslation = startLiveTranslation(result.container)
  return result
}

function expectNoCrash(container: HTMLElement) {
  const tripped = screen.queryByTestId('boundary-tripped')
  expect(tripped?.textContent ?? null).toBeNull()
  // Guard against passing for the wrong reason: the translator must actually have run.
  expect(translatedNodeCount(container)).toBeGreaterThan(0)
}

describe('pages survive browser page translation', () => {
  beforeEach(() => {
    setupMockFetch()
    // jsdom has no layout, so no element scrolling; comparison mode scrolls its row.
    Element.prototype.scrollTo ??= () => {}
  })

  afterEach(() => {
    stopTranslation?.()
    stopTranslation = null
    vi.restoreAllMocks()
  })

  it('Home loads its faction cards', async () => {
    const { container } = renderTranslated('/')

    await screen.findByRole('link', { name: 'MLA' })
    expect(screen.getByText('Legion')).toBeInTheDocument()
    expectNoCrash(container)
  })

  // PA-PEDIA-6
  it('FactionDetail toggles inaccessible units, views and categories', async () => {
    const user = userEvent.setup()
    const { container } = renderTranslated('/faction/MLA')

    await screen.findByTestId('unit-count')
    await user.click(await screen.findByRole('button', { name: /show 1 inaccessible unit/i }))
    await screen.findByText('Sea Mine')
    await user.click(screen.getByRole('button', { name: /hide inaccessible units/i }))
    await waitFor(() => expect(screen.queryByText('Sea Mine')).toBeNull())

    // Go once round the grid/table/list cycle (it persists, so start wherever it
    // is), flipping the grid-only toggles when they are on screen.
    const layout = /switch to (grid|table|list) view/i
    for (let i = 0; i < 3; i++) {
      for (const name of [/switch to (compact|normal) view/i, /(collapse|expand) all categories/i]) {
        const toggle = screen.queryByRole('button', { name })
        if (!toggle) continue
        await user.click(toggle)
        await user.click(screen.getByRole('button', { name }))
      }
      await user.click(screen.getByRole('button', { name: layout }))
    }

    await user.type(screen.getByRole('combobox', { name: /search units by name/i }), 'tank')
    await user.clear(screen.getByRole('combobox', { name: /search units by name/i }))

    expectNoCrash(container)
  })

  // Named in #519 as a PA-PEDIA-6 trigger. React Router currently remounts the
  // page between these two routes, so the All-only text is not removed in place,
  // but this keeps the transition covered if that ever changes.
  it('FactionDetail moves from All factions to a single faction', async () => {
    const user = userEvent.setup()
    const { container } = renderTranslated('/faction', ['/faction/MLA'])

    await waitFor(() => expect(screen.getByTestId('unit-count')).toHaveTextContent(/from \d+ factions/))
    await user.click(screen.getByTestId('goto:/faction/MLA'))
    await waitFor(() => expect(screen.getByTestId('unit-count')).not.toHaveTextContent(/from \d+ factions/))

    expectNoCrash(container)
  })

  // PA-PEDIA-4: the 3D model button swaps its spinner for an icon once the
  // availability lookup resolves.
  it('UnitDetail resolves model availability and enters comparison mode', async () => {
    const user = userEvent.setup()
    const { container } = renderTranslated('/faction/MLA/unit/tank', ['/faction/MLA/unit/bot'])

    await screen.findByRole('heading', { name: 'Tank' })
    await screen.findByTestId('view-3d-model')

    await user.click(screen.getByRole('button', { name: /compare/i }))
    await screen.findByRole('button', { name: /exit comparison/i })
    await user.click(screen.getByRole('button', { name: /exit comparison/i }))

    await user.click(screen.getByTestId('goto:/faction/MLA/unit/bot'))
    await screen.findByRole('heading', { name: 'Bot' })

    expectNoCrash(container)
  })

  it('UnitDetail loads a comparison from the URL', async () => {
    const { container } = renderTranslated('/faction/MLA/unit/tank?compare=MLA/bot')

    await screen.findByRole('heading', { name: 'Tank' })
    await screen.findByRole('heading', { name: 'Bot' })
    expectNoCrash(container)
  })

  it('Privacy renders', async () => {
    const { container } = renderTranslated('/privacy')

    await screen.findByRole('heading', { name: /privacy/i })
    expectNoCrash(container)
  })
})
