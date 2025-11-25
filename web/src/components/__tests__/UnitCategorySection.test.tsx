import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { UnitCategorySection } from '../UnitCategorySection'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { renderWithProviders, userEvent } from '@/tests/helpers'
import { MemoryRouter } from 'react-router-dom'
import type { UnitIndexEntry } from '@/types/faction'

const mockUnit: UnitIndexEntry = {
  identifier: 'tank',
  displayName: 'Tank',
  unitTypes: ['Mobile', 'Land', 'Tank'],
  source: 'pa',
  files: [],
  unit: {
    id: 'tank',
    resourceName: '/pa/units/land/tank/tank.json',
    displayName: 'Tank',
    unitTypes: ['Mobile', 'Land', 'Tank'],
    tier: 1,
    accessible: true,
    image: 'assets/pa/units/land/tank/tank_icon_buildbar.png',
    specs: {
      combat: { health: 100 },
      economy: { buildCost: 100 },
    },
  },
}

const mockUnits: UnitIndexEntry[] = [
  mockUnit,
  {
    ...mockUnit,
    identifier: 'bot',
    displayName: 'Bot',
    unitTypes: ['Mobile', 'Land', 'Bot'],
    unit: { ...mockUnit.unit, id: 'bot', displayName: 'Bot' },
  },
]

function renderCategorySection(props: Partial<React.ComponentProps<typeof UnitCategorySection>> = {}) {
  const defaultProps = {
    category: 'Tanks' as const,
    units: mockUnits,
    isExpanded: true,
    onToggle: vi.fn(),
    factionId: 'MLA',
    brokenImages: new Set<string>(),
    onImageError: vi.fn(),
  }

  return renderWithProviders(
    <MemoryRouter>
      <CurrentFactionProvider factionId="MLA">
        <UnitCategorySection {...defaultProps} {...props} />
      </CurrentFactionProvider>
    </MemoryRouter>,
    { skipRouter: true }
  )
}

describe('UnitCategorySection', () => {
  describe('rendering', () => {
    it('should render category header with name and count', () => {
      renderCategorySection()

      expect(screen.getByRole('heading', { name: 'Tanks' })).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // unit count
    })

    it('should render unit cards when expanded', () => {
      renderCategorySection({ isExpanded: true })

      expect(screen.getByText('Tank')).toBeInTheDocument()
      expect(screen.getByText('Bot')).toBeInTheDocument()
    })

    it('should not render unit cards when collapsed', () => {
      renderCategorySection({ isExpanded: false })

      expect(screen.queryByText('Tank')).not.toBeInTheDocument()
      expect(screen.queryByText('Bot')).not.toBeInTheDocument()
    })

    it('should return null when units array is empty', () => {
      const { container } = renderCategorySection({ units: [] })

      expect(container.querySelector('section')).not.toBeInTheDocument()
    })

    it('should render unit type badges', () => {
      renderCategorySection()

      // First two types are shown as badges
      expect(screen.getAllByText('Mobile').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Land').length).toBeGreaterThan(0)
    })
  })

  describe('expand/collapse behavior', () => {
    it('should call onToggle when header button is clicked', async () => {
      const onToggle = vi.fn()
      const user = userEvent.setup()

      renderCategorySection({ onToggle })

      const button = screen.getByRole('button', { name: /tanks/i })
      await user.click(button)

      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('should show rotated chevron when expanded', () => {
      renderCategorySection({ isExpanded: true })

      const svg = document.querySelector('svg')
      expect(svg).toHaveClass('rotate-90')
    })

    it('should show non-rotated chevron when collapsed', () => {
      renderCategorySection({ isExpanded: false })

      const svg = document.querySelector('svg')
      expect(svg).not.toHaveClass('rotate-90')
    })
  })

  describe('accessibility', () => {
    it('should have aria-expanded attribute on toggle button', () => {
      renderCategorySection({ isExpanded: true })

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('should have aria-expanded false when collapsed', () => {
      renderCategorySection({ isExpanded: false })

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('should have aria-controls pointing to category content', () => {
      renderCategorySection({ category: 'Tanks', isExpanded: true })

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-controls', 'category-Tanks')

      const content = document.getElementById('category-Tanks')
      expect(content).toBeInTheDocument()
    })

    it('should have screen reader text for expand/collapse state', () => {
      renderCategorySection({ isExpanded: true, category: 'Bots' })

      expect(screen.getByText('Collapse Bots section')).toBeInTheDocument()
    })

    it('should update screen reader text when collapsed', () => {
      renderCategorySection({ isExpanded: false, category: 'Bots' })

      expect(screen.getByText('Expand Bots section')).toBeInTheDocument()
    })

    it('should have role="list" on unit grid', () => {
      renderCategorySection({ isExpanded: true })

      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    it('should have role="listitem" on unit cards', () => {
      renderCategorySection({ isExpanded: true })

      const items = screen.getAllByRole('listitem')
      expect(items.length).toBe(2)
    })

    it('should have aria-label on unit cards', () => {
      renderCategorySection({ isExpanded: true })

      expect(screen.getByLabelText('View Tank details')).toBeInTheDocument()
      expect(screen.getByLabelText('View Bot details')).toBeInTheDocument()
    })
  })

  describe('image error handling', () => {
    it('should show "No Icon" for broken images', () => {
      renderCategorySection({
        brokenImages: new Set(['tank']),
        isExpanded: true,
      })

      expect(screen.getByText('No Icon')).toBeInTheDocument()
    })

    it('should have aria-label for broken image placeholder', () => {
      renderCategorySection({
        brokenImages: new Set(['tank']),
        isExpanded: true,
      })

      expect(screen.getByLabelText('Tank icon not available')).toBeInTheDocument()
    })
  })

  describe('links', () => {
    it('should create correct links to unit detail pages', () => {
      renderCategorySection({ factionId: 'MLA', isExpanded: true })

      const tankLink = screen.getByLabelText('View Tank details')
      expect(tankLink).toHaveAttribute('href', '/faction/MLA/unit/tank')

      const botLink = screen.getByLabelText('View Bot details')
      expect(botLink).toHaveAttribute('href', '/faction/MLA/unit/bot')
    })
  })
})
