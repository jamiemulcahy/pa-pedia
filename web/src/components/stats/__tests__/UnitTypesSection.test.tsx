import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnitTypesSection } from '../UnitTypesSection'

describe('UnitTypesSection', () => {
  it('should render unit types', () => {
    render(<UnitTypesSection unitTypes={['Land', 'Mobile', 'Tank']} />)

    expect(screen.getByText('Unit Types')).toBeInTheDocument()
    expect(screen.getByText('Land')).toBeInTheDocument()
    expect(screen.getByText('Mobile')).toBeInTheDocument()
    expect(screen.getByText('Tank')).toBeInTheDocument()
  })

  it('should return null when no unitTypes provided', () => {
    const { container } = render(<UnitTypesSection unitTypes={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('should sort types alphabetically', () => {
    render(<UnitTypesSection unitTypes={['Tank', 'Air', 'Mobile']} />)

    const badges = screen.getAllByText(/Air|Mobile|Tank/)
    expect(badges[0]).toHaveTextContent('Air')
    expect(badges[1]).toHaveTextContent('Mobile')
    expect(badges[2]).toHaveTextContent('Tank')
  })

  describe('showDifferencesOnly', () => {
    it('should show section when types differ', () => {
      render(
        <UnitTypesSection
          unitTypes={['Land', 'Mobile']}
          compareUnitTypes={['Air', 'Mobile']}
          showDifferencesOnly={true}
        />
      )

      expect(screen.getByText('Unit Types')).toBeInTheDocument()
    })

    it('should return null when types are identical and showDifferencesOnly is enabled', () => {
      const { container } = render(
        <UnitTypesSection
          unitTypes={['Land', 'Mobile']}
          compareUnitTypes={['Land', 'Mobile']}
          showDifferencesOnly={true}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should show all types when showDifferencesOnly is false', () => {
      render(
        <UnitTypesSection
          unitTypes={['Land', 'Mobile']}
          compareUnitTypes={['Land', 'Mobile']}
          showDifferencesOnly={false}
        />
      )

      expect(screen.getByText('Unit Types')).toBeInTheDocument()
    })

    it('should show all types when no compareUnitTypes even with showDifferencesOnly', () => {
      render(
        <UnitTypesSection
          unitTypes={['Land', 'Mobile']}
          showDifferencesOnly={true}
        />
      )

      expect(screen.getByText('Unit Types')).toBeInTheDocument()
    })
  })

  describe('isComparisonSide', () => {
    it('should show + indicator for types only in comparison unit', () => {
      render(
        <UnitTypesSection
          unitTypes={['Land', 'Mobile', 'Air']}
          compareUnitTypes={['Land', 'Mobile']}
          isComparisonSide={true}
        />
      )

      // Air is only in comparison (this) unit, should show + prefix
      expect(screen.getByText('+')).toBeInTheDocument()
      expect(screen.getByText('Air')).toBeInTheDocument()
    })

    it('should show - indicator for types only in primary unit', () => {
      render(
        <UnitTypesSection
          unitTypes={['Land', 'Mobile']}
          compareUnitTypes={['Land', 'Mobile', 'Naval']}
          isComparisonSide={true}
        />
      )

      // Naval is only in primary (compare) unit, should show - prefix
      expect(screen.getByText('−')).toBeInTheDocument()
      expect(screen.getByText('Naval')).toBeInTheDocument()
    })

    it('should show merged list with all types on comparison side', () => {
      render(
        <UnitTypesSection
          unitTypes={['Land']}
          compareUnitTypes={['Air']}
          isComparisonSide={true}
        />
      )

      // Should show both types
      expect(screen.getByText('Air')).toBeInTheDocument()
      expect(screen.getByText('Land')).toBeInTheDocument()
    })

    it('should not show indicators on primary side', () => {
      render(
        <UnitTypesSection
          unitTypes={['Land', 'Mobile']}
          compareUnitTypes={['Air', 'Mobile']}
          isComparisonSide={false}
        />
      )

      expect(screen.queryByText('+')).not.toBeInTheDocument()
      expect(screen.queryByText('−')).not.toBeInTheDocument()
    })

    it('should apply green styling to added types', () => {
      render(
        <UnitTypesSection
          unitTypes={['Air']}
          compareUnitTypes={['Land']}
          isComparisonSide={true}
        />
      )

      // Find the badge containing Air (the added type)
      const airBadge = screen.getByText('Air').closest('span')
      expect(airBadge).toHaveClass('bg-green-100')
    })

    it('should apply red styling to removed types', () => {
      render(
        <UnitTypesSection
          unitTypes={['Air']}
          compareUnitTypes={['Land']}
          isComparisonSide={true}
        />
      )

      // Find the badge containing Land (the removed type)
      const landBadge = screen.getByText('Land').closest('span')
      expect(landBadge).toHaveClass('bg-red-100')
    })
  })
})
