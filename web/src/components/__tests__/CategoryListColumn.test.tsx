import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CategoryListColumn } from '../CategoryListColumn'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { renderWithProviders } from '@/tests/helpers'
import type { UnitIndexEntry, Unit } from '@/types/faction'
import type { CommanderGroup } from '@/utils/commanderDedup'

// Helper to create a minimal Unit object
function createMockUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'test-unit',
    resourceName: '/pa/units/test.json',
    displayName: 'Test Unit',
    tier: 1,
    unitTypes: ['Mobile', 'Land'],
    accessible: true,
    specs: {
      combat: { health: 100, dps: 50 },
      economy: { buildCost: 100 },
      mobility: { moveSpeed: 10 },
    },
    ...overrides,
  }
}

// Helper to create a minimal UnitIndexEntry
function createMockUnitEntry(
  identifier: string,
  displayName: string,
  unitTypes: string[] = ['Mobile', 'Land']
): UnitIndexEntry {
  return {
    identifier,
    displayName,
    unitTypes,
    source: 'base',
    files: [],
    unit: createMockUnit({ id: identifier, displayName, unitTypes }),
  }
}

// Helper to create a CommanderGroup
function createMockGroup(
  representativeId: string,
  representativeName: string,
  variantIds: Array<{ id: string; name: string }> = []
): CommanderGroup {
  return {
    representative: createMockUnitEntry(representativeId, representativeName, ['Commander', 'Land', 'Mobile']),
    variants: variantIds.map(v => createMockUnitEntry(v.id, v.name, ['Commander', 'Land', 'Mobile'])),
    statsHash: `hash-${representativeId}`,
  }
}

function renderComponent(ui: React.ReactElement) {
  return renderWithProviders(
    <MemoryRouter>
      <CurrentFactionProvider factionId="MLA">
        {ui}
      </CurrentFactionProvider>
    </MemoryRouter>,
    { skipRouter: true }
  )
}

