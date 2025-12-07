import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EconomySection } from '../EconomySection'
import type { EconomySpecs } from '@/types/faction'

// Mock economy data for production buildings (e.g., metal extractor)
const mockProductionEconomy: EconomySpecs = {
  buildCost: 200,
  production: {
    metal: 7,
    energy: 0,
  },
}

// Mock economy data for energy buildings (e.g., power plant)
const mockEnergyEconomy: EconomySpecs = {
  buildCost: 400,
  production: {
    metal: 0,
    energy: 600,
  },
}

// Mock economy data for storage buildings
const mockStorageEconomy: EconomySpecs = {
  buildCost: 300,
  storage: {
    metal: 1500,
    energy: 0,
  },
}

// Mock economy data for fabricators
const mockFabricatorEconomy: EconomySpecs = {
  buildCost: 150,
  buildRate: 10,
  buildRange: 60,
  buildInefficiency: 100,
  toolConsumption: {
    metal: 10,
    energy: 1000,
  },
}

// Mock economy for comparison
const mockCompareEconomy: EconomySpecs = {
  buildCost: 300,
  buildRate: 15,
  buildRange: 80,
  buildInefficiency: 80,
  toolConsumption: {
    metal: 15,
    energy: 1200,
  },
}

describe('EconomySection', () => {
  describe('Production stats', () => {
    it('should render metal production', () => {
      render(<EconomySection economy={mockProductionEconomy} />)

      expect(screen.getByText('Metal production:')).toBeInTheDocument()
      expect(screen.getByText('7/s')).toBeInTheDocument()
    })

    it('should render energy production', () => {
      render(<EconomySection economy={mockEnergyEconomy} />)

      expect(screen.getByText('Energy production:')).toBeInTheDocument()
      expect(screen.getByText('600/s')).toBeInTheDocument()
    })

    it('should not render zero production values', () => {
      render(<EconomySection economy={mockProductionEconomy} />)

      expect(screen.queryByText('Energy production:')).not.toBeInTheDocument()
    })
  })

  describe('Storage stats', () => {
    it('should render metal storage', () => {
      render(<EconomySection economy={mockStorageEconomy} />)

      expect(screen.getByText('Metal storage:')).toBeInTheDocument()
      expect(screen.getByText('1500')).toBeInTheDocument()
    })

    it('should render energy storage', () => {
      const economy: EconomySpecs = {
        buildCost: 300,
        storage: { energy: 300000 },
      }
      render(<EconomySection economy={economy} />)

      expect(screen.getByText('Energy storage:')).toBeInTheDocument()
      expect(screen.getByText('300000')).toBeInTheDocument()
    })
  })

  describe('Build arm stats', () => {
    it('should render build rate', () => {
      render(<EconomySection economy={mockFabricatorEconomy} />)

      expect(screen.getByText('Build rate:')).toBeInTheDocument()
      expect(screen.getByText('10 metal/s')).toBeInTheDocument()
    })

    it('should render build energy consumption', () => {
      render(<EconomySection economy={mockFabricatorEconomy} />)

      expect(screen.getByText('Build energy:')).toBeInTheDocument()
      expect(screen.getByText('1000 energy/s')).toBeInTheDocument()
    })

    it('should render build range', () => {
      render(<EconomySection economy={mockFabricatorEconomy} />)

      expect(screen.getByText('Build range:')).toBeInTheDocument()
      expect(screen.getByText('60')).toBeInTheDocument()
    })

    it('should render cost-effectiveness', () => {
      render(<EconomySection economy={mockFabricatorEconomy} />)

      expect(screen.getByText('Cost-effectiveness:')).toBeInTheDocument()
      // 150 / 10 = 15
      expect(screen.getByText('15 metal per metal/s')).toBeInTheDocument()
    })

    it('should render energy efficiency', () => {
      render(<EconomySection economy={mockFabricatorEconomy} />)

      expect(screen.getByText('Energy efficiency:')).toBeInTheDocument()
      expect(screen.getByText('100 energy/metal')).toBeInTheDocument()
    })
  })

  describe('Comparison mode', () => {
    it('should show comparison values for build rate', () => {
      render(
        <EconomySection
          economy={mockFabricatorEconomy}
          compareEconomy={mockCompareEconomy}
        />
      )

      // Build rate: 10 vs 15 = -5
      expect(screen.getByText('(-5 metal/s)')).toBeInTheDocument()
    })

    it('should show comparison values for build energy', () => {
      render(
        <EconomySection
          economy={mockFabricatorEconomy}
          compareEconomy={mockCompareEconomy}
        />
      )

      // Energy consumption: 1000 vs 1200 = -200 (lower is better, so this is green)
      expect(screen.getByText('(-200 energy/s)')).toBeInTheDocument()
    })

    it('should show comparison values for cost-effectiveness', () => {
      render(
        <EconomySection
          economy={mockFabricatorEconomy}
          compareEconomy={mockCompareEconomy}
        />
      )

      // Cost-effectiveness: 150/10=15 vs 300/15=20, diff = -5 (lower is better)
      expect(screen.getByText('(-5 metal per metal/s)')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('should return null when no economy stats available', () => {
      const { container } = render(<EconomySection economy={{ buildCost: 100 }} />)

      expect(container.firstChild).toBeNull()
    })

    it('should render Economy title', () => {
      render(<EconomySection economy={mockProductionEconomy} />)

      expect(screen.getByText('Economy')).toBeInTheDocument()
    })

    it('should not render build arm stats when buildRate is 0', () => {
      const economy: EconomySpecs = {
        buildCost: 100,
        buildRate: 0,
        production: { metal: 5 },
      }
      render(<EconomySection economy={economy} />)

      expect(screen.queryByText('Build rate:')).not.toBeInTheDocument()
    })
  })
})
