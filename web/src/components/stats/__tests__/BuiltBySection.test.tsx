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
})
