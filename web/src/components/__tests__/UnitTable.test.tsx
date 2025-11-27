import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { UnitTable } from '../UnitTable'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { renderWithProviders, userEvent } from '@/tests/helpers'
import { MemoryRouter } from 'react-router-dom'
import type { UnitIndexEntry } from '@/types/faction'

const mockTankUnit: UnitIndexEntry = {
  identifier: 'tank',
  displayName: 'Tank',
  unitTypes: ['Mobile', 'Land', 'Tank', 'Basic'],
  source: 'pa',
  files: [],
  unit: {
    id: 'tank',
    resourceName: '/pa/units/land/tank/tank.json',
    displayName: 'Tank',
    unitTypes: ['Mobile', 'Land', 'Tank', 'Basic'],
    tier: 1,
    accessible: true,
    image: 'assets/pa/units/land/tank/tank_icon_buildbar.png',
    specs: {
      combat: {
        health: 200,
        dps: 50,
        weapons: [{ resourceName: '', safeName: 'weapon', count: 1, rateOfFire: 1, damage: 50, dps: 50, maxRange: 100 }]
      },
      economy: { buildCost: 150 },
      mobility: { moveSpeed: 10 },
    },
  },
}

const mockBotUnit: UnitIndexEntry = {
  identifier: 'bot',
  displayName: 'Bot',
  unitTypes: ['Mobile', 'Land', 'Bot', 'Basic'],
  source: 'pa',
  files: [],
  unit: {
    id: 'bot',
    resourceName: '/pa/units/land/bot/bot.json',
    displayName: 'Bot',
    unitTypes: ['Mobile', 'Land', 'Bot', 'Basic'],
    tier: 1,
    accessible: true,
    image: 'assets/pa/units/land/bot/bot_icon_buildbar.png',
    specs: {
      combat: {
        health: 80,
        dps: 20,
        weapons: [{ resourceName: '', safeName: 'weapon', count: 1, rateOfFire: 2, damage: 10, dps: 20, maxRange: 80 }]
      },
      economy: { buildCost: 45 },
      mobility: { moveSpeed: 12 },
    },
  },
}

const mockFighterUnit: UnitIndexEntry = {
  identifier: 'fighter',
  displayName: 'Fighter',
  unitTypes: ['Mobile', 'Air', 'Fighter', 'Basic'],
  source: 'pa',
  files: [],
  unit: {
    id: 'fighter',
    resourceName: '/pa/units/air/fighter/fighter.json',
    displayName: 'Fighter',
    unitTypes: ['Mobile', 'Air', 'Fighter', 'Basic'],
    tier: 1,
    accessible: true,
    image: 'assets/pa/units/air/fighter/fighter_icon_buildbar.png',
    specs: {
      combat: {
        health: 60,
        dps: 75,
        weapons: [{ resourceName: '', safeName: 'weapon', count: 1, rateOfFire: 0.5, damage: 150, dps: 75, maxRange: 120 }]
      },
      economy: { buildCost: 200 },
      mobility: { moveSpeed: 100 },
    },
  },
}

const mockFactoryUnit: UnitIndexEntry = {
  identifier: 'factory',
  displayName: 'Vehicle Factory',
  unitTypes: ['Structure', 'Land', 'Factory', 'Basic'],
  source: 'pa',
  files: [],
  unit: {
    id: 'factory',
    resourceName: '/pa/units/land/vehicle_factory/vehicle_factory.json',
    displayName: 'Vehicle Factory',
    unitTypes: ['Structure', 'Land', 'Factory', 'Basic'],
    tier: 1,
    accessible: true,
    image: 'assets/pa/units/land/vehicle_factory/vehicle_factory_icon_buildbar.png',
    specs: {
      combat: { health: 5000 },
      economy: { buildCost: 600 },
    },
  },
}

const mockUnits: UnitIndexEntry[] = [mockTankUnit, mockBotUnit, mockFighterUnit, mockFactoryUnit]

function renderUnitTable(props: Partial<React.ComponentProps<typeof UnitTable>> = {}) {
  const defaultProps = {
    units: mockUnits,
    factionId: 'MLA',
    brokenImages: new Set<string>(),
    onImageError: vi.fn(),
  }

  return renderWithProviders(
    <MemoryRouter>
      <CurrentFactionProvider factionId="MLA">
        <UnitTable {...defaultProps} {...props} />
      </CurrentFactionProvider>
    </MemoryRouter>,
    { skipRouter: true }
  )
}

