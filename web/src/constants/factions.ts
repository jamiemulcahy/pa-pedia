/**
 * Static factions shipped with the web app.
 * These are available to all users and included in the sitemap.
 *
 * IMPORTANT: When adding a new static faction:
 * 1. Export faction data using the CLI to web/public/factions/{FactionName}/
 * 2. Add the faction ID to this array
 * 3. The sitemap will automatically include the new faction on next build
 */
export const STATIC_FACTIONS = ['MLA', 'Legion', 'Bugs', 'Exiles'] as const

export type StaticFactionId = (typeof STATIC_FACTIONS)[number]
