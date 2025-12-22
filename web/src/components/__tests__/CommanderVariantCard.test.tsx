import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CommanderVariantCard } from '../CommanderVariantCard'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { renderWithProviders } from '@/tests/helpers'
import type { CommanderGroup } from '@/utils/commanderDedup'
import type { UnitIndexEntry, Unit } from '@/types/faction'

// Helper to create a minimal Unit object
function createMockUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'test-unit',
    resourceName: '/pa/units/commanders/test.json',
    displayName: 'Test Unit',
    tier: 1,
    unitTypes: ['Commander', 'Land', 'Mobile'],
    accessible: true,
    specs: {
      combat: {
        health: 12500,
        dps: 985,
        salvoDamage: 100,
        weapons: [],
      },
      economy: {
        buildCost: 0,
        buildRate: 90,
        metalRate: 20,
        energyRate: 2000,
      },
      mobility: {
        moveSpeed: 10,
        turnSpeed: 90,
        acceleration: 30,
        brake: 30,
      },
    },
    ...overrides,
  }
}

// Helper to create a minimal UnitIndexEntry
function createMockUnitEntry(
  identifier: string,
  displayName: string
): UnitIndexEntry {
  return {
    identifier,
    displayName,
    unitTypes: ['Commander', 'Land', 'Mobile'],
    source: 'base',
    files: [],
    unit: createMockUnit({ id: identifier, displayName }),
  }
}

// Helper to create a CommanderGroup
function createMockGroup(
  representativeId: string,
  representativeName: string,
  variantIds: Array<{ id: string; name: string }> = []
): CommanderGroup {
  return {
    representative: createMockUnitEntry(representativeId, representativeName),
    variants: variantIds.map(v => createMockUnitEntry(v.id, v.name)),
    statsHash: 'test-hash-123',
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

describe('CommanderVariantCard', () => {
  const defaultProps = {
    factionId: 'MLA',
    brokenImages: new Set<string>(),
    onImageError: vi.fn(),
  }

  describe('without variants', () => {
    it('should render representative without expand button', () => {
      const group = createMockGroup('able', 'Able Commander')

      renderComponent(
        <CommanderVariantCard group={group} {...defaultProps} />
      )

      expect(screen.getByText('Able Commander')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should link to unit detail page', () => {
      const group = createMockGroup('able', 'Able Commander')

      renderComponent(
        <CommanderVariantCard group={group} {...defaultProps} />
      )

      const card = screen.getByRole('listitem', { name: /view able commander details/i })
      expect(card).toHaveAttribute('href', '/faction/MLA/unit/able')
    })
  })

  describe('with variants', () => {
    it('should show expand button with variant count', () => {
      const group = createMockGroup('able', 'Able Commander', [
        { id: 'ajax', name: 'Ajax Commander' },
        { id: 'alpha', name: 'Alpha Commander' },
      ])

      renderComponent(
        <CommanderVariantCard group={group} {...defaultProps} />
      )

      const button = screen.getByRole('button', { name: /show 2 commander variants/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('+2 variants')
    })

    it('should expand to show variants when clicked', async () => {
      const user = userEvent.setup()
      const group = createMockGroup('able', 'Able Commander', [
        { id: 'ajax', name: 'Ajax Commander' },
      ])

      renderComponent(
        <CommanderVariantCard group={group} {...defaultProps} />
      )

      // Initially variant should not be visible
      expect(screen.queryByText('Ajax Commander')).not.toBeInTheDocument()

      // Click expand button
      const button = screen.getByRole('button', { name: /show 1 commander variant/i })
      await user.click(button)

      // Variant should now be visible
      expect(screen.getByText('Ajax Commander')).toBeInTheDocument()
    })

    it('should collapse variants when clicked again', async () => {
      const user = userEvent.setup()
      const group = createMockGroup('able', 'Able Commander', [
        { id: 'ajax', name: 'Ajax Commander' },
      ])

      renderComponent(
        <CommanderVariantCard group={group} {...defaultProps} />
      )

      // Expand
      const button = screen.getByRole('button', { name: /show 1 commander variant/i })
      await user.click(button)
      expect(screen.getByText('Ajax Commander')).toBeInTheDocument()

      // Collapse
      const hideButton = screen.getByRole('button', { name: /hide 1 commander variant/i })
      await user.click(hideButton)

      // Variant should be hidden again
      expect(screen.queryByText('Ajax Commander')).not.toBeInTheDocument()
    })

    it('should have correct aria-expanded attribute', async () => {
      const user = userEvent.setup()
      const group = createMockGroup('able', 'Able Commander', [
        { id: 'ajax', name: 'Ajax Commander' },
      ])

      renderComponent(
        <CommanderVariantCard group={group} {...defaultProps} />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')

      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('should show "(identical stats)" label for variants', async () => {
      const user = userEvent.setup()
      const group = createMockGroup('able', 'Able Commander', [
        { id: 'ajax', name: 'Ajax Commander' },
      ])

      renderComponent(
        <CommanderVariantCard group={group} {...defaultProps} />
      )

      await user.click(screen.getByRole('button'))

      expect(screen.getByText('(identical stats)')).toBeInTheDocument()
    })

    it('should render variants with dashed border styling', async () => {
      const user = userEvent.setup()
      const group = createMockGroup('able', 'Able Commander', [
        { id: 'ajax', name: 'Ajax Commander' },
      ])

      renderComponent(
        <CommanderVariantCard group={group} {...defaultProps} />
      )

      await user.click(screen.getByRole('button'))

      // Check for the variant card (has role="listitem" and contains the variant name)
      const listItems = screen.getAllByRole('listitem')
      const variantItem = listItems.find(item => item.textContent?.includes('Ajax Commander'))
      // Variants have border-dashed class
      expect(variantItem?.className).toContain('border-dashed')
    })
  })

  describe('showFactionBadge mode', () => {
    it('should include from=all in links when showFactionBadge is true', () => {
      const group = createMockGroup('able', 'Able Commander')

      renderComponent(
        <CommanderVariantCard
          group={group}
          {...defaultProps}
          showFactionBadge
        />
      )

      // The card is rendered as a link with role="listitem"
      const card = screen.getByRole('listitem', { name: /view able commander details/i })
      expect(card).toHaveAttribute('href', '/faction/MLA/unit/able?from=all')
    })
  })
})
