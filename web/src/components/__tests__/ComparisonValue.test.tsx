import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComparisonValue } from '../ComparisonValue'

describe('ComparisonValue', () => {
  it('should render value without comparison when no compareValue provided', () => {
    render(<ComparisonValue value={100} />)

    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.queryByText(/[+-]/)).not.toBeInTheDocument()
  })

  it('should render value with suffix', () => {
    render(<ComparisonValue value={50} suffix="m" />)

    expect(screen.getByText('50m')).toBeInTheDocument()
  })

  it('should not show diff when values are equal', () => {
    render(<ComparisonValue value={100} compareValue={100} />)

    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.queryByText(/[+-]/)).not.toBeInTheDocument()
  })

  it('should show positive diff with higher-better type in green', () => {
    render(
      <ComparisonValue
        value={150}
        compareValue={100}
        comparisonType="higher-better"
      />
    )

    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('(+50)')).toBeInTheDocument()
    expect(screen.getByText('(+50)')).toHaveClass('text-green-600')
  })

  it('should show negative diff with higher-better type in red', () => {
    render(
      <ComparisonValue
        value={50}
        compareValue={100}
        comparisonType="higher-better"
      />
    )

    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('(-50)')).toBeInTheDocument()
    expect(screen.getByText('(-50)')).toHaveClass('text-red-600')
  })

  it('should show positive diff with lower-better type in red', () => {
    render(
      <ComparisonValue
        value={150}
        compareValue={100}
        comparisonType="lower-better"
      />
    )

    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('(+50)')).toBeInTheDocument()
    expect(screen.getByText('(+50)')).toHaveClass('text-red-600')
  })

  it('should show negative diff with lower-better type in green', () => {
    render(
      <ComparisonValue
        value={50}
        compareValue={100}
        comparisonType="lower-better"
      />
    )

    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('(-50)')).toBeInTheDocument()
    expect(screen.getByText('(-50)')).toHaveClass('text-green-600')
  })

  it('should show neutral diff without color', () => {
    render(
      <ComparisonValue
        value={150}
        compareValue={100}
        comparisonType="neutral"
      />
    )

    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('(+50)')).toBeInTheDocument()
    expect(screen.getByText('(+50)')).toHaveClass('text-gray-500')
  })

  it('should use custom formatDiff function', () => {
    render(
      <ComparisonValue
        value={1500}
        compareValue={1000}
        comparisonType="higher-better"
        formatDiff={(d) => Math.abs(d).toLocaleString()}
      />
    )

    expect(screen.getByText('1500')).toBeInTheDocument()
    expect(screen.getByText('(+500)')).toBeInTheDocument()
  })

  it('should handle decimal values', () => {
    render(
      <ComparisonValue
        value={10.5}
        compareValue={10}
        comparisonType="higher-better"
      />
    )

    expect(screen.getByText('10.5')).toBeInTheDocument()
    expect(screen.getByText('(+0.5)')).toBeInTheDocument()
  })

  it('should include suffix in diff display', () => {
    render(
      <ComparisonValue
        value={150}
        compareValue={100}
        comparisonType="higher-better"
        suffix="/s"
      />
    )

    expect(screen.getByText('150/s')).toBeInTheDocument()
    expect(screen.getByText('(+50/s)')).toBeInTheDocument()
  })

  it('should handle string values without comparison', () => {
    render(<ComparisonValue value="N/A" compareValue={100} />)

    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.queryByText(/[+-]/)).not.toBeInTheDocument()
  })
})
