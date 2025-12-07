import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhysicsSection } from '../PhysicsSection'
import type { MobilitySpecs, SpecialSpecs } from '@/types/faction'

const mockMobility: MobilitySpecs = {
  moveSpeed: 15,
  acceleration: 30,
  brake: 30,
  turnSpeed: 90,
}

const mockCompareMobility: MobilitySpecs = {
  moveSpeed: 10,
  acceleration: 20,
  brake: 40,
  turnSpeed: 90,
}

const mockSpecial: SpecialSpecs = {
  amphibious: true,
  hover: false,
}

describe('PhysicsSection', () => {
  it('should render max speed', () => {
    render(<PhysicsSection mobility={mockMobility} />)

    expect(screen.getByText('Max speed:')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('should render acceleration', () => {
    render(<PhysicsSection mobility={mockMobility} />)

    expect(screen.getByText('Acceleration:')).toBeInTheDocument()
    // Value appears multiple times (acceleration and brake both 30)
    expect(screen.getAllByText('30').length).toBeGreaterThanOrEqual(1)
  })

  it('should render braking rate', () => {
    render(<PhysicsSection mobility={mockMobility} />)

    expect(screen.getByText('Braking rate:')).toBeInTheDocument()
    // Value appears multiple times (acceleration and brake both 30)
    expect(screen.getAllByText('30').length).toBeGreaterThanOrEqual(1)
  })

  it('should render turn rate', () => {
    render(<PhysicsSection mobility={mockMobility} />)

    expect(screen.getByText('Turn rate:')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('should render amphibious when true', () => {
    render(<PhysicsSection mobility={mockMobility} special={mockSpecial} />)

    expect(screen.getByText('Amphibious:')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('should not render hover when false', () => {
    render(<PhysicsSection mobility={mockMobility} special={mockSpecial} />)

    expect(screen.queryByText('Hover:')).not.toBeInTheDocument()
  })

  it('should show comparison values when compareMobility provided', () => {
    render(
      <PhysicsSection
        mobility={mockMobility}
        compareMobility={mockCompareMobility}
      />
    )

    // Speed: 15 vs 10 = +5
    expect(screen.getByText('(+5)')).toBeInTheDocument()

    // Acceleration: 30 vs 20 = +10
    expect(screen.getByText('(+10)')).toBeInTheDocument()

    // Brake: 30 vs 40 = -10
    expect(screen.getByText('(-10)')).toBeInTheDocument()
  })

  it('should not show comparison values when no compareMobility', () => {
    render(<PhysicsSection mobility={mockMobility} />)

    expect(screen.queryByText(/\([+-]/)).not.toBeInTheDocument()
  })

  it('should return null when no stats available', () => {
    const { container } = render(<PhysicsSection mobility={{}} />)

    expect(container.firstChild).toBeNull()
  })

  it('should render when only compare unit has stats', () => {
    // This unit has no mobility stats, but compare unit does
    render(
      <PhysicsSection
        mobility={{}}
        compareMobility={mockCompareMobility}
      />
    )

    // Should still render since compare has data
    expect(screen.getByText('Physics')).toBeInTheDocument()
  })

  it('should render Physics title', () => {
    render(<PhysicsSection mobility={mockMobility} />)

    expect(screen.getByText('Physics')).toBeInTheDocument()
  })

  describe('showDifferencesOnly', () => {
    it('should show only rows with differences when enabled', () => {
      render(
        <PhysicsSection
          mobility={mockMobility}
          compareMobility={mockCompareMobility}
          showDifferencesOnly={true}
        />
      )

      // Speed, Acceleration, Brake have differences
      expect(screen.getByText('Max speed:')).toBeInTheDocument()
      expect(screen.getByText('Acceleration:')).toBeInTheDocument()
      expect(screen.getByText('Braking rate:')).toBeInTheDocument()

      // Turn rate is equal (90 vs 90), should be hidden
      expect(screen.queryByText('Turn rate:')).not.toBeInTheDocument()
    })

    it('should return null when all values are equal and showDifferencesOnly is enabled', () => {
      const { container } = render(
        <PhysicsSection
          mobility={mockMobility}
          compareMobility={mockMobility}
          showDifferencesOnly={true}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should show all rows when showDifferencesOnly is false', () => {
      render(
        <PhysicsSection
          mobility={mockMobility}
          compareMobility={mockCompareMobility}
          showDifferencesOnly={false}
        />
      )

      expect(screen.getByText('Max speed:')).toBeInTheDocument()
      expect(screen.getByText('Acceleration:')).toBeInTheDocument()
      expect(screen.getByText('Braking rate:')).toBeInTheDocument()
      expect(screen.getByText('Turn rate:')).toBeInTheDocument()
    })

    it('should show all rows when no compareMobility even with showDifferencesOnly', () => {
      render(
        <PhysicsSection
          mobility={mockMobility}
          showDifferencesOnly={true}
        />
      )

      expect(screen.getByText('Max speed:')).toBeInTheDocument()
      expect(screen.getByText('Acceleration:')).toBeInTheDocument()
      expect(screen.getByText('Braking rate:')).toBeInTheDocument()
      expect(screen.getByText('Turn rate:')).toBeInTheDocument()
    })
  })
})
