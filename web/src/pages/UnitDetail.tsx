import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useUnit } from '@/hooks/useUnit'
import { useComparisonUnits } from '@/hooks/useComparisonUnits'
import { useFaction } from '@/hooks/useFaction'
import { useFactionContext } from '@/contexts/FactionContext'
import { UnitIcon } from '@/components/UnitIcon'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { SEO } from '@/components/SEO'
import { JsonLd } from '@/components/JsonLd'
import { createWebPageSchema } from '@/components/seoSchemas'
import { BreadcrumbNav } from '@/components/BreadcrumbNav'
import { OverviewSection } from '@/components/stats/OverviewSection'
import { PhysicsSection } from '@/components/stats/PhysicsSection'
import { ReconSection } from '@/components/stats/ReconSection'
import { WeaponSection } from '@/components/stats/WeaponSection'
import { AmmoSection } from '@/components/stats/AmmoSection'
import { TargetPrioritiesSection } from '@/components/stats/TargetPrioritiesSection'
import { BuiltBySection } from '@/components/stats/BuiltBySection'
import { BuildsSection } from '@/components/stats/BuildsSection'
import { UnitTypesSection } from '@/components/stats/UnitTypesSection'
import { EconomySection } from '@/components/stats/EconomySection'
import { StorageSection } from '@/components/stats/StorageSection'
import { matchWeaponsByTargetLayers } from '@/utils/weaponMatching'
import { aggregateGroupStats, matchAggregatedWeapons } from '@/utils/groupAggregation'
import {
  GroupModeToggle,
  GroupWeaponCard,
  GroupUnitList,
} from '@/components/comparison'
import { StatSection } from '@/components/StatSection'
import type { Weapon, Unit } from '@/types/faction'
import type { ComparisonMode, GroupMember } from '@/types/group'

/** Filter to get regular weapons (excludes self-destruct and death explosions) */
const isRegularWeapon = (w: Weapon) => !w.selfDestruct && !w.deathExplosion

/** Get regular weapons from a weapons array */
const getRegularWeapons = (weapons: Weapon[] | undefined) =>
  weapons?.filter(isRegularWeapon) || []

/**
 * Builds a Map from primary weapon to matched comparison weapon.
 * Uses smart matching based on safeName and target layer overlap.
 */
function buildWeaponMatchMap(
  primaryWeapons: Weapon[],
  comparisonUnit: Unit | undefined
): Map<Weapon, Weapon | undefined> {
  const matchMap = new Map<Weapon, Weapon | undefined>()
  if (!comparisonUnit) {
    // No comparison unit - all primary weapons are unmatched
    for (const weapon of primaryWeapons) {
      matchMap.set(weapon, undefined)
    }
    return matchMap
  }

  const compWeapons = getRegularWeapons(comparisonUnit.specs.combat.weapons)
  const pairs = matchWeaponsByTargetLayers(primaryWeapons, compWeapons)

  // Build map from primary weapons to their matched comparison weapons
  for (const [primary, matched] of pairs) {
    if (primary) {
      matchMap.set(primary, matched)
    }
  }

  return matchMap
}