describe('CategoryListColumn', () => {
  const defaultProps = {
    category: 'Tanks' as const,
    factionId: 'MLA',
    brokenImages: new Set<string>(),
    onImageError: vi.fn(),
  }

  describe('basic rendering', () => {
    it('should render category header with count', () => {
      const units = [
        createMockUnitEntry('tank1', 'Tank 1'),
        createMockUnitEntry('tank2', 'Tank 2'),
      ]

      renderComponent(
        <CategoryListColumn {...defaultProps} units={units} />
      )

      expect(screen.getByText('Tanks')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('should render all units as list items', () => {
      const units = [
        createMockUnitEntry('tank1', 'Tank 1'),
        createMockUnitEntry('tank2', 'Tank 2'),
      ]

      renderComponent(
        <CategoryListColumn {...defaultProps} units={units} />
      )

      expect(screen.getByRole('link', { name: /tank 1/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /tank 2/i })).toBeInTheDocument()
    })

    it('should return null for empty units', () => {
      const { container } = renderComponent(
        <CategoryListColumn {...defaultProps} units={[]} />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should link to correct unit detail page', () => {
      const units = [createMockUnitEntry('tank1', 'Tank 1')]

      renderComponent(
        <CategoryListColumn {...defaultProps} units={units} />
      )

      expect(screen.getByRole('link')).toHaveAttribute('href', '/faction/MLA/unit/tank1')
    })
  })

  describe('commander grouping', () => {
    it('should show expand button for commander with variants', () => {
      const units = [
        createMockUnitEntry('able', 'Able Commander', ['Commander', 'Land']),
        createMockUnitEntry('ajax', 'Ajax Commander', ['Commander', 'Land']),
      ]

      const commanderGroups = [
        createMockGroup('able', 'Able Commander', [{ id: 'ajax', name: 'Ajax Commander' }]),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Commanders"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      const button = screen.getByRole('button', { name: /show 1 variant/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('+1')
    })

    it('should show header count as unique commanders', () => {
      const units = [
        createMockUnitEntry('able', 'Able Commander', ['Commander', 'Land']),
        createMockUnitEntry('ajax', 'Ajax Commander', ['Commander', 'Land']),
        createMockUnitEntry('alpha', 'Alpha Commander', ['Commander', 'Land']),
      ]

      const commanderGroups = [
        createMockGroup('able', 'Able Commander', [
          { id: 'ajax', name: 'Ajax Commander' },
          { id: 'alpha', name: 'Alpha Commander' },
        ]),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Commanders"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      // Should show 1 (unique) not 3 (total)
      expect(screen.getByText('1')).toBeInTheDocument()
      // Should show +2 variants badge in header (and +2 button for expand)
      // Both exist, so just check that at least one +2 is there
      expect(screen.getAllByText('+2').length).toBeGreaterThanOrEqual(1)
    })

    it('should not show variants initially', () => {
      const units = [
        createMockUnitEntry('able', 'Able Commander', ['Commander', 'Land']),
        createMockUnitEntry('ajax', 'Ajax Commander', ['Commander', 'Land']),
      ]

      const commanderGroups = [
        createMockGroup('able', 'Able Commander', [{ id: 'ajax', name: 'Ajax Commander' }]),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Commanders"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      expect(screen.getByText('Able Commander')).toBeInTheDocument()
      expect(screen.queryByText('Ajax Commander')).not.toBeInTheDocument()
    })

    it('should expand to show variants when clicked', async () => {
      const user = userEvent.setup()
      const units = [
        createMockUnitEntry('able', 'Able Commander', ['Commander', 'Land']),
        createMockUnitEntry('ajax', 'Ajax Commander', ['Commander', 'Land']),
      ]

      const commanderGroups = [
        createMockGroup('able', 'Able Commander', [{ id: 'ajax', name: 'Ajax Commander' }]),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Commanders"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      await user.click(screen.getByRole('button', { name: /show 1 variant/i }))

      expect(screen.getByText('Ajax Commander')).toBeInTheDocument()
    })

    it('should collapse variants when clicked again', async () => {
      const user = userEvent.setup()
      const units = [
        createMockUnitEntry('able', 'Able Commander', ['Commander', 'Land']),
        createMockUnitEntry('ajax', 'Ajax Commander', ['Commander', 'Land']),
      ]

      const commanderGroups = [
        createMockGroup('able', 'Able Commander', [{ id: 'ajax', name: 'Ajax Commander' }]),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Commanders"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      // Expand
      await user.click(screen.getByRole('button', { name: /show 1 variant/i }))
      expect(screen.getByText('Ajax Commander')).toBeInTheDocument()

      // Collapse
      await user.click(screen.getByRole('button', { name: /hide 1 variant/i }))
      expect(screen.queryByText('Ajax Commander')).not.toBeInTheDocument()
    })

    it('should show "(identical)" label for variants', async () => {
      const user = userEvent.setup()
      const units = [
        createMockUnitEntry('able', 'Able Commander', ['Commander', 'Land']),
        createMockUnitEntry('ajax', 'Ajax Commander', ['Commander', 'Land']),
      ]

      const commanderGroups = [
        createMockGroup('able', 'Able Commander', [{ id: 'ajax', name: 'Ajax Commander' }]),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Commanders"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      await user.click(screen.getByRole('button'))

      expect(screen.getByText('(identical)')).toBeInTheDocument()
    })

    it('should have correct aria-expanded attribute', async () => {
      const user = userEvent.setup()
      const units = [
        createMockUnitEntry('able', 'Able Commander', ['Commander', 'Land']),
        createMockUnitEntry('ajax', 'Ajax Commander', ['Commander', 'Land']),
      ]

      const commanderGroups = [
        createMockGroup('able', 'Able Commander', [{ id: 'ajax', name: 'Ajax Commander' }]),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Commanders"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('should not show expand button for commander without variants', () => {
      const units = [
        createMockUnitEntry('unique', 'Unique Commander', ['Commander', 'Land']),
      ]

      const commanderGroups = [
        createMockGroup('unique', 'Unique Commander', []),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Commanders"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      expect(screen.getByText('Unique Commander')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should not apply grouping to non-Commander categories', () => {
      const units = [
        createMockUnitEntry('tank1', 'Tank 1'),
        createMockUnitEntry('tank2', 'Tank 2'),
      ]

      // Even if commanderGroups is provided, should not affect Tanks category
      const commanderGroups = [
        createMockGroup('tank1', 'Tank 1', [{ id: 'tank2', name: 'Tank 2' }]),
      ]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          category="Tanks"
          units={units}
          commanderGroups={commanderGroups}
        />
      )

      // Both should be visible (no grouping applied)
      expect(screen.getByText('Tank 1')).toBeInTheDocument()
      expect(screen.getByText('Tank 2')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('drag handle', () => {
    it('should render drag handle when dragHandleProps provided', () => {
      const units = [createMockUnitEntry('tank1', 'Tank 1')]

      renderComponent(
        <CategoryListColumn
          {...defaultProps}
          units={units}
          dragHandleProps={{ 'aria-label': 'Drag to reorder Tanks category' }}
        />
      )

      expect(screen.getByLabelText('Drag to reorder Tanks category')).toBeInTheDocument()
    })
  })

  describe('isDragging state', () => {
    it('should apply opacity when isDragging is true', () => {
      const units = [createMockUnitEntry('tank1', 'Tank 1')]

      const { container } = renderComponent(
        <CategoryListColumn
          {...defaultProps}
          units={units}
          isDragging={true}
        />
      )

      expect(container.firstChild).toHaveClass('opacity-50')
    })
  })
})
