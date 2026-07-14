/**
 * teamColorPref
 *
 * Persistence for the 3D viewer's team-colour pickers.
 *
 * The preference is a single global slot stamped with the faction it was chosen
 * for. Reads only hand it back for a matching faction, so a colour picked on one
 * faction carries across that faction's units (and page reloads) but never
 * bleeds into another faction — landing on a new faction shows its own default
 * colours. Picking a colour there takes over the slot; there is deliberately no
 * per-faction history.
 */

const COLOR_PREF_KEY = 'pa-pedia-team-colors'

export interface TeamColorPref {
  main: string
  highlight: string
  /** Faction the colours were chosen for; a read against any other faction misses. */
  factionId: string
}

function isValidPref(value: unknown): value is TeamColorPref {
  const pref = value as Partial<TeamColorPref> | null
  return (
    !!pref &&
    typeof pref.main === 'string' &&
    typeof pref.highlight === 'string' &&
    typeof pref.factionId === 'string'
  )
}

/**
 * The stored colours, but only if they were chosen for `factionId`.
 *
 * Returns null for a different faction, no stored pref, or a pref written by an
 * older build (which had no factionId) — all of which mean "use the faction
 * default", so the legacy format needs no migration.
 */
export function readTeamColorPref(factionId: string): TeamColorPref | null {
  try {
    const raw = localStorage.getItem(COLOR_PREF_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidPref(parsed)) return null
    return parsed.factionId === factionId ? parsed : null
  } catch {
    // Corrupt JSON / unavailable storage → treat as no preference.
    return null
  }
}

/** Persist the colours against their faction, replacing any previous slot. */
export function writeTeamColorPref(pref: TeamColorPref): void {
  try {
    localStorage.setItem(COLOR_PREF_KEY, JSON.stringify(pref))
  } catch {
    // Ignore storage failures (private mode / quota).
  }
}

/** Drop the stored preference, so viewers fall back to faction defaults. */
export function clearTeamColorPref(): void {
  try {
    localStorage.removeItem(COLOR_PREF_KEY)
  } catch {
    // Ignore.
  }
}
