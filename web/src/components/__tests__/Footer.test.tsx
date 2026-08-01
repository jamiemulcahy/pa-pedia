import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Footer } from '../Footer'
import { renderWithProviders } from '@/tests/helpers'

describe('Footer', () => {
  it('links to the privacy policy from every page', () => {
    renderWithProviders(<Footer />)
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy')
  })

  // The header already carries GitHub and the CLI download. Duplicating them
  // here would compete with the one link this footer exists to surface.
  it('stays a single-link footer', () => {
    renderWithProviders(<Footer />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('carries the unaffiliated disclaimer', () => {
    renderWithProviders(<Footer />)
    expect(screen.getByText(/not affiliated with planetary annihilation inc/i)).toBeInTheDocument()
  })
})
