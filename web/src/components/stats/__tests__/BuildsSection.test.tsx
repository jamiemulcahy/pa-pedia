import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { BuildsSection } from '../BuildsSection'
import { renderWithProviders } from '@/tests/helpers'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import * as useFactionHook from '@/hooks/useFaction'

// Mock useFaction hook
vi.mock('@/hooks/useFaction', () => ({
  useFaction: vi.fn(),
}))

const mockUnits = [
  {
    identifier: 'assault_bot',
    displayName: 'Dox',
    unitTypes: ['Mobile', 'Bot', 'Basic'],
    source: 'base',
    files: [],
    unit: {
      id: 'assault_bot',
      resourceName: '/pa/units/land/assault_bot/assault_bot.json',
      displayName: 'Dox',
      tier: 1,
      unitTypes: ['Mobile', 'Bot', 'Basic'],
      accessible: true,
      specs: { combat: { health: 50 }, economy: { buildCost: 90, buildRate: 0 } },
    },
  },
  {
    identifier: 'grenadier',
    displayName: 'Grenadier',
    unitTypes: ['Mobile', 'Bot', 'Basic'],
    source: 'base',
    files: [],
    unit: {
      id: 'grenadier',
      resourceName: '/pa/units/land/bot_grenadier/bot_grenadier.json',
      displayName: 'Grenadier',
      tier: 1,
      unitTypes: ['Mobile', 'Bot', 'Basic'],
      accessible: true,
      specs: { combat: { health: 90 }, economy: { buildCost: 120, buildRate: 0 } },
    },
  },
  {
    identifier: 'slammer',
    displayName: 'Slammer',
    unitTypes: ['Mobile', 'Bot', 'Advanced'],
    source: 'base',
    files: [],
    unit: {
      id: 'slammer',
      resourceName: '/pa/units/land/bot_slammer/bot_slammer.json',
      displayName: 'Slammer',
      tier: 2,
      unitTypes: ['Mobile', 'Bot', 'Advanced'],
      accessible: true,
      specs: { combat: { health: 500 }, economy: { buildCost: 300, buildRate: 0 } },
    },
  },
  {
    identifier: 'tank',
    displayName: 'Ant',
    unitTypes: ['Mobile', 'Tank', 'Basic'],
    source: 'base',
    files: [],
    unit: {
      id: 'tank',
      resourceName: '/pa/units/land/tank/tank.json',
      displayName: 'Ant',
      tier: 1,
      unitTypes: ['Mobile', 'Tank', 'Basic'],
      accessible: true,
      specs: { combat: { health: 120 }, economy: { buildCost: 150, buildRate: 0 } },
    },
  },
]

function renderBuildsSection(props: React.ComponentProps<typeof BuildsSection>) {
  return renderWithProviders(
    <CurrentFactionProvider factionId="MLA">
      <BuildsSection {...props} />
    </CurrentFactionProvider>
  )
}

describe('BuildsSection', () => {
  beforeEach(() => {
    vi.mocked(useFactionHook.useFaction).mockReturnValue({
      metadata: undefined,
      index: undefined,
      units: mockUnits,
      loading: false,
      error: null,
      exists: true,
      factionsLoading: false,
    })
  })

  it('should render buildable units', () => {
    renderBuildsSection({
      builds: ['assault_bot'],
      buildRate: 15,
    })

    expect(screen.getByText('Builds')).toBeInTheDocument()
    expect(screen.getByText('Dox')).toBeInTheDocument()
  })

  it('should render multiple units sorted by tier then name', () => {
    renderBuildsSection({
      builds: ['slammer', 'grenadier', 'assault_bot'],
      buildRate: 15,
    })

    const links = screen.getAllByRole('link')
    // T1 units first (Dox, Grenadier alphabetically), then T2 (Slammer)
    expect(links[0]).toHaveTextContent('Dox')
    expect(links[1]).toHaveTextContent('Grenadier')
    expect(links[2]).toHaveTextContent('Slammer')
  })

  it('should calculate build time correctly', () => {
    // buildCost = 90, buildRate = 15 -> buildTime = 6s = 0:06
    renderBuildsSection({
      builds: ['assault_bot'],
      buildRate: 15,
    })

    expect(screen.getByText('0:06')).toBeInTheDocument()
  })

  it('should return null when no builds provided', () => {
    const { container } = renderBuildsSection({
      builds: undefined,
      buildRate: 15,
    })

    expect(container.firstChild).toBeNull()
  })

  it('should return null when builds is empty', () => {
    const { container } = renderBuildsSection({
      builds: [],
      buildRate: 15,
    })

    expect(container.firstChild).toBeNull()
  })

  describe('showDifferencesOnly', () => {
    it('should show section when builds differ', () => {
      renderBuildsSection({
        builds: ['assault_bot'],
        buildRate: 15,
        compareBuilds: ['grenadier'],
        showDifferencesOnly: true,
      })

      expect(screen.getByText('Builds')).toBeInTheDocument()
    })

    it('should return null when builds are identical and showDifferencesOnly is enabled', () => {
      const { container } = renderBuildsSection({
        builds: ['assault_bot'],
        buildRate: 15,
        compareBuilds: ['assault_bot'],
        showDifferencesOnly: true,
      })

      expect(container.firstChild).toBeNull()
    })

    it('should show all builds when showDifferencesOnly is false', () => {
      renderBuildsSection({
        builds: ['assault_bot'],
        buildRate: 15,
        compareBuilds: ['assault_bot'],
        showDifferencesOnly: false,
      })

      expect(screen.getByText('Builds')).toBeInTheDocument()
    })

    it('should show all builds when no compareBuilds even with showDifferencesOnly', () => {
      renderBuildsSection({
        builds: ['assault_bot'],
        buildRate: 15,
        showDifferencesOnly: true,
      })

      expect(screen.getByText('Builds')).toBeInTheDocument()
    })
  })

  describe('isComparisonSide', () => {
    it('should show + indicator for units only in comparison unit', () => {
      renderBuildsSection({
        builds: ['assault_bot', 'grenadier'],
        buildRate: 15,
        compareBuilds: ['assault_bot'],
        isComparisonSide: true,
      })

      // Grenadier is only in comparison (this) unit, should show +
      expect(screen.getByText('+')).toBeInTheDocument()
    })

    it('should show - indicator for units only in primary unit', () => {
      renderBuildsSection({
        builds: ['assault_bot'],
        buildRate: 15,
        compareBuilds: ['assault_bot', 'tank'],
        isComparisonSide: true,
      })

      // Tank is only in primary (compare) unit, should show -
      expect(screen.getByText('−')).toBeInTheDocument()
    })

    it('should show merged list with all units on comparison side', () => {
      renderBuildsSection({
        builds: ['assault_bot'],
        buildRate: 15,
        compareBuilds: ['tank'],
        isComparisonSide: true,
      })

      // Should show both units
      expect(screen.getByText('Dox')).toBeInTheDocument()
      expect(screen.getByText('Ant')).toBeInTheDocument()
    })

    it('should not show indicators on primary side', () => {
      renderBuildsSection({
        builds: ['assault_bot'],
        buildRate: 15,
        compareBuilds: ['grenadier'],
        isComparisonSide: false,
      })

      expect(screen.queryByText('+')).not.toBeInTheDocument()
      expect(screen.queryByText('−')).not.toBeInTheDocument()
    })
  })
})