export function UnitDetail() {
  const { factionId, unitId } = useParams<{ factionId: string; unitId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Parse comparison parameters from URL (comma-separated list)
  const compareParam = searchParams.get('compare')
  const isComparing = compareParam !== null
  const showDifferencesOnly = searchParams.get('diffOnly') === '1'

  // Parse group mode and primary quantity
  const comparisonMode: ComparisonMode = searchParams.get('mode') === 'group' ? 'group' : 'unit'
  const isGroupMode = comparisonMode === 'group'
  const primaryQuantity = parseInt(searchParams.get('qty') || '1', 10) || 1

  // Helper to parse unit refs from URL param
  const parseUnitRefs = (param: string | null): { factionId: string; unitId: string; quantity: number }[] => {
    if (!param) return []
    const refs: { factionId: string; unitId: string; quantity: number }[] = []
    const entries = param.split(',').filter(Boolean)
    for (const entry of entries) {
      const [refPart, qtyPart] = entry.split(':')
      if (refPart.includes('/')) {
        const [cFactionId, cUnitId] = refPart.split('/')
        if (cFactionId) {
          const quantity = qtyPart ? parseInt(qtyPart, 10) || 1 : 1
          refs.push({ factionId: cFactionId, unitId: cUnitId || '', quantity })
        }
      }
    }
    return refs
  }

  // Parse additional units in primary group (for group mode)
  const primaryUnitsParam = searchParams.get('primaryUnits')
  const additionalPrimaryUnits = parseUnitRefs(primaryUnitsParam)

  // Parse comparison group units - support multiple groups via compare, compare2, compare3, etc.
  const comparisonGroups = useMemo(() => {
    const groups: { factionId: string; unitId: string; quantity: number }[][] = []
    // First group from 'compare'
    const firstGroup = parseUnitRefs(searchParams.get('compare'))
    if (firstGroup.length > 0) groups.push(firstGroup)
    // Additional groups from 'compare2', 'compare3', etc.
    for (let i = 2; i <= 10; i++) {
      const group = parseUnitRefs(searchParams.get(`compare${i}`))
      if (group.length > 0) groups.push(group)
    }
    return groups
  }, [searchParams])

  // For backwards compatibility, comparisonRefs refers to the first comparison group
  const comparisonRefs = comparisonGroups[0] || []

  // Flattened array of all comparison refs across all groups (for loading units)
  const allComparisonRefs = useMemo(() => comparisonGroups.flat(), [comparisonGroups])

  // State for pending unit selections in group mode
  const [primaryPendingSelection, setPrimaryPendingSelection] = useState(false)
  // For multiple comparison groups, track which group has pending selection (-1 means no pending)
  const [pendingComparisonGroupIndex, setPendingComparisonGroupIndex] = useState<number>(-1)

  // Helper to serialize a unit ref to URL format
  const serializeRef = (r: { factionId: string; unitId: string; quantity: number }) => {
    const base = `${r.factionId}/${r.unitId}`
    return r.quantity > 1 ? `${base}:${r.quantity}` : base
  }

  // Helper to get URL parameter name for a comparison group index
  const getCompareParamName = (groupIndex: number) =>
    groupIndex === 0 ? 'compare' : `compare${groupIndex + 1}`

  // Helper to update URL params
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`, { replace: true })
  }, [searchParams, navigate, factionId, unitId])

  // ===== Primary Group Management (for group mode) =====

  const updatePrimaryQuantity = useCallback((quantity: number) => {
    updateUrlParams({ qty: quantity > 1 ? quantity.toString() : null })
  }, [updateUrlParams])

  // Start pending selection for primary group
  const startPrimarySelection = useCallback(() => {
    setPrimaryPendingSelection(true)
  }, [])

  // Complete pending selection for primary group
  const completePrimarySelection = useCallback((newFactionId: string, newUnitId: string) => {
    const newRefs = [...additionalPrimaryUnits, { factionId: newFactionId, unitId: newUnitId, quantity: 1 }]
    updateUrlParams({ primaryUnits: newRefs.length > 0 ? newRefs.map(serializeRef).join(',') : null })
    setPrimaryPendingSelection(false)
  }, [additionalPrimaryUnits, updateUrlParams])

  // Cancel pending selection for primary group
  const cancelPrimarySelection = useCallback(() => {
    setPrimaryPendingSelection(false)
  }, [])

  const removePrimaryUnit = useCallback((index: number) => {
    const newRefs = additionalPrimaryUnits.filter((_, i) => i !== index)
    updateUrlParams({ primaryUnits: newRefs.length > 0 ? newRefs.map(serializeRef).join(',') : null })
  }, [additionalPrimaryUnits, updateUrlParams])

  const updatePrimaryUnitQuantity = useCallback((index: number, quantity: number) => {
    const newRefs = [...additionalPrimaryUnits]
    newRefs[index] = { ...newRefs[index], quantity }
    updateUrlParams({ primaryUnits: newRefs.map(serializeRef).join(',') })
  }, [additionalPrimaryUnits, updateUrlParams])

  // ===== Comparison Group Management =====

  // Start pending selection for adding unit to a specific comparison group
  const startComparisonSelection = useCallback((groupIndex: number = 0) => {
    setPendingComparisonGroupIndex(groupIndex)
  }, [])

  // Complete pending selection for comparison group
  const completeComparisonSelection = useCallback((newFactionId: string, newUnitId: string) => {
    if (pendingComparisonGroupIndex < 0) return

    const params = new URLSearchParams(searchParams)
    const groupIndex = pendingComparisonGroupIndex
    const currentGroup = comparisonGroups[groupIndex] || []
    const newRefs = [...currentGroup, { factionId: newFactionId, unitId: newUnitId, quantity: 1 }]

    params.set(getCompareParamName(groupIndex), newRefs.map(serializeRef).join(','))
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
    setPendingComparisonGroupIndex(-1)
  }, [pendingComparisonGroupIndex, comparisonGroups, searchParams, navigate, factionId, unitId])

  // Cancel pending selection for comparison group
  const cancelComparisonSelection = useCallback(() => {
    setPendingComparisonGroupIndex(-1)
  }, [])

  // Add a new comparison slot (for unit mode - creates empty slot to be filled via dropdown)
  const addComparisonSlot = useCallback(() => {
    const newRefs = [...comparisonRefs, { factionId: factionId || '', unitId: '', quantity: 1 }]
    const params = new URLSearchParams(searchParams)
    params.set('compare', newRefs.map(serializeRef).join(','))
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
  }, [comparisonRefs, searchParams, navigate, factionId, unitId])

  // Add a new comparison group (for group mode Add button)
  const addComparisonGroup = useCallback(() => {
    // Start pending selection for a new group at the next index
    setPendingComparisonGroupIndex(comparisonGroups.length)
  }, [comparisonGroups.length])

  // Remove a unit from a comparison group
  const removeComparisonUnit = useCallback((groupIndex: number, unitIndex: number) => {
    const params = new URLSearchParams(searchParams)
    const group = comparisonGroups[groupIndex]
    if (!group) return

    const newRefs = group.filter((_, i) => i !== unitIndex)
    const paramName = getCompareParamName(groupIndex)

    if (newRefs.length === 0) {
      // Remove this group and re-index remaining groups
      params.delete(paramName)
      // Re-index groups after this one
      for (let i = groupIndex + 1; i < comparisonGroups.length; i++) {
        const oldParamName = getCompareParamName(i)
        const newParamName = getCompareParamName(i - 1)
        const groupData = params.get(oldParamName)
        if (groupData) {
          params.set(newParamName, groupData)
          params.delete(oldParamName)
        }
      }
    } else {
      params.set(paramName, newRefs.map(serializeRef).join(','))
    }
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
  }, [comparisonGroups, searchParams, navigate, factionId, unitId])

  // Remove entire comparison group
  const removeComparisonGroup = useCallback((groupIndex: number) => {
    const params = new URLSearchParams(searchParams)
    const paramName = getCompareParamName(groupIndex)
    params.delete(paramName)
    // Re-index groups after this one
    for (let i = groupIndex + 1; i < comparisonGroups.length; i++) {
      const oldParamName = getCompareParamName(i)
      const newParamName = getCompareParamName(i - 1)
      const groupData = params.get(oldParamName)
      if (groupData) {
        params.set(newParamName, groupData)
        params.delete(oldParamName)
      }
    }
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
  }, [comparisonGroups, searchParams, navigate, factionId, unitId])

  const updateComparisonUnit = useCallback((groupIndex: number, unitIndex: number, newFactionId: string, newUnitId: string) => {
    const group = comparisonGroups[groupIndex]
    if (!group) return
    const newRefs = [...group]
    newRefs[unitIndex] = { factionId: newFactionId, unitId: newUnitId, quantity: newRefs[unitIndex]?.quantity || 1 }
    updateUrlParams({ [getCompareParamName(groupIndex)]: newRefs.map(serializeRef).join(',') })
  }, [comparisonGroups, updateUrlParams])

  const updateComparisonQuantity = useCallback((groupIndex: number, unitIndex: number, quantity: number) => {
    const group = comparisonGroups[groupIndex]
    if (!group) return
    const newRefs = [...group]
    newRefs[unitIndex] = { ...newRefs[unitIndex], quantity }
    updateUrlParams({ [getCompareParamName(groupIndex)]: newRefs.map(serializeRef).join(',') })
  }, [comparisonGroups, updateUrlParams])

  // ===== Mode Toggle =====

  const toggleComparisonMode = useCallback((mode: ComparisonMode) => {
    const params = new URLSearchParams(searchParams)
    if (mode === 'group') {
      params.set('mode', 'group')
    } else {
      params.delete('mode')
      params.delete('qty')
      params.delete('primaryUnits')
    }
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
  }, [searchParams, navigate, factionId, unitId])

  const toggleDifferencesOnly = () => {
    const params = new URLSearchParams(searchParams)
    if (showDifferencesOnly) {
      params.delete('diffOnly')
    } else {
      params.set('diffOnly', '1')
    }
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
  }

  // Check if user came from "All" view
  const fromAll = searchParams.get('from') === 'all'
  const backLink = fromAll ? '/faction' : `/faction/${factionId}`
  const backText = fromAll ? 'Back to all' : 'Back to faction'

  // Load primary unit
  const { unit, loading, error } = useUnit(factionId || '', unitId || '')

  // Load all comparison units in parallel (across all comparison groups)
  const { units: comparisonUnits } = useComparisonUnits(allComparisonRefs)

  // Load additional primary units (for group mode)
  const { units: additionalPrimaryUnitData } = useComparisonUnits(additionalPrimaryUnits)

  // First comparison unit for diff calculations on primary column
  const compareUnit = comparisonUnits[0]

  // Get primary faction units (needed for cross-faction Built By comparison)
  const { units: primaryUnits } = useFaction(factionId || '')

  // Scroll container ref for auto-scroll when adding units
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevComparisonCount = useRef(allComparisonRefs.length)

  // Auto-scroll to right edge when a new comparison unit is added
  useEffect(() => {
    if (allComparisonRefs.length > prevComparisonCount.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth'
      })
    }
    prevComparisonCount.current = allComparisonRefs.length
  }, [allComparisonRefs.length])

  // Pre-compute weapon match maps for each comparison unit
  // Uses smart matching based on safeName and target layer overlap
  // Must be called before early returns to satisfy React hooks rules
  const weaponMatchMaps = useMemo(() => {
    if (!unit) return []
    const regularWeapons = getRegularWeapons(unit.specs.combat.weapons)
    return comparisonUnits.map(compUnit => buildWeaponMatchMap(regularWeapons, compUnit))
  }, [unit, comparisonUnits])

  // Get unit lookup function for group stats aggregation
  const { getUnit: getUnitByKey } = useFactionContext()

  // Wrapper to convert (factionId, unitId) to cache key format
  const getUnit = useCallback((factionId: string, unitId: string) => {
    return getUnitByKey(`${factionId}:${unitId}`)
  }, [getUnitByKey])

  // Build complete member lists for each group
  const primaryGroupMembers = useMemo((): GroupMember[] => {
    if (!factionId || !unitId) return []
    // Primary group: current unit + additional primary units
    return [
      { factionId, unitId, quantity: primaryQuantity },
      ...additionalPrimaryUnits.filter(u => u.unitId) // filter out empty slots
    ]
  }, [factionId, unitId, primaryQuantity, additionalPrimaryUnits])

  // Multiple comparison groups - each is an array of members
  const comparisonGroupMembersArray = useMemo((): GroupMember[][] => {
    return comparisonGroups.map(group => group.filter(u => u.unitId))
  }, [comparisonGroups])

  // Compute aggregated stats for primary group
  const primaryGroupStats = useMemo(() => {
    if (!isGroupMode || primaryGroupMembers.length === 0) return null
    return aggregateGroupStats(primaryGroupMembers, getUnit)
  }, [isGroupMode, primaryGroupMembers, getUnit])

  // Compute aggregated stats for all comparison groups
  const comparisonGroupStatsArray = useMemo(() => {
    if (!isGroupMode) return []
    return comparisonGroupMembersArray.map(members =>
      members.length > 0 ? aggregateGroupStats(members, getUnit) : null
    )
  }, [isGroupMode, comparisonGroupMembersArray, getUnit])

  // For backwards compatibility - first comparison group stats
  const comparisonGroupStats = comparisonGroupStatsArray[0] || null

  // Compute matched weapon pairs for group mode (aligned display)
  // For multiple groups, we match against the first comparison group for alignment
  const matchedGroupWeapons = useMemo(() => {
    if (!isGroupMode) return []
    const primaryWeapons = primaryGroupStats?.weapons ?? []
    const comparisonWeapons = comparisonGroupStats?.weapons ?? []
    return matchAggregatedWeapons(primaryWeapons, comparisonWeapons)
  }, [isGroupMode, primaryGroupStats?.weapons, comparisonGroupStats?.weapons])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2">Loading unit...</div>
        </div>
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl font-semibold text-destructive mb-2">Error loading unit</div>
          <div className="text-muted-foreground">{error?.message || 'Unit not found'}</div>
          <Link to={backLink} className="text-primary hover:underline mt-4 inline-block">
            {backText}
          </Link>
        </div>
      </div>
    )
  }

  const { specs, buildRelationships } = unit
  const weapons = specs.combat.weapons || []

  // Separate regular weapons from self-destruct and death explosion
  const regularWeapons = getRegularWeapons(weapons)
  const selfDestructWeapon = weapons.find(w => w.selfDestruct)
  const deathExplosionWeapon = weapons.find(w => w.deathExplosion)

  // Check if any comparison unit has self-destruct or death explosion (for comparison mode)
  const anyComparisonHasSelfDestruct = comparisonUnits.some(u => u?.specs.combat.weapons?.some(w => w.selfDestruct))
  const anyComparisonHasDeathExplosion = comparisonUnits.some(u => u?.specs.combat.weapons?.some(w => w.deathExplosion))

  // SEO data for unit page
  const unitDescription = `${unit.displayName} - ${unit.unitTypes.join(', ')} unit in Planetary Annihilation: Titans. Health: ${specs.combat.health}${specs.economy.buildCost ? `, Build Cost: ${specs.economy.buildCost}` : ''}${specs.combat.dps ? `, DPS: ${specs.combat.dps.toFixed(1)}` : ''}.`
  const seoPath = `/faction/${factionId}/unit/${unitId}`

  return (
    <CurrentFactionProvider factionId={factionId || ''}>
      <SEO
        title={`${unit.displayName} - ${factionId}`}
        description={unitDescription}
        canonicalPath={seoPath}
      />
      <JsonLd schema={createWebPageSchema(`${unit.displayName} - ${factionId}`, seoPath, unitDescription, true)} />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Top row: Back link + comparison controls */}
        <div className="flex items-center justify-between mb-4">
          <Link to={backLink} className="text-primary hover:underline">
            &larr; {backText}
          </Link>

          {isComparing && (
            <div className="flex items-center gap-2">
              {/* Group mode toggle */}
              <GroupModeToggle mode={comparisonMode} onModeChange={toggleComparisonMode} />

              {/* Add comparison button - in group mode creates new group, in unit mode adds unit */}
              <button
                onClick={isGroupMode ? addComparisonGroup : addComparisonSlot}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
                title={isGroupMode ? "Add another comparison group" : "Add another unit to compare"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{isGroupMode ? "Add Group" : "Add"}</span>
              </button>

              {/* Filter toggle - only in unit mode */}
              {!isGroupMode && (
                <button
                  onClick={toggleDifferencesOnly}
                  className={`p-2 text-sm font-medium rounded-lg transition-colors ${
                    showDifferencesOnly
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                  title={showDifferencesOnly ? 'Show all stats' : 'Show differences only'}
                  aria-label={showDifferencesOnly ? 'Show all stats' : 'Show differences only'}
                  aria-pressed={showDifferencesOnly}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
              )}

              {/* Exit comparison */}
              <button
                onClick={() => navigate(`/faction/${factionId}/unit/${unitId}`)}
                className="p-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                title="Exit comparison mode"
                aria-label="Exit comparison mode"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Comparison mode - row-based layout for height alignment */}
        {isComparing ? (
          <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-visible -mx-4 px-4 relative" style={{ scrollBehavior: 'smooth' }}>
            {/* Left edge mask - covers content scrolling past the primary column */}
            <div className="sticky left-0 top-0 w-4 h-full bg-background z-20 float-left -mr-4" aria-hidden="true" />

            {/* Row-based layout - each section row spans all columns */}
            <div className="space-y-4 pb-4">
              {/* Group mode uses 2-column layout with GroupUnitList */}
              {isGroupMode ? (
                <>
                  {/* Group unit lists row */}
                  <div className="flex gap-6 items-stretch">
                    {/* Primary Group unit list */}
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      <GroupUnitList
                        members={primaryGroupMembers}
                        units={[unit, ...additionalPrimaryUnitData]}
                        onQuantityChange={(index, qty) => {
                          if (index === 0) {
                            updatePrimaryQuantity(qty)
                          } else {
                            updatePrimaryUnitQuantity(index - 1, qty)
                          }
                        }}
                        onRemove={(index) => {
                          if (index === 0) {
                            // Removing the first primary unit
                            if (additionalPrimaryUnits.length > 0) {
                              // Promote the first additional primary unit to be the new main unit
                              const newPrimary = additionalPrimaryUnits[0]
                              const remainingPrimary = additionalPrimaryUnits.slice(1)
                              const params = new URLSearchParams(searchParams)
                              if (remainingPrimary.length > 0) {
                                params.set('primaryUnits', remainingPrimary.map(serializeRef).join(','))
                              } else {
                                params.delete('primaryUnits')
                              }
                              navigate(`/faction/${newPrimary.factionId}/unit/${newPrimary.unitId}?${params.toString()}`)
                            } else if (comparisonGroups.length > 0 && comparisonGroups[0].length > 0 && comparisonGroups[0][0].unitId) {
                              // No additional primary units, but there are comparison groups
                              // Make first unit of first comparison group the new primary
                              const newPrimary = comparisonGroups[0][0]
                              const params = new URLSearchParams(searchParams)

                              // Remove the first unit from the first comparison group
                              const remainingFirstGroup = comparisonGroups[0].slice(1)
                              if (remainingFirstGroup.length > 0) {
                                params.set('compare', remainingFirstGroup.map(serializeRef).join(','))
                              } else {
                                // First comparison group is now empty, remove it and re-index
                                params.delete('compare')
                                for (let i = 1; i < comparisonGroups.length; i++) {
                                  const oldParamName = getCompareParamName(i)
                                  const newParamName = getCompareParamName(i - 1)
                                  const groupData = params.get(oldParamName)
                                  if (groupData) {
                                    params.set(newParamName, groupData)
                                    params.delete(oldParamName)
                                  }
                                }
                              }

                              // Clear primaryUnits since we're changing primary
                              params.delete('primaryUnits')
                              navigate(`/faction/${newPrimary.factionId}/unit/${newPrimary.unitId}?${params.toString()}`)
                            } else {
                              // No additional primary units and no comparison groups, go back to faction
                              navigate(`/faction/${factionId}`)
                            }
                          } else {
                            removePrimaryUnit(index - 1)
                          }
                        }}
                        onAdd={startPrimarySelection}
                        pendingSelectionIndex={primaryPendingSelection ? 0 : undefined}
                        onSelectPendingUnit={completePrimarySelection}
                        onCancelPendingSelection={cancelPrimarySelection}
                        defaultFactionId={factionId || ''}
                        otherGroupUnitCount={comparisonGroups.reduce((sum, g) => sum + g.filter(m => m.unitId).length, 0)}
                      />
                    </div>
                    {/* Comparison Group unit lists - one per group */}
                    {comparisonGroups.map((group, groupIndex) => (
                      <div key={`group-${groupIndex}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        <GroupUnitList
                          members={group}
                          units={comparisonUnits.slice(
                            comparisonGroups.slice(0, groupIndex).reduce((sum, g) => sum + g.length, 0),
                            comparisonGroups.slice(0, groupIndex + 1).reduce((sum, g) => sum + g.length, 0)
                          )}
                          onQuantityChange={(unitIndex, qty) => updateComparisonQuantity(groupIndex, unitIndex, qty)}
                          onRemove={(unitIndex) => removeComparisonUnit(groupIndex, unitIndex)}
                          onAdd={() => startComparisonSelection(groupIndex)}
                          pendingSelectionIndex={pendingComparisonGroupIndex === groupIndex ? 0 : undefined}
                          onSelectPendingUnit={completeComparisonSelection}
                          onCancelPendingSelection={cancelComparisonSelection}
                          defaultFactionId={factionId || ''}
                          otherGroupUnitCount={primaryGroupMembers.filter(m => m.unitId).length}
                          onRemoveGroup={() => removeComparisonGroup(groupIndex)}
                        />
                      </div>
                    ))}
                    {/* Pending new group */}
                    {pendingComparisonGroupIndex >= comparisonGroups.length && (
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        <GroupUnitList
                          members={[]}
                          units={[]}
                          onQuantityChange={() => {}}
                          onRemove={() => {}}
                          onAdd={() => {}}
                          pendingSelectionIndex={0}
                          onSelectPendingUnit={completeComparisonSelection}
                          onCancelPendingSelection={cancelComparisonSelection}
                          defaultFactionId={factionId || ''}
                          otherGroupUnitCount={primaryGroupMembers.filter(m => m.unitId).length}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Unit mode: Nav row */}
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      <BreadcrumbNav factionId={factionId || ''} unitId={unitId} enableAllFactions />
                    </div>
                    {comparisonRefs.map((_ref, index) => (
                      <div key={`nav-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        <BreadcrumbNav
                          factionId={_ref.factionId}
                          unitId={_ref.unitId || undefined}
                          onUnitChange={(newFactionId, newUnitId) => updateComparisonUnit(0, index, newFactionId, newUnitId)}
                          sourceUnitTypes={unit.unitTypes}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Unit mode: Unit card row */}
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 sm:p-6 bg-white dark:bg-gray-800 h-full">
                        <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded max-w-[160px] sm:max-w-[200px] mx-auto">
                          <UnitIcon imagePath={unit.image} alt={unit.displayName} className="max-w-full max-h-full object-contain" factionId={factionId} />
                        </div>
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100 text-center">{unit.displayName}</h2>
                        {unit.description && <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 italic text-center">{unit.description}</p>}
                      </div>
                    </div>
                    {comparisonRefs.map((_ref, index) => {
                      const compUnit = comparisonUnits[index]
                      const isPendingSelection = !_ref.unitId
                      return (
                        <div key={`card-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 sm:p-6 bg-white dark:bg-gray-800 relative h-full">
                            {/* Control buttons in top-right corner */}
                            <div className="absolute top-2 right-2 flex gap-1">
                              {_ref.unitId && (
                                <button
                                  onClick={() => {
                                    const newCompareRefs = comparisonRefs.map((r, i) =>
                                      i === index ? { factionId: factionId || '', unitId: unitId || '' } : r
                                    )
                                    const params = new URLSearchParams()
                                    params.set('compare', newCompareRefs.map(r => `${r.factionId}/${r.unitId}`).join(','))
                                    navigate(`/faction/${_ref.factionId}/unit/${_ref.unitId}?${params.toString()}`)
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                  title="Swap with primary unit"
                                  aria-label="Swap with primary unit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => removeComparisonUnit(0, index)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remove from comparison"
                                aria-label="Remove from comparison"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            {isPendingSelection ? (
                              <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded max-w-[160px] sm:max-w-[200px] mx-auto border-2 border-dashed border-gray-300 dark:border-gray-600">
                                <span className="text-gray-400 text-sm text-center px-4">Select a unit above</span>
                              </div>
                            ) : compUnit ? (
                              <>
                                <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded max-w-[160px] sm:max-w-[200px] mx-auto">
                                  <UnitIcon imagePath={compUnit.image} alt={compUnit.displayName} className="max-w-full max-h-full object-contain" factionId={_ref.factionId} />
                                </div>
                                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100 text-center">{compUnit.displayName}</h2>
                                {compUnit.description && <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 italic text-center">{compUnit.description}</p>}
                              </>
                            ) : (
                              <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded max-w-[160px] sm:max-w-[200px] mx-auto">
                                <span className="text-gray-400">Loading...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Group mode: stats display - N column layout / Unit mode: detailed stats */}
              {isGroupMode ? (
                <>
                  {/* Group Overview row */}
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      {primaryGroupStats && (
                        <OverviewSection
                          groupStats={primaryGroupStats}
                          compareGroupStats={comparisonGroupStatsArray[0] ?? undefined}
                          hideDiff
                        />
                      )}
                    </div>
                    {comparisonGroupStatsArray.map((stats, groupIndex) => (
                      <div key={`overview-${groupIndex}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        {stats ? (
                          <OverviewSection
                            groupStats={stats}
                            compareGroupStats={primaryGroupStats ?? undefined}
                          />
                        ) : (
                          <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 min-h-[100px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                            Select units above
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Placeholder for pending new group */}
                    {pendingComparisonGroupIndex >= comparisonGroups.length && (
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 min-h-[100px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                          Select units above
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Group Economy row */}
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      {primaryGroupStats && (
                        <EconomySection
                          groupStats={primaryGroupStats}
                          compareGroupStats={comparisonGroupStatsArray[0] ?? undefined}
                          hideDiff
                        />
                      )}
                    </div>
                    {comparisonGroupStatsArray.map((stats, groupIndex) => (
                      <div key={`economy-${groupIndex}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        {stats ? (
                          <EconomySection
                            groupStats={stats}
                            compareGroupStats={primaryGroupStats ?? undefined}
                          />
                        ) : (
                          <div className="min-h-[50px]" />
                        )}
                      </div>
                    ))}
                    {pendingComparisonGroupIndex >= comparisonGroups.length && (
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        <div className="min-h-[50px]" />
                      </div>
                    )}
                  </div>

                  {/* Group Mobility row */}
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      {primaryGroupStats && (
                        <PhysicsSection
                          groupStats={primaryGroupStats}
                          compareGroupStats={comparisonGroupStatsArray[0] ?? undefined}
                          hideDiff
                        />
                      )}
                    </div>
                    {comparisonGroupStatsArray.map((stats, groupIndex) => (
                      <div key={`mobility-${groupIndex}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        {stats ? (
                          <PhysicsSection
                            groupStats={stats}
                            compareGroupStats={primaryGroupStats ?? undefined}
                          />
                        ) : (
                          <div className="min-h-[50px]" />
                        )}
                      </div>
                    ))}
                    {pendingComparisonGroupIndex >= comparisonGroups.length && (
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        <div className="min-h-[50px]" />
                      </div>
                    )}
                  </div>

                  {/* Group Recon row */}
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      {primaryGroupStats && (
                        <ReconSection
                          groupStats={primaryGroupStats}
                          compareGroupStats={comparisonGroupStatsArray[0] ?? undefined}
                          hideDiff
                        />
                      )}
                    </div>
                    {comparisonGroupStatsArray.map((stats, groupIndex) => (
                      <div key={`recon-${groupIndex}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        {stats ? (
                          <ReconSection
                            groupStats={stats}
                            compareGroupStats={primaryGroupStats ?? undefined}
                          />
                        ) : (
                          <div className="min-h-[50px]" />
                        )}
                      </div>
                    ))}
                    {pendingComparisonGroupIndex >= comparisonGroups.length && (
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        <div className="min-h-[50px]" />
                      </div>
                    )}
                  </div>

                  {/* Group weapons - aligned rows */}
                  {(primaryGroupStats?.weapons.length || comparisonGroupStatsArray.some(s => s?.weapons.length) || pendingComparisonGroupIndex >= comparisonGroups.length) && (
                    <div className="flex gap-6 items-stretch">
                      {/* Primary Group Weapons */}
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                        <StatSection title="Weapons">
                          <div className="space-y-3">
                            {matchedGroupWeapons.map(([primary, comparison], index) => (
                              <div key={`primary-weapon-${index}`}>
                                {primary ? (
                                  <GroupWeaponCard
                                    weapon={primary}
                                    compareWeapon={comparison}
                                    hideDiff
                                  />
                                ) : comparison ? (
                                  <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 min-h-[140px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                                    No equivalent weapon
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </StatSection>
                      </div>
                      {/* Comparison Group Weapons - one column per group */}
                      {comparisonGroupStatsArray.map((stats, groupIndex) => (
                        <div key={`weapons-${groupIndex}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          {stats ? (
                            <StatSection title="Weapons">
                              <div className="space-y-3">
                                {matchedGroupWeapons.map(([primary, comparison], index) => {
                                  // For now, weapon matching only works against first comparison group
                                  // Additional groups show their own weapons independently
                                  const weapon = groupIndex === 0 ? comparison : stats?.weapons[index]
                                  return (
                                    <div key={`comparison-${groupIndex}-weapon-${index}`}>
                                      {weapon ? (
                                        <GroupWeaponCard
                                          weapon={weapon}
                                          compareWeapon={primary}
                                        />
                                      ) : primary && groupIndex === 0 ? (
                                        <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 min-h-[140px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                                          No equivalent weapon
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                })}
                                {/* For groups beyond the first, show all their weapons if they don't align */}
                                {groupIndex > 0 && stats?.weapons.map((weapon, wIndex) => (
                                  wIndex >= matchedGroupWeapons.length && (
                                    <div key={`extra-weapon-${groupIndex}-${wIndex}`}>
                                      <GroupWeaponCard
                                        weapon={weapon}
                                        compareWeapon={undefined}
                                      />
                                    </div>
                                  )
                                ))}
                              </div>
                            </StatSection>
                          ) : (
                            <div className="min-h-[50px]" />
                          )}
                        </div>
                      ))}
                      {pendingComparisonGroupIndex >= comparisonGroups.length && (
                        <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          <div className="min-h-[50px]" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Group Target Priorities */}
                  {(primaryGroupStats?.allTargetLayers.length || comparisonGroupStatsArray.some(s => s?.allTargetLayers.length) || pendingComparisonGroupIndex >= comparisonGroups.length) ? (
                    <div className="flex gap-6 items-stretch">
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                        {primaryGroupStats && (
                          <TargetPrioritiesSection
                            groupTargetLayers={primaryGroupStats.allTargetLayers}
                            compareGroupTargetLayers={comparisonGroupStatsArray[0]?.allTargetLayers}
                          />
                        )}
                      </div>
                      {comparisonGroupStatsArray.map((stats, groupIndex) => (
                        <div key={`priorities-${groupIndex}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          {stats ? (
                            <TargetPrioritiesSection
                              groupTargetLayers={stats.allTargetLayers}
                              compareGroupTargetLayers={primaryGroupStats?.allTargetLayers}
                              isComparisonSide
                            />
                          ) : (
                            <div className="min-h-[50px]" />
                          )}
                        </div>
                      ))}
                      {pendingComparisonGroupIndex >= comparisonGroups.length && (
                        <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          <div className="min-h-[50px]" />
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Group Builds */}
                  {(primaryGroupStats?.allBuilds.length || comparisonGroupStatsArray.some(s => s?.allBuilds.length) || pendingComparisonGroupIndex >= comparisonGroups.length) ? (
                    <div className="flex gap-6 items-stretch">
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                        {primaryGroupStats && primaryGroupStats.allBuilds.length > 0 && (
                          <BuildsSection
                            builds={primaryGroupStats.allBuilds}
                            buildRate={primaryGroupStats.totalBuildRate}
                            buildRateByUnit={primaryGroupStats.buildRateByUnit}
                            compareBuilds={comparisonGroupStatsArray[0]?.allBuilds}
                          />
                        )}
                      </div>
                      {comparisonGroupStatsArray.map((stats, groupIndex) => (
                        <div key={`builds-${groupIndex}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          {stats && stats.allBuilds.length > 0 ? (
                            <BuildsSection
                              builds={stats.allBuilds}
                              buildRate={stats.totalBuildRate}
                              buildRateByUnit={stats.buildRateByUnit}
                              compareBuilds={primaryGroupStats?.allBuilds}
                              isComparisonSide
                            />
                          ) : (
                            <div className="min-h-[50px]" />
                          )}
                        </div>
                      ))}
                      {pendingComparisonGroupIndex >= comparisonGroups.length && (
                        <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          <div className="min-h-[50px]" />
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {/* UnitTypes row */}
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      <UnitTypesSection
                        unitTypes={unit.unitTypes}
                        compareUnitTypes={comparisonUnits.filter(Boolean).flatMap(u => u!.unitTypes)}
                        showDifferencesOnly={showDifferencesOnly}
                      />
                    </div>
                    {comparisonRefs.map((_ref, index) => {
                      const compUnit = comparisonUnits[index]
                      return (
                        <div key={`types-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          {compUnit && (
                            <UnitTypesSection
                              unitTypes={compUnit.unitTypes}
                              compareUnitTypes={unit.unitTypes}
                              showDifferencesOnly={showDifferencesOnly}
                              isComparisonSide
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Overview row */}
              <div className="flex gap-6 items-stretch">
                <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                  <OverviewSection unit={unit} compareUnit={compareUnit} showDifferencesOnly={showDifferencesOnly} hideDiff />
                </div>
                {comparisonRefs.map((_ref, index) => {
                  const compUnit = comparisonUnits[index]
                  return (
                    <div key={`overview-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                      {compUnit && (
                        <OverviewSection unit={compUnit} compareUnit={unit} factionId={_ref.factionId} showDifferencesOnly={showDifferencesOnly} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Economy row */}
              <div className="flex gap-6 items-stretch">
                <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                  <EconomySection economy={specs.economy} compareEconomy={compareUnit?.specs.economy} showDifferencesOnly={showDifferencesOnly} hideDiff />
                </div>
                {comparisonRefs.map((_ref, index) => {
                  const compUnit = comparisonUnits[index]
                  return (
                    <div key={`economy-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                      {compUnit && (
                        <EconomySection economy={compUnit.specs.economy} compareEconomy={specs.economy} showDifferencesOnly={showDifferencesOnly} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Physics row - only if primary has mobility */}
              {specs.mobility && (
                <div className="flex gap-6 items-stretch">
                  <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                    <PhysicsSection mobility={specs.mobility} special={specs.special} compareMobility={compareUnit?.specs.mobility} compareSpecial={compareUnit?.specs.special} showDifferencesOnly={showDifferencesOnly} hideDiff />
                  </div>
                  {comparisonRefs.map((_ref, index) => {
                    const compUnit = comparisonUnits[index]
                    return (
                      <div key={`physics-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        {compUnit?.specs.mobility && (
                          <PhysicsSection mobility={compUnit.specs.mobility} special={compUnit.specs.special} compareMobility={specs.mobility} compareSpecial={specs.special} showDifferencesOnly={showDifferencesOnly} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Recon row - only if primary has recon */}
              {specs.recon && (
                <div className="flex gap-6 items-stretch">
                  <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                    <ReconSection recon={specs.recon} compareRecon={compareUnit?.specs.recon} showDifferencesOnly={showDifferencesOnly} hideDiff />
                  </div>
                  {comparisonRefs.map((_ref, index) => {
                    const compUnit = comparisonUnits[index]
                    return (
                      <div key={`recon-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        {compUnit?.specs.recon && (
                          <ReconSection recon={compUnit.specs.recon} compareRecon={specs.recon} showDifferencesOnly={showDifferencesOnly} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Weapon rows - one row per weapon
                  Weapons are matched using smart matching based on safeName and target layer overlap.
                  Priority: exact safeName > all same targets > partial target overlap > no match. */}
              {regularWeapons.map((weapon, wIndex) => (
                <React.Fragment key={`weapon-row-${wIndex}`}>
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      <WeaponSection weapon={weapon} compareWeapon={weaponMatchMaps[0]?.get(weapon)} showDifferencesOnly={showDifferencesOnly} hideDiff />
                    </div>
                    {comparisonRefs.map((_ref, index) => {
                      const compWeapon = weaponMatchMaps[index]?.get(weapon)
                      return (
                        <div key={`weapon-${wIndex}-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          {compWeapon && (
                            <WeaponSection weapon={compWeapon} compareWeapon={weapon} showDifferencesOnly={showDifferencesOnly} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {weapon.ammoDetails && (
                    <div className="flex gap-6 items-stretch">
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                        <AmmoSection ammo={weapon.ammoDetails} compareAmmo={weaponMatchMaps[0]?.get(weapon)?.ammoDetails} showDifferencesOnly={showDifferencesOnly} hideDiff />
                      </div>
                      {comparisonRefs.map((_ref, index) => {
                        const matchedWeapon = weaponMatchMaps[index]?.get(weapon)
                        const compAmmo = matchedWeapon?.ammoDetails
                        return (
                          <div key={`ammo-${wIndex}-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                            {compAmmo && (
                              <AmmoSection ammo={compAmmo} compareAmmo={weapon.ammoDetails} showDifferencesOnly={showDifferencesOnly} factionId={_ref.factionId} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </React.Fragment>
              ))}

              {/* Self-destruct weapon row */}
              {(selfDestructWeapon || anyComparisonHasSelfDestruct) && (
                <>
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      {selfDestructWeapon && (
                        <WeaponSection weapon={selfDestructWeapon} compareWeapon={compareUnit?.specs.combat.weapons?.find(w => w.selfDestruct)} showDifferencesOnly={showDifferencesOnly} hideDiff />
                      )}
                    </div>
                    {comparisonRefs.map((_ref, index) => {
                      const compUnit = comparisonUnits[index]
                      const compWeapon = compUnit?.specs.combat.weapons?.find(w => w.selfDestruct)
                      return (
                        <div key={`selfdestruct-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          {compWeapon && (
                            <WeaponSection weapon={compWeapon} compareWeapon={selfDestructWeapon} showDifferencesOnly={showDifferencesOnly} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {(selfDestructWeapon?.ammoDetails || comparisonUnits.some(u => u?.specs.combat.weapons?.find(w => w.selfDestruct)?.ammoDetails)) && (
                    <div className="flex gap-6 items-stretch">
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                        {selfDestructWeapon?.ammoDetails && (
                          <AmmoSection ammo={selfDestructWeapon.ammoDetails} compareAmmo={compareUnit?.specs.combat.weapons?.find(w => w.selfDestruct)?.ammoDetails} showDifferencesOnly={showDifferencesOnly} hideDiff />
                        )}
                      </div>
                      {comparisonRefs.map((_ref, index) => {
                        const compUnit = comparisonUnits[index]
                        const compAmmo = compUnit?.specs.combat.weapons?.find(w => w.selfDestruct)?.ammoDetails
                        return (
                          <div key={`selfdestruct-ammo-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                            {compAmmo && (
                              <AmmoSection ammo={compAmmo} compareAmmo={selfDestructWeapon?.ammoDetails} showDifferencesOnly={showDifferencesOnly} factionId={_ref.factionId} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Death explosion weapon row */}
              {(deathExplosionWeapon || anyComparisonHasDeathExplosion) && (
                <>
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      {deathExplosionWeapon && (
                        <WeaponSection weapon={deathExplosionWeapon} compareWeapon={compareUnit?.specs.combat.weapons?.find(w => w.deathExplosion)} showDifferencesOnly={showDifferencesOnly} hideDiff />
                      )}
                    </div>
                    {comparisonRefs.map((_ref, index) => {
                      const compUnit = comparisonUnits[index]
                      const compWeapon = compUnit?.specs.combat.weapons?.find(w => w.deathExplosion)
                      return (
                        <div key={`deathexp-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                          {compWeapon && (
                            <WeaponSection weapon={compWeapon} compareWeapon={deathExplosionWeapon} showDifferencesOnly={showDifferencesOnly} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {(deathExplosionWeapon?.ammoDetails || comparisonUnits.some(u => u?.specs.combat.weapons?.find(w => w.deathExplosion)?.ammoDetails)) && (
                    <div className="flex gap-6 items-stretch">
                      <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                        {deathExplosionWeapon?.ammoDetails && (
                          <AmmoSection ammo={deathExplosionWeapon.ammoDetails} compareAmmo={compareUnit?.specs.combat.weapons?.find(w => w.deathExplosion)?.ammoDetails} showDifferencesOnly={showDifferencesOnly} hideDiff />
                        )}
                      </div>
                      {comparisonRefs.map((_ref, index) => {
                        const compUnit = comparisonUnits[index]
                        const compAmmo = compUnit?.specs.combat.weapons?.find(w => w.deathExplosion)?.ammoDetails
                        return (
                          <div key={`deathexp-ammo-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                            {compAmmo && (
                              <AmmoSection ammo={compAmmo} compareAmmo={deathExplosionWeapon?.ammoDetails} showDifferencesOnly={showDifferencesOnly} factionId={_ref.factionId} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Storage row - only if primary has storage */}
              {(specs.storage?.unitStorage ?? 0) > 0 && (
                <div className="flex gap-6 items-stretch">
                  <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                    <StorageSection storage={specs.storage} compareStorage={compareUnit?.specs.storage} showDifferencesOnly={showDifferencesOnly} hideDiff />
                  </div>
                  {comparisonRefs.map((_ref, index) => {
                    const compUnit = comparisonUnits[index]
                    return (
                      <div key={`storage-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                        {compUnit && (compUnit.specs.storage?.unitStorage ?? 0) > 0 && (
                          <StorageSection storage={compUnit.specs.storage} compareStorage={specs.storage} showDifferencesOnly={showDifferencesOnly} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Target Priorities row */}
              <div className="flex gap-6 items-stretch">
                <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                  <TargetPrioritiesSection
                    weapons={regularWeapons}
                    compareWeapons={compareUnit?.specs.combat.weapons?.filter(isRegularWeapon) || []}
                    showDifferencesOnly={showDifferencesOnly}
                  />
                </div>
                {comparisonRefs.map((_ref, index) => {
                  const compUnit = comparisonUnits[index]
                  const compRegularWeapons = compUnit?.specs.combat.weapons?.filter(isRegularWeapon) || []
                  return (
                    <div key={`priorities-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                      {compUnit && (
                        <TargetPrioritiesSection
                          weapons={compRegularWeapons}
                          compareWeapons={regularWeapons}
                          showDifferencesOnly={showDifferencesOnly}
                          isComparisonSide
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Built By row */}
              <div className="flex gap-6 items-stretch">
                <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                  <BuiltBySection
                    builtBy={buildRelationships?.builtBy}
                    buildCost={specs.economy.buildCost}
                    factionId={factionId}
                    compareBuiltBy={compareUnit?.buildRelationships?.builtBy}
                    showDifferencesOnly={showDifferencesOnly}
                  />
                </div>
                {comparisonRefs.map((_ref, index) => {
                  const compUnit = comparisonUnits[index]
                  return (
                    <div key={`builtby-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                      {compUnit && (
                        <BuiltBySection
                          builtBy={compUnit.buildRelationships?.builtBy}
                          buildCost={compUnit.specs.economy.buildCost}
                          factionId={_ref.factionId}
                          compareBuiltBy={buildRelationships?.builtBy}
                          showDifferencesOnly={showDifferencesOnly}
                          isComparisonSide
                          compareUnits={primaryUnits}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Builds row */}
              <div className="flex gap-6 items-stretch">
                <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                  <BuildsSection
                    builds={buildRelationships?.builds}
                    buildRate={specs.economy.buildRate || 0}
                    factionId={factionId}
                    compareBuilds={compareUnit?.buildRelationships?.builds}
                    showDifferencesOnly={showDifferencesOnly}
                  />
                </div>
                {comparisonRefs.map((_ref, index) => {
                  const compUnit = comparisonUnits[index]
                  return (
                    <div key={`builds-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                      {compUnit && (
                        <BuildsSection
                          builds={compUnit.buildRelationships?.builds}
                          buildRate={compUnit.specs.economy.buildRate || 0}
                          factionId={_ref.factionId}
                          compareBuilds={buildRelationships?.builds}
                          showDifferencesOnly={showDifferencesOnly}
                          isComparisonSide
                          compareUnits={primaryUnits}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Non-comparison mode - navigation with Compare button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <BreadcrumbNav factionId={factionId || ''} unitId={unitId} />
              <button
                onClick={() => {
                  // Start comparison mode with one empty slot for selection
                  const params = new URLSearchParams(searchParams)
                  params.set('compare', `${factionId}/`)
                  navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
                }}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap sm:flex-shrink-0"
              >
                Compare
              </button>
            </div>

            {/* Normal single-unit layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left column - Unit icon and basic info */}
            <div className="md:col-span-1 space-y-6">
              <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded">
                  <UnitIcon
                    imagePath={unit.image}
                    alt={unit.displayName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  {unit.displayName}
                </h1>
                {unit.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    {unit.description}
                  </p>
                )}
              </div>

              <UnitTypesSection unitTypes={unit.unitTypes} />

              <BuiltBySection
                builtBy={buildRelationships?.builtBy}
                buildCost={specs.economy.buildCost}
              />

              <BuildsSection
                builds={buildRelationships?.builds}
                buildRate={specs.economy.buildRate || 0}
              />
            </div>

            {/* Right column - All stats sections */}
            <div className="md:col-span-2 space-y-6">
              <OverviewSection unit={unit} />

              <EconomySection economy={specs.economy} />

              {specs.mobility && (
                <PhysicsSection mobility={specs.mobility} special={specs.special} />
              )}

              {specs.recon && <ReconSection recon={specs.recon} />}

              {regularWeapons.map((weapon, index) => (
                <React.Fragment key={`${weapon.resourceName}-${index}`}>
                  <WeaponSection weapon={weapon} />
                  {weapon.ammoDetails && (
                    <AmmoSection ammo={weapon.ammoDetails} />
                  )}
                </React.Fragment>
              ))}

              {selfDestructWeapon && (
                <>
                  <WeaponSection weapon={selfDestructWeapon} />
                  {selfDestructWeapon.ammoDetails && (
                    <AmmoSection ammo={selfDestructWeapon.ammoDetails} />
                  )}
                </>
              )}

              {deathExplosionWeapon && (
                <>
                  <WeaponSection weapon={deathExplosionWeapon} />
                  {deathExplosionWeapon.ammoDetails && (
                    <AmmoSection ammo={deathExplosionWeapon.ammoDetails} />
                  )}
                </>
              )}

              <StorageSection storage={specs.storage} />

              <TargetPrioritiesSection weapons={regularWeapons} />
            </div>
          </div>
          </>
        )}
      </div>
    </CurrentFactionProvider>
  )
}
