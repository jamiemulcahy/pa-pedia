/**
 * Derives GitHub repository links from a faction's `mods` list.
 *
 * The `mods` entries are mod *source* identifiers, not repo URLs: they may point
 * at a specific branch and subfolder (Legion ships its server and client mods as
 * two folders on one branch). For a "view the source" link we only ever want the
 * repository root, so the branch/path tail is stripped and the results deduped —
 * Legion's two entries collapse to a single link, while a faction whose client
 * and server genuinely live in separate repos keeps both.
 *
 * Entries that aren't GitHub references (plain mod ids like `com.pa.replicate`)
 * are ignored.
 */

export interface FactionRepoLink {
  /** Canonical repository URL, e.g. https://github.com/owner/repo */
  url: string
  /** Human-readable `owner/repo` label */
  label: string
}

/** Owner and repo segments allow letters, digits, dot, dash and underscore. */
const GITHUB_REF = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)(?:[/?#]|$)/

function parseRepoRoot(mod: string): FactionRepoLink | null {
  const match = GITHUB_REF.exec(mod.trim())
  if (!match) return null

  const owner = match[1]
  // A `.git` suffix is valid in a clone URL but not in the web URL.
  const repo = match[2].replace(/\.git$/i, '')
  if (!repo) return null

  return { url: `https://github.com/${owner}/${repo}`, label: `${owner}/${repo}` }
}

/**
 * Returns the distinct GitHub repository roots referenced by a faction's mods,
 * in first-seen order. GitHub owner/repo names are case-insensitive, so links
 * differing only in case are treated as the same repository.
 */
export function getFactionRepoLinks(mods?: string[]): FactionRepoLink[] {
  if (!mods || mods.length === 0) return []

  const seen = new Set<string>()
  const links: FactionRepoLink[] = []

  for (const mod of mods) {
    const link = parseRepoRoot(mod)
    if (!link) continue

    const key = link.url.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    links.push(link)
  }

  return links
}
