import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { BuiltBySection } from '../BuiltBySection'
import { renderWithProviders } from '@/tests/helpers'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import * as useFactionHook from '@/hooks/useFaction'

// Mock useFaction hook
vi.mock('@/hooks/useFaction', () => ({
  useFaction: vi.fn(),
}))

const mockUnits = [
  {
    identifier: 'basic_bot_factory',
    displayName: 'Bot Factory',
    unitTypes: ['Factory', 'Structure'],
    source: 'base',
    files: [],
    unit: {
      id: 'basic_bot_factory',
      resourceName: '/pa/units/land/bot_factory/bot_factory.json',
      displayName: 'Bot Factory',
      tier: 1,
      unitTypes: ['Factory', 'Structure'],
      accessible: true,
      specs: { combat: { health: 5000 }, economy: { buildCost: 800, buildRate: 15 } },
    },
  },
  {
    identifier: 'advanced_bot_factory',
    displayName: 'Advanced Bot Factory',
    unitTypes: ['Factory', 'Structure'],
    source: 'base',
    files: [],
    unit: {
      id: 'advanced_bot_factory',
      resourceName: '/pa/units/land/bot_factory_adv/bot_factory_adv.json',
      displayName: 'Advanced Bot Factory',
      tier: 2,
      unitTypes: ['Factory', 'Structure'],
      accessible: true,
      specs: { combat: { health: 7500 }, economy: { buildCost: 2000, buildRate: 30 } },
    },
  },
  {
    identifier: 'basic_vehicle_factory',
    displayName: 'Vehicle Factory',
    unitTypes: ['Factory', 'Structure'],
    source: 'base',
    files: [],
    unit: {
      id: 'basic_vehicle_factory',
      resourceName: '/pa/units/land/vehicle_factory/vehicle_factory.json',
      displayName: 'Vehicle Factory',
      tier: 1,
      unitTypes: ['Factory', 'Structure'],
      accessible: true,
      specs: { combat: { health: 5000 }, economy: { buildCost: 800, buildRate: 15 } },
    },
  },
  {
    identifier: 'commander',
    displayName: 'Commander',
    unitTypes: ['Commander', 'Mobile'],
    source: 'base',
    files: [],
    unit: {
      id: 'commander',
      resourceName: '/pa/units/commanders/imperial_invictus/imperial_invictus.json',
      displayName: 'Commander',
      tier: 3,
      unitTypes: ['Commander', 'Mobile'],
      accessible: true,
      specs: { combat: { health: 12000 }, economy: { buildCost: 0, buildRate: 50 } },
    },
  },
  {
    identifier: 'commander_alpha',
    displayName: 'Alpha Commander',
    unitTypes: ['Commander', 'Mobile'],
    source: 'base',
    files: [],
    unit: {
      id: 'commander_alpha',
      resourceName: '/pa/units/commanders/alpha/alpha.json',
      displayName: 'Alpha Commander',
      tier: 3,
      unitTypes: ['Commander', 'Mobile'],
      accessible: true,
      specs: { combat: { health: 12000 }, economy: { buildCost: 0, buildRate: 40 } },
    },
  },
  {
    identifier: 'commander_beta',
    displayName: 'Beta Commander',
    unitTypes: ['Commander', 'Mobile'],
    source: 'base',
    files: [],
    unit: {
      id: 'commander_beta',
      resourceName: '/pa/units/commanders/beta/beta.json',
      displayName: 'Beta Commander',
      tier: 3,
      unitTypes: ['Commander', 'Mobile'],
      accessible: true,
      specs: { combat: { health: 12000 }, economy: { buildCost: 0, buildRate: 60 } },
    },
  },
]

function renderBuiltBySection(props: React.ComponentProps<typeof BuiltBySection>) {
  return renderWithProviders(
    <CurrentFactionProvider factionId="MLA">
      <BuiltBySection {...props} />
    </CurrentFactionProvider>
  )
}

