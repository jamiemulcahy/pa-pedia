import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Footer } from '../Footer'
import { renderWithProviders } from '@/tests/helpers'

describe('Footer', () => {
  it('links to the privacy policy from every page', () => {
    renderWithProviders(<Footer />)
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy')
  })

  it('links to the project repository in a safe new tab', () => {
    renderWithProviders(<Footer />)
    const github = screen.getByRole('link', { name: /github/i })
    expect(github).toHaveAttribute('href', 'https://github.com/jamiemulcahy/pa-pedia')
    expect(github).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('carries the unaffiliated disclaimer', () => {
    renderWithProviders(<Footer />)
    expect(screen.getByText(/not affiliated with planetary annihilation inc/i)).toBeInTheDocument()
  })
})
