import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FactionRepoLinks } from '../FactionRepoLinks'

describe('FactionRepoLinks', () => {
  it('renders nothing when the faction has no GitHub sources', () => {
    const { container } = render(<FactionRepoLinks mods={['com.pa.example']} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the faction has no mods at all (base game)', () => {
    const { container } = render(<FactionRepoLinks />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows one owner/repo link pointing at the repo root', () => {
    render(
      <FactionRepoLinks
        mods={[
          'github.com/Legion-Expansion/Legion-Expansion/tree/develop/src/server',
          'github.com/Legion-Expansion/Legion-Expansion/tree/develop/src/client',
        ]}
      />
    )
    const link = screen.getByRole('link', { name: 'Legion-Expansion/Legion-Expansion' })
    expect(link).toHaveAttribute('href', 'https://github.com/Legion-Expansion/Legion-Expansion')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('labels every repo when a faction spans more than one', () => {
    render(
      <FactionRepoLinks
        mods={[
          'github.com/Ferret-Master/Bug-Faction/tree/main',
          'github.com/Ferret-Master/Bug-Faction-Client/tree/main',
        ]}
      />
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Ferret-Master\/Bug-Faction$/ })).toHaveAttribute(
      'href',
      'https://github.com/Ferret-Master/Bug-Faction'
    )
    expect(screen.getByRole('link', { name: /Bug-Faction-Client/ })).toBeInTheDocument()
  })
})
