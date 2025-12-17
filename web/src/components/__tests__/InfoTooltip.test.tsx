import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InfoTooltip } from '../InfoTooltip'

describe('InfoTooltip', () => {
  it('should render with tooltip text', () => {
    render(<InfoTooltip text="This is a helpful tip" />)

    // Tooltip text should be in the DOM
    expect(screen.getByRole('tooltip')).toHaveTextContent('This is a helpful tip')
  })

  it('should have screen reader text', () => {
    const { container } = render(<InfoTooltip text="Helpful information" />)

    // sr-only text should be present for accessibility
    const srOnlyElement = container.querySelector('.sr-only')
    expect(srOnlyElement).toBeInTheDocument()
    expect(srOnlyElement).toHaveTextContent('Info: Helpful information')
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

  describe('keyboard accessibility', () => {
    it('should render a focusable button', () => {
      render(<InfoTooltip text="Test" />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('type', 'button')
    })

    it('should show tooltip on focus', () => {
      render(<InfoTooltip text="Focus tooltip" />)

      const button = screen.getByRole('button')
      const tooltip = screen.getByRole('tooltip')

      expect(tooltip).toHaveClass('opacity-0')

      fireEvent.focus(button)
      expect(tooltip).toHaveClass('opacity-100')
    })

    it('should hide tooltip on blur', () => {
      render(<InfoTooltip text="Blur tooltip" />)

      const button = screen.getByRole('button')
      const tooltip = screen.getByRole('tooltip')

      fireEvent.focus(button)
      expect(tooltip).toHaveClass('opacity-100')

      fireEvent.blur(button)
      expect(tooltip).toHaveClass('opacity-0')
    })

    it('should have aria-describedby linking to tooltip', () => {
      render(<InfoTooltip text="Accessible tooltip" />)

      const button = screen.getByRole('button')
      const tooltip = screen.getByRole('tooltip')

      expect(button).toHaveAttribute('aria-describedby', 'tooltip')
      expect(tooltip).toHaveAttribute('id', 'tooltip')
    })
  })

  describe('mouse interaction', () => {
    it('should show tooltip on mouse enter', () => {
      render(<InfoTooltip text="Hover tooltip" />)

      const button = screen.getByRole('button')
      const tooltip = screen.getByRole('tooltip')

      expect(tooltip).toHaveClass('opacity-0')

      fireEvent.mouseEnter(button)
      expect(tooltip).toHaveClass('opacity-100')
    })

    it('should hide tooltip on mouse leave', () => {
      render(<InfoTooltip text="Leave tooltip" />)

      const button = screen.getByRole('button')
      const tooltip = screen.getByRole('tooltip')

      fireEvent.mouseEnter(button)
      expect(tooltip).toHaveClass('opacity-100')

      fireEvent.mouseLeave(button)
      expect(tooltip).toHaveClass('opacity-0')
    })
  })
})
