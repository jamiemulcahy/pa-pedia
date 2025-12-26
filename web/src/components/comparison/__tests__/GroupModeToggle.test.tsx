import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GroupModeToggle } from '../GroupModeToggle'

describe('GroupModeToggle', () => {
  it('should render both Unit and Group options', () => {
    render(<GroupModeToggle mode="unit" onModeChange={() => {}} />)

    expect(screen.getByText('Unit')).toBeInTheDocument()
    expect(screen.getByText('Group')).toBeInTheDocument()
  })

  it('should highlight Unit button when mode is unit', () => {
    render(<GroupModeToggle mode="unit" onModeChange={() => {}} />)

    const unitButton = screen.getByText('Unit')
    const groupButton = screen.getByText('Group')

    // Active button gets bg-white and shadow
    expect(unitButton).toHaveClass('bg-white')
    expect(unitButton).toHaveClass('shadow-sm')
    expect(groupButton).not.toHaveClass('bg-white')
  })

  it('should highlight Group button when mode is group', () => {
    render(<GroupModeToggle mode="group" onModeChange={() => {}} />)

    const unitButton = screen.getByText('Unit')
    const groupButton = screen.getByText('Group')

    expect(groupButton).toHaveClass('bg-white')
    expect(groupButton).toHaveClass('shadow-sm')
    expect(unitButton).not.toHaveClass('bg-white')
  })

  it('should call onModeChange with "unit" when Unit button clicked', () => {
    const onModeChange = vi.fn()
    render(<GroupModeToggle mode="group" onModeChange={onModeChange} />)

    fireEvent.click(screen.getByText('Unit'))

    expect(onModeChange).toHaveBeenCalledWith('unit')
  })

  it('should call onModeChange with "group" when Group button clicked', () => {
    const onModeChange = vi.fn()
    render(<GroupModeToggle mode="unit" onModeChange={onModeChange} />)

    fireEvent.click(screen.getByText('Group'))

    expect(onModeChange).toHaveBeenCalledWith('group')
  })

  it('should set aria-pressed attribute correctly', () => {
    render(<GroupModeToggle mode="unit" onModeChange={() => {}} />)

    const unitButton = screen.getByText('Unit')
    const groupButton = screen.getByText('Group')

    expect(unitButton).toHaveAttribute('aria-pressed', 'true')
    expect(groupButton).toHaveAttribute('aria-pressed', 'false')
  })
})
