import React, { useRef, useEffect } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useUnit } from '@/hooks/useUnit'
import { useComparisonUnits } from '@/hooks/useComparisonUnits'
import { useFaction } from '@/hooks/useFaction'
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
import type { Weapon } from '@/types/faction'
// Note: matchWeaponsByTargetLayers removed - using simpler index-based matching in column layout

/** Filter to get regular weapons (excludes self-destruct and death explosions) */
const isRegularWeapon = (w: Weapon) => !w.selfDestruct && !w.deathExplosion

/** Get regular weapons from a weapons array */
const getRegularWeapons = (weapons: Weapon[] | undefined) =>
  weapons?.filter(isRegularWeapon) || []

export function UnitDetail() {
  const { factionId, unitId } = useParams<{ factionId: string; unitId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Parse comparison parameters from URL (comma-separated list)
  const compareParam = searchParams.get('compare')
  const isComparing = compareParam !== null
  const showDifferencesOnly = searchParams.get('diffOnly') === '1'

  // Parse multiple comparison units from URL (format: "factionId/unitId,factionId/unitId,...")
  // Empty unitId is allowed for "pending selection" slots
  const MAX_COMPARISON_UNITS = 6
  const comparisonRefs: { factionId: string; unitId: string }[] = []
  if (compareParam) {
    const entries = compareParam.split(',').filter(Boolean)
    for (const entry of entries.slice(0, MAX_COMPARISON_UNITS)) {
      if (entry.includes('/')) {
        const [cFactionId, cUnitId] = entry.split('/')
        if (cFactionId) {
          // Allow empty unitId - this represents a "pending selection" slot
          comparisonRefs.push({ factionId: cFactionId, unitId: cUnitId || '' })
        }
      }
    }
  }

  // URL manipulation helpers
  const addComparisonUnit = (newFactionId: string, newUnitId: string) => {
    if (comparisonRefs.length >= MAX_COMPARISON_UNITS) return
    const newRefs = [...comparisonRefs, { factionId: newFactionId, unitId: newUnitId }]
    const params = new URLSearchParams(searchParams)
    params.set('compare', newRefs.map(r => `${r.factionId}/${r.unitId}`).join(','))
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
  }

  const removeComparisonUnit = (index: number) => {
    const newRefs = comparisonRefs.filter((_, i) => i !== index)
    const params = new URLSearchParams(searchParams)
    if (newRefs.length === 0) {
      params.delete('compare')
    } else {
      params.set('compare', newRefs.map(r => `${r.factionId}/${r.unitId}`).join(','))
    }
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
  }

  const updateComparisonUnit = (index: number, newFactionId: string, newUnitId: string) => {
    const newRefs = [...comparisonRefs]
    newRefs[index] = { factionId: newFactionId, unitId: newUnitId }
    const params = new URLSearchParams(searchParams)
    params.set('compare', newRefs.map(r => `${r.factionId}/${r.unitId}`).join(','))
    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
  }

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

  // Load all comparison units in parallel
  const { units: comparisonUnits } = useComparisonUnits(comparisonRefs)

  // First comparison unit for diff calculations on primary column
  const compareUnit = comparisonUnits[0]

  // Get primary faction units (needed for cross-faction Built By comparison)
  const { units: primaryUnits } = useFaction(factionId || '')

  // Scroll container ref for auto-scroll when adding units
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevComparisonCount = useRef(comparisonRefs.length)

  // Auto-scroll to right edge when a new comparison unit is added
  useEffect(() => {
    if (comparisonRefs.length > prevComparisonCount.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth'
      })
    }
    prevComparisonCount.current = comparisonRefs.length
  }, [comparisonRefs.length])

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
              {/* Add comparison button */}
              {comparisonRefs.length < MAX_COMPARISON_UNITS && (
                <button
                  onClick={() => addComparisonUnit(factionId || '', '')}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
                  title="Add another unit to compare"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add</span>
                </button>
              )}

              {/* Filter toggle */}
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
              {/* Nav row */}
              <div className="flex gap-6 items-stretch">
                <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                  <BreadcrumbNav factionId={factionId || ''} unitId={unitId} enableAllFactions />
                </div>
                {comparisonRefs.map((_ref, index) => (
                  <div key={`nav-${index}`} className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)]">
                    <BreadcrumbNav
                      factionId={_ref.factionId}
                      unitId={_ref.unitId || undefined}
                      onUnitChange={(newFactionId, newUnitId) => updateComparisonUnit(index, newFactionId, newUnitId)}
                      sourceUnitTypes={unit.unitTypes}
                    />
                  </div>
                ))}
              </div>

              {/* Unit card row */}
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
                            onClick={() => removeComparisonUnit(index)}
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
                  Note: Weapons are matched by array index position. If units have different
                  weapon counts, comparison cells will be empty for mismatched positions.
                  Future enhancement: consider semantic matching by target layers or damage type. */}
              {regularWeapons.map((weapon, wIndex) => (
                <React.Fragment key={`weapon-row-${wIndex}`}>
                  <div className="flex gap-6 items-stretch">
                    <div className="flex-1 min-w-[85vw] sm:min-w-[calc(33.333%-1rem)] sticky left-4 z-10 bg-background pr-6 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      <WeaponSection weapon={weapon} compareWeapon={compareUnit?.specs.combat.weapons?.filter(isRegularWeapon)[wIndex]} showDifferencesOnly={showDifferencesOnly} hideDiff />
                    </div>
                    {comparisonRefs.map((_ref, index) => {
                      const compUnit = comparisonUnits[index]
                      const compWeapon = compUnit?.specs.combat.weapons?.filter(isRegularWeapon)[wIndex]
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
                        <AmmoSection ammo={weapon.ammoDetails} compareAmmo={compareUnit?.specs.combat.weapons?.filter(isRegularWeapon)[wIndex]?.ammoDetails} showDifferencesOnly={showDifferencesOnly} hideDiff />
                      </div>
                      {comparisonRefs.map((_ref, index) => {
                        const compUnit = comparisonUnits[index]
                        const compAmmo = compUnit?.specs.combat.weapons?.filter(isRegularWeapon)[wIndex]?.ammoDetails
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
