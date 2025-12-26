import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InfoTooltip } from '../InfoTooltip'

describe('InfoTooltip', () => {
  it('should render tooltip text when visible', () => {
    render(<InfoTooltip text="This is a helpful tip" />)

    // Show tooltip first (it's portal-rendered only when visible)
    const button = screen.getByRole('button')
    fireEvent.mouseEnter(button)

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

  it('should have tooltip hidden by default (not in DOM)', () => {
    render(<InfoTooltip text="Hidden tooltip" />)

    // Tooltip is not rendered when not visible (portal only rendered when visible)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
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

      // Tooltip not in DOM initially
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

      fireEvent.focus(button)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('should hide tooltip on blur', () => {
      render(<InfoTooltip text="Blur tooltip" />)

      const button = screen.getByRole('button')

      fireEvent.focus(button)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      fireEvent.blur(button)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('should have aria-describedby linking to tooltip', () => {
      render(<InfoTooltip text="Accessible tooltip" />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'tooltip')
    })
  })

  describe('mouse interaction', () => {
    it('should show tooltip on mouse enter', () => {
      render(<InfoTooltip text="Hover tooltip" />)

      const button = screen.getByRole('button')

      // Tooltip not in DOM initially
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

      fireEvent.mouseEnter(button)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('should hide tooltip on mouse leave', () => {
      render(<InfoTooltip text="Leave tooltip" />)

      const button = screen.getByRole('button')

      fireEvent.mouseEnter(button)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      fireEvent.mouseLeave(button)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })
})
