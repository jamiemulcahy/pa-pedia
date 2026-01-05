// Explicit faction display order (case-insensitive matching)
const FACTION_ORDER = ['mla', 'legion', 'bugs', 'exiles', 'second-wave']

export function sortFactions<T extends { folderName: string }>(factions: T[]): T[] {
  return [...factions].sort((a, b) => {
    const aIndex = FACTION_ORDER.indexOf(a.folderName.toLowerCase())
    const bIndex = FACTION_ORDER.indexOf(b.folderName.toLowerCase())

    // Both in order list: sort by defined order
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    // Only a in list: a comes first
    if (aIndex !== -1) return -1
    // Only b in list: b comes first
    if (bIndex !== -1) return 1
    // Neither in list: alphabetical by folderName
    return a.folderName.localeCompare(b.folderName)
  })
}