describe('BuiltBySection', () => {
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

  it('should render builders', () => {
    renderBuiltBySection({
      builtBy: ['basic_bot_factory'],
      buildCost: 150,
    })

    expect(screen.getByText('Built By')).toBeInTheDocument()
    expect(screen.getByText('Bot Factory')).toBeInTheDocument()
  })

  it('should render multiple builders sorted by tier', () => {
    renderBuiltBySection({
      builtBy: ['advanced_bot_factory', 'basic_bot_factory'],
      buildCost: 150,
    })

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('Bot Factory')
    expect(links[1]).toHaveTextContent('Advanced Bot Factory')
  })

  it('should return null when no builtBy provided', () => {
    const { container } = renderBuiltBySection({
      builtBy: undefined,
      buildCost: 150,
    })

    expect(container.firstChild).toBeNull()
  })

  it('should return null when builtBy is empty', () => {
    const { container } = renderBuiltBySection({
      builtBy: [],
      buildCost: 150,
    })

    expect(container.firstChild).toBeNull()
  })

  describe('showDifferencesOnly', () => {
    it('should show section when builders differ', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory'],
        buildCost: 150,
        compareBuiltBy: ['advanced_bot_factory'],
        showDifferencesOnly: true,
      })

      expect(screen.getByText('Built By')).toBeInTheDocument()
    })

    it('should return null when builders are identical and showDifferencesOnly is enabled', () => {
      const { container } = renderBuiltBySection({
        builtBy: ['basic_bot_factory'],
        buildCost: 150,
        compareBuiltBy: ['basic_bot_factory'],
        showDifferencesOnly: true,
      })

      expect(container.firstChild).toBeNull()
    })

    it('should show all builders when showDifferencesOnly is false', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory'],
        buildCost: 150,
        compareBuiltBy: ['basic_bot_factory'],
        showDifferencesOnly: false,
      })

      expect(screen.getByText('Built By')).toBeInTheDocument()
    })

    it('should show all builders when no compareBuiltBy even with showDifferencesOnly', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory'],
        buildCost: 150,
        showDifferencesOnly: true,
      })

      expect(screen.getByText('Built By')).toBeInTheDocument()
    })
  })

  describe('isComparisonSide', () => {
    it('should show + indicator for builders only in comparison unit', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory', 'advanced_bot_factory'],
        buildCost: 150,
        compareBuiltBy: ['basic_bot_factory'],
        isComparisonSide: true,
      })

      // Advanced Bot Factory is only in comparison (this) unit, should show +
      expect(screen.getByText('+')).toBeInTheDocument()
    })

    it('should show - indicator for builders only in primary unit', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory'],
        buildCost: 150,
        compareBuiltBy: ['basic_bot_factory', 'basic_vehicle_factory'],
        isComparisonSide: true,
      })

      // Vehicle Factory is only in primary (compare) unit, should show -
      expect(screen.getByText('−')).toBeInTheDocument()
    })

    it('should show merged list with all builders on comparison side', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory'],
        buildCost: 150,
        compareBuiltBy: ['basic_vehicle_factory'],
        isComparisonSide: true,
      })

      // Should show both factories
      expect(screen.getByText('Bot Factory')).toBeInTheDocument()
      expect(screen.getByText('Vehicle Factory')).toBeInTheDocument()
    })

    it('should not show indicators on primary side', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory'],
        buildCost: 150,
        compareBuiltBy: ['advanced_bot_factory'],
        isComparisonSide: false,
      })

      expect(screen.queryByText('+')).not.toBeInTheDocument()
      expect(screen.queryByText('−')).not.toBeInTheDocument()
    })
  })

  describe('commander aggregation', () => {
    it('should aggregate multiple commanders into single "Commanders" entry', () => {
      renderBuiltBySection({
        builtBy: ['commander', 'commander_alpha', 'commander_beta'],
        buildCost: 300,
      })

      // Should show "Commanders" instead of individual commander names
      expect(screen.getByText('Commanders')).toBeInTheDocument()
      expect(screen.queryByText('Commander')).not.toBeInTheDocument()
      expect(screen.queryByText('Alpha Commander')).not.toBeInTheDocument()
      expect(screen.queryByText('Beta Commander')).not.toBeInTheDocument()
    })

    it('should show fastest build time for aggregated commanders', () => {
      // Build rates: commander=50, alpha=40, beta=60
      // Build cost: 300
      // Build times: 300/50=6s, 300/40=7.5s, 300/60=5s
      // Fastest is beta at 5s = 0:05
      renderBuiltBySection({
        builtBy: ['commander', 'commander_alpha', 'commander_beta'],
        buildCost: 300,
      })

      expect(screen.getByText('0:05')).toBeInTheDocument()
    })

    it('should render aggregated commanders as plain text, not a link', () => {
      renderBuiltBySection({
        builtBy: ['commander', 'commander_alpha'],
        buildCost: 300,
      })

      // "Commanders" should not be a link
      const commandersText = screen.getByText('Commanders')
      expect(commandersText.tagName).toBe('SPAN')
      expect(commandersText.closest('a')).toBeNull()
    })

    it('should render regular builders as links alongside aggregated commanders', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory', 'commander', 'commander_alpha'],
        buildCost: 300,
      })

      // Bot Factory should be a link
      const botFactoryLink = screen.getByRole('link', { name: 'Bot Factory' })
      expect(botFactoryLink).toBeInTheDocument()

      // Commanders should be plain text
      const commandersText = screen.getByText('Commanders')
      expect(commandersText.closest('a')).toBeNull()
    })

    it('should not aggregate a single commander', () => {
      renderBuiltBySection({
        builtBy: ['commander'],
        buildCost: 300,
      })

      // Single commander should show as "Commanders" (aggregation still happens)
      expect(screen.getByText('Commanders')).toBeInTheDocument()
    })

    it('should show diff styling for aggregated commanders in comparison mode', () => {
      renderBuiltBySection({
        builtBy: ['commander', 'commander_alpha'],
        buildCost: 300,
        compareBuiltBy: [],
        isComparisonSide: true,
      })

      // Commanders entry should show + since it's only in this unit
      expect(screen.getByText('+')).toBeInTheDocument()
    })

    it('should show - indicator when commanders removed in comparison', () => {
      renderBuiltBySection({
        builtBy: ['basic_bot_factory'],
        buildCost: 300,
        compareBuiltBy: ['basic_bot_factory', 'commander', 'commander_alpha'],
        isComparisonSide: true,
      })

      // Commanders entry should show - since it's only in compare unit
      expect(screen.getByText('−')).toBeInTheDocument()
      // And Commanders should appear as aggregated text
      expect(screen.getByText('Commanders')).toBeInTheDocument()
    })
  })
})
