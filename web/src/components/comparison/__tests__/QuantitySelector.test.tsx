import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QuantitySelector } from '../QuantitySelector'

describe('QuantitySelector', () => {
  it('should render the current value', () => {
    render(<QuantitySelector value={5} onChange={() => {}} />)

    const input = screen.getByLabelText('Quantity') as HTMLInputElement
    expect(input.value).toBe('5')
  })

  it('should increment value when + button clicked', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={5} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Increase quantity'))

    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('should decrement value when - button clicked', async () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={5} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Decrease quantity'))

    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('should not decrement below min (default 1)', () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={1} onChange={onChange} />)

    const decrementButton = screen.getByLabelText('Decrease quantity')
    expect(decrementButton).toBeDisabled()

    fireEvent.click(decrementButton)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('should allow typing a new value', async () => {
    const onChange = vi.fn()
    // Use debounceMs=0 for immediate callback
    render(<QuantitySelector value={5} onChange={onChange} debounceMs={0} />)

    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '10' } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(10)
    })
  })

  it('should not allow typing non-numeric values', () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={5} onChange={onChange} debounceMs={0} />)

    const input = screen.getByLabelText('Quantity') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })

    // Value should remain unchanged (non-numeric is rejected)
    expect(input.value).toBe('5')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('should enforce minimum on blur', () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={5} onChange={onChange} min={1} />)

    const input = screen.getByLabelText('Quantity')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)

    // Should reset to min value
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('should have accessible labels on buttons', () => {
    render(<QuantitySelector value={5} onChange={() => {}} />)

    expect(screen.getByLabelText('Decrease quantity')).toBeInTheDocument()
    expect(screen.getByLabelText('Increase quantity')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument()
  })

  it('should support custom min value', () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={5} onChange={onChange} min={3} />)

    // Decrement to 4
    fireEvent.click(screen.getByLabelText('Decrease quantity'))
    expect(onChange).toHaveBeenCalledWith(4)

    // Clean up and test disabled state
    cleanup()
    render(<QuantitySelector value={3} onChange={onChange} min={3} />)
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled()
  })

  it('should increment by 10 with shift+click', () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={5} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Increase quantity'), { shiftKey: true })

    expect(onChange).toHaveBeenCalledWith(15)
  })

  it('should decrement by 10 with shift+click (respecting min)', () => {
    const onChange = vi.fn()
    render(<QuantitySelector value={15} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Decrease quantity'), { shiftKey: true })

    expect(onChange).toHaveBeenCalledWith(5)
  })
})
