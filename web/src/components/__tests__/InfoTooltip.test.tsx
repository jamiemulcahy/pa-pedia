import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InfoTooltip } from '../InfoTooltip'

describe('InfoTooltip', () => {
  it('should render with tooltip text', () => {
    render(<InfoTooltip text="This is a helpful tip" />)

    // Tooltip text should be in the DOM (for screen readers and on hover)
    expect(screen.getByRole('tooltip')).toHaveTextContent('This is a helpful tip')
  })

  it('should have screen reader text', () => {
    const { container } = render(<InfoTooltip text="Helpful information" />)

    // sr-only text should be present for accessibility
    const srOnlyElement = container.querySelector('.sr-only')
    expect(srOnlyElement).toBeInTheDocument()
    expect(srOnlyElement).toHaveTextContent('Helpful information')
  })

  it('should render the info icon', () => {
    const { container } = render(<InfoTooltip text="Test" />)

    // SVG icon should be present
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <InfoTooltip text="Test" className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should have tooltip hidden by default (opacity-0)', () => {
    render(<InfoTooltip text="Hidden tooltip" />)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveClass('opacity-0')
  })
})