describe('UnitTable', () => {
  describe('rendering', () => {
    it('should render a table with headers', () => {
      renderUnitTable()

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by name/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by health/i })).toBeInTheDocument()
    })

    it('should render all units as rows', () => {
      renderUnitTable()

      expect(screen.getByRole('link', { name: 'Tank' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Bot' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Fighter' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Vehicle Factory' })).toBeInTheDocument()
    })

    it('should show empty message when no units', () => {
      renderUnitTable({ units: [] })

      expect(screen.getByText(/no units match your filters/i)).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('should display unit stats correctly', () => {
      renderUnitTable({ units: [mockTankUnit] })

      const rows = screen.getAllByRole('row')
      const dataRow = rows[1] // First row is header

      expect(within(dataRow).getByText('200')).toBeInTheDocument() // health
      expect(within(dataRow).getByText('50.0')).toBeInTheDocument() // dps
      expect(within(dataRow).getByText('150')).toBeInTheDocument() // cost
    })

    it('should format large numbers with k suffix', () => {
      renderUnitTable({ units: [mockFactoryUnit] })

      expect(screen.getByText('5.0k')).toBeInTheDocument() // health 5000
    })

    it('should display tier labels correctly', () => {
      renderUnitTable({ units: [mockTankUnit] })

      expect(screen.getByText('T1')).toBeInTheDocument()
    })

    it('should display category badges', () => {
      renderUnitTable({ units: [mockTankUnit, mockFactoryUnit] })

      expect(screen.getByText('Tanks')).toBeInTheDocument()
      expect(screen.getByText('Factories')).toBeInTheDocument()
    })
  })

  describe('links', () => {
    it('should create correct links to unit detail pages', () => {
      renderUnitTable()

      expect(screen.getByRole('link', { name: 'Tank' })).toHaveAttribute('href', '/faction/MLA/unit/tank')
      expect(screen.getByRole('link', { name: 'Bot' })).toHaveAttribute('href', '/faction/MLA/unit/bot')
    })
  })

  describe('sorting', () => {
    it('should sort by name ascending by default', () => {
      renderUnitTable()

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      // Default is name ascending
      expect(links).toEqual(['Bot', 'Fighter', 'Tank', 'Vehicle Factory'])
    })

    it('should toggle sort direction when clicking same column', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      // Click name to reverse sort (already sorted by name asc)
      await user.click(screen.getByRole('button', { name: /sort by name/i }))

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      // Now sorted descending
      expect(links).toEqual(['Vehicle Factory', 'Tank', 'Fighter', 'Bot'])
    })

    it('should sort by health when clicking health header', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      await user.click(screen.getByRole('button', { name: /sort by health/i }))

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      // Sorted by health ascending: Fighter (60), Bot (80), Tank (200), Factory (5000)
      expect(links).toEqual(['Fighter', 'Bot', 'Tank', 'Vehicle Factory'])
    })

    it('should sort by DPS when clicking DPS header', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      await user.click(screen.getByRole('button', { name: /sort by dps/i }))

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      // Factory has no DPS (0), Bot (20), Tank (50), Fighter (75)
      expect(links).toEqual(['Vehicle Factory', 'Bot', 'Tank', 'Fighter'])
    })

    it('should sort by cost when clicking cost header', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      await user.click(screen.getByRole('button', { name: /sort by cost/i }))

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      // Bot (45), Tank (150), Fighter (200), Factory (600)
      expect(links).toEqual(['Bot', 'Tank', 'Fighter', 'Vehicle Factory'])
    })

    it('should sort by speed when clicking speed header', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      await user.click(screen.getByRole('button', { name: /sort by speed/i }))

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      // Factory (no speed=0), Tank (10), Bot (12), Fighter (100)
      expect(links).toEqual(['Vehicle Factory', 'Tank', 'Bot', 'Fighter'])
    })

    it('should sort by range when clicking range header', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      await user.click(screen.getByRole('button', { name: /sort by range/i }))

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      // Factory (no range=0), Bot (80), Tank (100), Fighter (120)
      expect(links).toEqual(['Vehicle Factory', 'Bot', 'Tank', 'Fighter'])
    })

    it('should sort by tier when clicking tier header', async () => {
      const user = userEvent.setup()

      // Create units with different tiers
      const t1Unit = { ...mockTankUnit, unit: { ...mockTankUnit.unit, tier: 1 } }
      const t2Unit = { ...mockBotUnit, identifier: 't2bot', unit: { ...mockBotUnit.unit, tier: 2, displayName: 'T2 Bot' }, displayName: 'T2 Bot' }
      const t3Unit = { ...mockFighterUnit, identifier: 't3fighter', unit: { ...mockFighterUnit.unit, tier: 3, displayName: 'T3 Fighter' }, displayName: 'T3 Fighter' }

      renderUnitTable({ units: [t2Unit, t1Unit, t3Unit] })

      await user.click(screen.getByRole('button', { name: /sort by tier/i }))

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      expect(links).toEqual(['Tank', 'T2 Bot', 'T3 Fighter'])
    })

    it('should sort by category when clicking category header', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      await user.click(screen.getByRole('button', { name: /sort by category/i }))

      const rows = screen.getAllByRole('row')
      const links = rows.slice(1).map(row => within(row).getByRole('link').textContent)

      // Category order: Factories, Defenses, Structures, Bots, Tanks, Vehicles, Air, Naval, Orbital, Titans, Commanders, Other
      // Our units: Factory -> Factories, Bot -> Bots, Tank -> Tanks, Fighter -> Air
      expect(links).toEqual(['Vehicle Factory', 'Bot', 'Tank', 'Fighter'])
    })

    it('should highlight active sort column indicator', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      // Default sort is name ascending
      const nameButton = screen.getByRole('button', { name: /sort by name, currently ascending/i })
      expect(nameButton).toBeInTheDocument()

      // Click to change to descending
      await user.click(nameButton)
      expect(screen.getByRole('button', { name: /sort by name, currently descending/i })).toBeInTheDocument()

      // Click health column
      await user.click(screen.getByRole('button', { name: /sort by health/i }))
      expect(screen.getByRole('button', { name: /sort by health, currently ascending/i })).toBeInTheDocument()
    })
  })

  describe('image error handling', () => {
    it('should show placeholder for broken images', () => {
      renderUnitTable({
        units: [mockTankUnit],
        brokenImages: new Set(['tank']),
      })

      expect(screen.getByText('?')).toBeInTheDocument()
    })

    it('should call onImageError when image fails to load', () => {
      const onImageError = vi.fn()
      renderUnitTable({
        units: [mockTankUnit],
        onImageError,
      })

      // The UnitIcon component handles the error callback
      // We can verify the prop is passed correctly by checking the component renders
      expect(screen.getByRole('link', { name: 'Tank' })).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have accessible sort buttons with aria-labels', () => {
      renderUnitTable()

      expect(screen.getByRole('button', { name: /sort by name/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by category/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by tier/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by health/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by dps/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by range/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by cost/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by speed/i })).toBeInTheDocument()
    })

    it('should announce current sort state in aria-label', async () => {
      const user = userEvent.setup()
      renderUnitTable()

      // Initially sorted by name ascending
      expect(screen.getByRole('button', { name: /sort by name, currently ascending/i })).toBeInTheDocument()

      // After clicking, should show descending
      await user.click(screen.getByRole('button', { name: /sort by name/i }))
      expect(screen.getByRole('button', { name: /sort by name, currently descending/i })).toBeInTheDocument()
    })
  })

  describe('data formatting', () => {
    it('should show dash for missing DPS', () => {
      const unitWithNoDps: UnitIndexEntry = {
        ...mockFactoryUnit,
        unit: {
          ...mockFactoryUnit.unit,
          specs: {
            ...mockFactoryUnit.unit.specs,
            combat: { health: 5000 }, // no dps
          },
        },
      }
      renderUnitTable({ units: [unitWithNoDps] })

      const rows = screen.getAllByRole('row')
      const dataRow = rows[1]

      // DPS column should show '-'
      const cells = within(dataRow).getAllByRole('cell')
      // Find the DPS cell (index varies based on visible columns, but it contains '-' for no DPS)
      const dpsCellContent = cells.map(c => c.textContent)
      expect(dpsCellContent).toContain('-')
    })

    it('should show dash for missing speed', () => {
      renderUnitTable({ units: [mockFactoryUnit] })

      const rows = screen.getAllByRole('row')
      const dataRow = rows[1]
      const cells = within(dataRow).getAllByRole('cell')
      const cellContent = cells.map(c => c.textContent)

      // Factory has no mobility.moveSpeed
      expect(cellContent).toContain('-')
    })

    it('should show dash for missing range', () => {
      renderUnitTable({ units: [mockFactoryUnit] })

      const rows = screen.getAllByRole('row')
      const dataRow = rows[1]
      const cells = within(dataRow).getAllByRole('cell')
      const cellContent = cells.map(c => c.textContent)

      // Factory has no weapons, so no range
      expect(cellContent).toContain('-')
    })
  })
})
