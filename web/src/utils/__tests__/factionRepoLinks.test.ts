import { describe, it, expect } from 'vitest'
import { getFactionRepoLinks } from '../factionRepoLinks'

describe('getFactionRepoLinks', () => {
  it('returns nothing for missing or empty mods', () => {
    expect(getFactionRepoLinks()).toEqual([])
    expect(getFactionRepoLinks([])).toEqual([])
  })

  it('ignores non-GitHub mod identifiers', () => {
    expect(getFactionRepoLinks(['com.pa.replicate', 'pa.mla.unit.addon'])).toEqual([])
  })

  it('strips branch and folder to the repo root', () => {
    expect(
      getFactionRepoLinks(['github.com/NikolaMX/Exiles-Faction/tree/main/src/server'])
    ).toEqual([{ url: 'https://github.com/NikolaMX/Exiles-Faction', label: 'NikolaMX/Exiles-Faction' }])
  })

  it('collapses client and server sources on one repo to a single link', () => {
    // Legion: two folders on the same branch of one repository.
    const links = getFactionRepoLinks([
      'github.com/Legion-Expansion/Legion-Expansion/tree/develop/src/server',
      'github.com/Legion-Expansion/Legion-Expansion/tree/develop/src/client',
    ])
    expect(links).toEqual([
      {
        url: 'https://github.com/Legion-Expansion/Legion-Expansion',
        label: 'Legion-Expansion/Legion-Expansion',
      },
    ])
  })

  it('keeps genuinely separate repositories, in first-seen order', () => {
    // Bugs: client and server live in two different repositories.
    const links = getFactionRepoLinks([
      'github.com/Ferret-Master/Bug-Faction/tree/main',
      'github.com/Ferret-Master/Bug-Faction-Client/tree/main',
    ])
    expect(links.map((l) => l.url)).toEqual([
      'https://github.com/Ferret-Master/Bug-Faction',
      'https://github.com/Ferret-Master/Bug-Faction-Client',
    ])
  })

  it('treats repo references differing only in case as the same repo', () => {
    const links = getFactionRepoLinks([
      'github.com/BotWhan/com.pa.replicate',
      'https://github.com/botwhan/COM.PA.REPLICATE',
    ])
    expect(links).toHaveLength(1)
    expect(links[0].url).toBe('https://github.com/BotWhan/com.pa.replicate')
  })

  it('normalises scheme, www and a .git suffix', () => {
    expect(getFactionRepoLinks(['https://www.github.com/owner/repo.git'])[0].url).toBe(
      'https://github.com/owner/repo'
    )
  })

  it('ignores a bare owner with no repository', () => {
    expect(getFactionRepoLinks(['github.com/owner'])).toEqual([])
  })
})
