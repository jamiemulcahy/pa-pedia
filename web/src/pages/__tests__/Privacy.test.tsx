import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Privacy } from '../Privacy'
import { renderWithProviders } from '@/tests/helpers'

describe('Privacy', () => {
  it('renders the page heading', () => {
    renderWithProviders(<Privacy />)
    expect(screen.getByRole('heading', { level: 1, name: /privacy/i })).toBeInTheDocument()
  })

  it('states the core position: no cookies, accounts, ads or tracking', () => {
    renderWithProviders(<Privacy />)
    const summary = screen.getByText(/does not use cookies/i)
    expect(summary).toBeInTheDocument()
    expect(summary.textContent).toMatch(/does not require an account/i)
    expect(summary.textContent).toMatch(/no advertising or cross-site tracking/i)
  })

  /**
   * Art. 13(1)(e) requires the recipients of personal data to be disclosed, so
   * naming the processors is the one piece of detail this notice cannot trade
   * away for brevity. A new processor added without appearing here is an
   * undisclosed recipient.
   */
  it('names every processor that receives visitor data', () => {
    renderWithProviders(<Privacy />)
    const recipients = screen.getByText(/hosted by Cloudflare/i)
    expect(recipients.textContent).toMatch(/Sentry/)
  })

  it('records that analytics is cookieless', () => {
    renderWithProviders(<Privacy />)
    expect(screen.getByText(/cookieless/i)).toBeInTheDocument()
  })

  it('tells visitors how to erase what is held on their device', () => {
    renderWithProviders(<Privacy />)
    expect(screen.getByText(/clearing site data/i)).toBeInTheDocument()
  })

  it('sets out the right to complain to a supervisory authority', () => {
    renderWithProviders(<Privacy />)
    expect(screen.getByText(/data protection authority/i)).toBeInTheDocument()
  })
})
