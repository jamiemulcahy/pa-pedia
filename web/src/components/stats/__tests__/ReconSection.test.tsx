import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReconSection } from '../ReconSection'
import type { ReconSpecs } from '@/types/faction'

const mockRecon: ReconSpecs = {
  visionRadius: 100,
  radarRadius: 200,
  sonarRadius: 150,
}

const mockCompareRecon: ReconSpecs = {
  visionRadius: 80,
  radarRadius: 250,
  sonarRadius: 150,
}

describe('ReconSection', () => {
  it('should render vision radius', () => {
    render(<ReconSection recon={mockRecon} />)

    expect(screen.getByText('Vision radius:')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('should render radar radius', () => {
    render(<ReconSection recon={mockRecon} />)

    expect(screen.getByText('Radar radius:')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('should render sonar radius', () => {
    render(<ReconSection recon={mockRecon} />)

    expect(screen.getByText('Sonar radius:')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
  })

  it('should show comparison values when compareRecon provided', () => {
    render(<ReconSection recon={mockRecon} compareRecon={mockCompareRecon} />)

    // Vision: 100 vs 80 = +20
    expect(screen.getByText('(+20)')).toBeInTheDocument()

    // Radar: 200 vs 250 = -50
    expect(screen.getByText('(-50)')).toBeInTheDocument()
  })

  it('should not show diff when values are equal', () => {
    render(<ReconSection recon={mockRecon} compareRecon={mockCompareRecon} />)

    // Sonar is equal (150), should show value but no diff
    const sonarValues = screen.getAllByText('150')
    expect(sonarValues.length).toBe(1)
  })

  it('should not show comparison values when no compareRecon', () => {
    render(<ReconSection recon={mockRecon} />)

    expect(screen.queryByText(/\([+-]/)).not.toBeInTheDocument()
  })

  it('should return null when no recon stats available', () => {
    const { container } = render(<ReconSection recon={{}} />)

    expect(container.firstChild).toBeNull()
  })

  it('should render Recon title', () => {
    render(<ReconSection recon={mockRecon} />)

    expect(screen.getByText('Recon')).toBeInTheDocument()
  })

  it('should render underwater vision radius when available', () => {
    const reconWithUnderwater: ReconSpecs = {
      ...mockRecon,
      underwaterVisionRadius: 50,
    }
    render(<ReconSection recon={reconWithUnderwater} />)

    expect(screen.getByText('Underwater vision radius:')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('should show "No underwater vision" when visionRadius exists but underwaterVisionRadius is 0', () => {
    const reconNoUnderwater: ReconSpecs = {
      visionRadius: 100,
      underwaterVisionRadius: 0,
    }
    render(<ReconSection recon={reconNoUnderwater} />)

    expect(screen.getByText('No underwater vision:')).toBeInTheDocument()
  })

  describe('showDifferencesOnly', () => {
    it('should show only rows with differences when enabled', () => {
      render(
        <ReconSection
          recon={mockRecon}
          compareRecon={mockCompareRecon}
          showDifferencesOnly={true}
        />
      )

      // Vision and Radar have differences, should be shown
      expect(screen.getByText('Vision radius:')).toBeInTheDocument()
      expect(screen.getByText('Radar radius:')).toBeInTheDocument()

      // Sonar is equal (150 vs 150), should be hidden
      expect(screen.queryByText('Sonar radius:')).not.toBeInTheDocument()
    })

    it('should return null when all values are equal and showDifferencesOnly is enabled', () => {
      const equalRecon: ReconSpecs = {
        visionRadius: 100,
        radarRadius: 200,
      }
      const { container } = render(
        <ReconSection
          recon={equalRecon}
          compareRecon={equalRecon}
          showDifferencesOnly={true}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should show all rows when showDifferencesOnly is false', () => {
      render(
        <ReconSection
          recon={mockRecon}
          compareRecon={mockCompareRecon}
          showDifferencesOnly={false}
        />
      )

      expect(screen.getByText('Vision radius:')).toBeInTheDocument()
      expect(screen.getByText('Radar radius:')).toBeInTheDocument()
      expect(screen.getByText('Sonar radius:')).toBeInTheDocument()
    })

    it('should show all rows when no compareRecon even with showDifferencesOnly', () => {
      render(
        <ReconSection
          recon={mockRecon}
          showDifferencesOnly={true}
        />
      )

      expect(screen.getByText('Vision radius:')).toBeInTheDocument()
      expect(screen.getByText('Radar radius:')).toBeInTheDocument()
      expect(screen.getByText('Sonar radius:')).toBeInTheDocument()
    })
  })
})
