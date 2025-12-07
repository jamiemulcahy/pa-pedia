import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StorageSection } from '../StorageSection'
import type { StorageSpecs } from '@/types/faction'

const mockStorage: StorageSpecs = {
  unitStorage: 12,
  storedUnitType: 'unit',
}

const mockMissileStorage: StorageSpecs = {
  unitStorage: 6,
  storedUnitType: 'missile',
}

const mockCompareStorage: StorageSpecs = {
  unitStorage: 8,
  storedUnitType: 'unit',
}

describe('StorageSection', () => {
  it('should render unit storage capacity', () => {
    render(<StorageSection storage={mockStorage} />)

    expect(screen.getByText('Capacity:')).toBeInTheDocument()
    expect(screen.getByText('12 units')).toBeInTheDocument()
  })

  it('should render singular unit when capacity is 1', () => {
    const singleStorage: StorageSpecs = {
      unitStorage: 1,
      storedUnitType: 'unit',
    }
    render(<StorageSection storage={singleStorage} />)

    expect(screen.getByText('1 unit')).toBeInTheDocument()
  })

  it('should render missile storage with correct suffix', () => {
    render(<StorageSection storage={mockMissileStorage} />)

    expect(screen.getByText('6 missiles')).toBeInTheDocument()
  })

  it('should show stored type for non-unit types', () => {
    render(<StorageSection storage={mockMissileStorage} />)

    expect(screen.getByText('Stored type:')).toBeInTheDocument()
    expect(screen.getByText('missile')).toBeInTheDocument()
  })

  it('should not show stored type for generic unit type', () => {
    render(<StorageSection storage={mockStorage} />)

    expect(screen.queryByText('Stored type:')).not.toBeInTheDocument()
  })

  it('should show comparison values when compareStorage provided', () => {
    render(
      <StorageSection
        storage={mockStorage}
        compareStorage={mockCompareStorage}
      />
    )

    // Storage: 12 vs 8 = +4
    expect(screen.getByText('(+4 units)')).toBeInTheDocument()
  })

  it('should not show comparison values when no compareStorage', () => {
    render(<StorageSection storage={mockStorage} />)

    expect(screen.queryByText(/\([+-]/)).not.toBeInTheDocument()
  })

  it('should return null when unitStorage is 0', () => {
    const { container } = render(
      <StorageSection storage={{ unitStorage: 0 }} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should return null when storage is undefined', () => {
    const { container } = render(<StorageSection storage={undefined} />)

    expect(container.firstChild).toBeNull()
  })

  it('should render Unit Storage title', () => {
    render(<StorageSection storage={mockStorage} />)

    expect(screen.getByText('Unit Storage')).toBeInTheDocument()
  })

  describe('showDifferencesOnly', () => {
    it('should show capacity when values differ and showDifferencesOnly enabled', () => {
      render(
        <StorageSection
          storage={mockStorage}
          compareStorage={mockCompareStorage}
          showDifferencesOnly={true}
        />
      )

      expect(screen.getByText('Capacity:')).toBeInTheDocument()
    })

    it('should return null when all values are equal and showDifferencesOnly is enabled', () => {
      const { container } = render(
        <StorageSection
          storage={mockStorage}
          compareStorage={mockStorage}
          showDifferencesOnly={true}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should show all rows when showDifferencesOnly is false', () => {
      render(
        <StorageSection
          storage={mockStorage}
          compareStorage={mockStorage}
          showDifferencesOnly={false}
        />
      )

      expect(screen.getByText('Capacity:')).toBeInTheDocument()
    })

    it('should show all rows when no compareStorage even with showDifferencesOnly', () => {
      render(
        <StorageSection
          storage={mockStorage}
          showDifferencesOnly={true}
        />
      )

      expect(screen.getByText('Capacity:')).toBeInTheDocument()
    })
  })
})
