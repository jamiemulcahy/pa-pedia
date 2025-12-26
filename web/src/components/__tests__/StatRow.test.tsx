import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatRow, StatLink } from '../StatRow'

describe('StatRow', () => {
  it('should render label and value', () => {
    render(<StatRow label="Health" value={200} />)

    expect(screen.getByText('Health:')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('should render tooltip when provided', () => {
    render(<StatRow label="DPS" value={100} tooltip="Damage per second" />)

    // Tooltip is portal-rendered and only visible on hover/focus
    const button = screen.getByRole('button')
    fireEvent.mouseEnter(button)

    expect(screen.getByRole('tooltip')).toHaveTextContent('Damage per second')
  })

  it('should not render tooltip when not provided', () => {
    render(<StatRow label="Health" value={200} />)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('should render string value', () => {
    render(<StatRow label="Status" value="Active" />)

    expect(screen.getByText('Status:')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('should render React node value', () => {
    render(
      <StatRow
        label="Link"
        value={<a href="/test">Click here</a>}
      />
    )

    expect(screen.getByText('Link:')).toBeInTheDocument()
    expect(screen.getByText('Click here')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test')
  })

  it('should apply custom className', () => {
    const { container } = render(
      <StatRow label="Test" value="value" className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should apply valueClassName to value', () => {
    render(
      <StatRow label="Test" value="value" valueClassName="text-red-500" />
    )

    const valueElement = screen.getByText('value')
    expect(valueElement).toHaveClass('text-red-500')
  })
})

describe('StatLink', () => {
  it('should render label and value', () => {
    render(<StatLink label="Builder" value="Factory" />)

    expect(screen.getByText('Builder')).toBeInTheDocument()
    expect(screen.getByText('Factory')).toBeInTheDocument()
  })

  it('should render React node value', () => {
    render(
      <StatLink
        label="Builders"
        value={
          <div>
            <a href="/factory1">Factory 1</a>
            <a href="/factory2">Factory 2</a>
          </div>
        }
      />
    )

    expect(screen.getByText('Builders')).toBeInTheDocument()
    expect(screen.getByText('Factory 1')).toBeInTheDocument()
    expect(screen.getByText('Factory 2')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <StatLink label="Test" value="value" className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
