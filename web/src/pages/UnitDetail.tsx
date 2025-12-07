import React from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useUnit } from '@/hooks/useUnit'
import { UnitIcon } from '@/components/UnitIcon'
import { CurrentFactionProvider } from '@/contexts/CurrentFactionContext'
import { BreadcrumbNav } from '@/components/BreadcrumbNav'
import { OverviewSection } from '@/components/stats/OverviewSection'
import { PhysicsSection } from '@/components/stats/PhysicsSection'
import { ReconSection } from '@/components/stats/ReconSection'
import { WeaponSection } from '@/components/stats/WeaponSection'
import { AmmoSection } from '@/components/stats/AmmoSection'
import { TargetPrioritiesSection } from '@/components/stats/TargetPrioritiesSection'
import { BuiltBySection } from '@/components/stats/BuiltBySection'
import { UnitTypesSection } from '@/components/stats/UnitTypesSection'
import { EconomySection } from '@/components/stats/EconomySection'
import { StorageSection } from '@/components/stats/StorageSection'
import { matchWeaponsByTargetLayers } from '@/utils/weaponMatching'

export function UnitDetail() {
  const { factionId, unitId } = useParams<{ factionId: string; unitId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Parse comparison parameters from URL
  const compareParam = searchParams.get('compare')
  const isComparing = compareParam !== null

  // Check if user came from "All" view
  const fromAll = searchParams.get('from') === 'all'
  const backLink = fromAll ? '/faction' : `/faction/${factionId}`
  const backText = fromAll ? 'Back to all' : 'Back to faction'

  let compareFactionId: string | undefined
  let compareUnitId: string | undefined

  if (compareParam && compareParam.includes('/')) {
    const parts = compareParam.split('/')
    compareFactionId = parts[0]
    compareUnitId = parts[1]
  }

  const { unit, loading, error } = useUnit(factionId || '', unitId || '')
  const { unit: compareUnit, loading: compareLoading } = useUnit(
    compareFactionId || '',
    compareUnitId || ''
  )

  const handleSwap = () => {
    if (compareFactionId && compareUnitId) {
      // Swap primary and comparison units
      navigate(`/faction/${compareFactionId}/unit/${compareUnitId}?compare=${factionId}/${unitId}`)
    }
  }

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
  const regularWeapons = weapons.filter(w => !w.selfDestruct && !w.deathExplosion)
  const selfDestructWeapon = weapons.find(w => w.selfDestruct)
  const deathExplosionWeapon = weapons.find(w => w.deathExplosion)

  return (
    <CurrentFactionProvider factionId={factionId || ''}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link to={backLink} className="text-primary hover:underline mb-4 inline-block">
          &larr; {backText}
        </Link>

        {/* Navigation row with breadcrumbs and compare button */}
        {isComparing ? (
          <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 mb-6">
            <div>
              <BreadcrumbNav factionId={factionId || ''} unitId={unitId} />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <BreadcrumbNav
                  factionId={compareFactionId || factionId || ''}
                  unitId={compareUnitId}
                  onUnitChange={(newFactionId, newUnitId) => {
                    const params = new URLSearchParams(searchParams)
                    params.set('compare', `${newFactionId}/${newUnitId}`)
                    navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
                  }}
                  sourceUnitTypes={unit.unitTypes}
                />
              </div>
              <div className="flex items-center gap-2 justify-end sm:flex-shrink-0">
                {compareUnit && (
                  <button
                    onClick={handleSwap}
                    className="p-2 text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    title="Swap primary and comparison units"
                    aria-label="Swap primary and comparison units"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>
                )}
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
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
            <BreadcrumbNav factionId={factionId || ''} unitId={unitId} />
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.set('compare', '')
                navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
              }}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap self-start sm:flex-shrink-0"
            >
              Compare
            </button>
          </div>
        )}

        {isComparing ? (
          // Comparison mode layout - render sections side by side for alignment
          (() => {
            const compareSpecs = compareUnit?.specs
            const compareWeapons = compareSpecs?.combat.weapons || []
            const compareRegularWeapons = compareWeapons.filter(w => !w.selfDestruct && !w.deathExplosion)
            const compareSelfDestruct = compareWeapons.find(w => w.selfDestruct)
            const compareDeathExplosion = compareWeapons.find(w => w.deathExplosion)

            const showMobility = specs.mobility || compareSpecs?.mobility
            const showRecon = specs.recon || compareSpecs?.recon
            const showSelfDestruct = selfDestructWeapon || compareSelfDestruct
            const showDeathExplosion = deathExplosionWeapon || compareDeathExplosion

            // Match weapons by target layer compatibility instead of by index
            const matchedWeapons = compareUnit
              ? matchWeaponsByTargetLayers(regularWeapons, compareRegularWeapons)
              : regularWeapons.map(w => [w, undefined] as [typeof w, undefined])

            // Placeholder component for when no comparison unit is selected
            const ComparisonPlaceholder = () => (
              <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-800/30 flex items-center justify-center min-h-[200px]">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  {compareLoading ? (
                    <span>Loading comparison unit...</span>
                  ) : (
                    <span>Select a unit to compare using the dropdown above</span>
                  )}
                </div>
              </div>
            )

            return (
              <div className="space-y-6">
                {/* Unit cards row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                    <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded max-w-[200px] mx-auto">
                      <UnitIcon imagePath={unit.image} alt={unit.displayName} className="max-w-full max-h-full object-contain" factionId={factionId} />
                    </div>
                    <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100 text-center">{unit.displayName}</h2>
                    {unit.description && <p className="text-sm text-gray-600 dark:text-gray-400 italic text-center">{unit.description}</p>}
                  </div>
                  {compareUnit ? (
                    <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                      <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded max-w-[200px] mx-auto">
                        <UnitIcon imagePath={compareUnit.image} alt={compareUnit.displayName} className="max-w-full max-h-full object-contain" factionId={compareFactionId} />
                      </div>
                      <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100 text-center">{compareUnit.displayName}</h2>
                      {compareUnit.description && <p className="text-sm text-gray-600 dark:text-gray-400 italic text-center">{compareUnit.description}</p>}
                    </div>
                  ) : (
                    <ComparisonPlaceholder />
                  )}
                </div>

                {/* Unit Types row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                  <UnitTypesSection unitTypes={unit.unitTypes} />
                  {compareUnit ? (
                    <UnitTypesSection unitTypes={compareUnit.unitTypes} />
                  ) : (
                    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                  )}
                </div>

                {/* Overview row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                  <OverviewSection unit={unit} />
                  {compareUnit ? (
                    <OverviewSection unit={compareUnit} compareUnit={unit} factionId={compareFactionId} />
                  ) : (
                    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                  )}
                </div>

                {/* Economy row (includes production, storage, and build arm stats) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                  <EconomySection economy={specs.economy} compareEconomy={compareSpecs?.economy} />
                  {compareUnit ? (
                    <EconomySection economy={compareSpecs!.economy} compareEconomy={specs.economy} />
                  ) : (
                    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                  )}
                </div>

                {/* Physics row */}
                {showMobility && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {specs.mobility ? (
                      <PhysicsSection mobility={specs.mobility} special={specs.special} />
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No mobility data</div>
                    )}
                    {compareUnit ? (
                      compareSpecs?.mobility ? (
                        <PhysicsSection mobility={compareSpecs.mobility} special={compareSpecs.special} compareMobility={specs.mobility} />
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No mobility data</div>
                      )
                    ) : (
                      <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                    )}
                  </div>
                )}

                {/* Recon row */}
                {showRecon && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {specs.recon ? (
                      <ReconSection recon={specs.recon} />
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No recon data</div>
                    )}
                    {compareUnit ? (
                      compareSpecs?.recon ? (
                        <ReconSection recon={compareSpecs.recon} compareRecon={specs.recon} />
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No recon data</div>
                      )
                    ) : (
                      <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                    )}
                  </div>
                )}

                {/* Weapons rows - matched by target layer compatibility */}
                {matchedWeapons.map(([weapon1, weapon2], index) => (
                  <div key={`weapon-row-${index}`} className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {weapon1 ? (
                      <div className="space-y-6">
                        <WeaponSection weapon={weapon1} compareWeapon={weapon2} />
                        {weapon1.ammoDetails && <AmmoSection ammo={weapon1.ammoDetails} />}
                      </div>
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No matching weapon</div>
                    )}
                    {compareUnit ? (
                      weapon2 ? (
                        <div className="space-y-6">
                          <WeaponSection weapon={weapon2} compareWeapon={weapon1} />
                          {weapon2.ammoDetails && <AmmoSection ammo={weapon2.ammoDetails} factionId={compareFactionId || factionId} />}
                        </div>
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No matching weapon</div>
                      )
                    ) : (
                      <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                    )}
                  </div>
                ))}

                {/* Self-destruct row */}
                {showSelfDestruct && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {selfDestructWeapon ? (
                      <div className="space-y-6">
                        <WeaponSection weapon={selfDestructWeapon} compareWeapon={compareSelfDestruct} />
                        {selfDestructWeapon.ammoDetails && <AmmoSection ammo={selfDestructWeapon.ammoDetails} />}
                      </div>
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No self-destruct</div>
                    )}
                    {compareUnit ? (
                      compareSelfDestruct ? (
                        <div className="space-y-6">
                          <WeaponSection weapon={compareSelfDestruct} compareWeapon={selfDestructWeapon} />
                          {compareSelfDestruct.ammoDetails && <AmmoSection ammo={compareSelfDestruct.ammoDetails} factionId={compareFactionId || factionId} />}
                        </div>
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No self-destruct</div>
                      )
                    ) : (
                      <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                    )}
                  </div>
                )}

                {/* Death explosion row */}
                {showDeathExplosion && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {deathExplosionWeapon ? (
                      <div className="space-y-6">
                        <WeaponSection weapon={deathExplosionWeapon} compareWeapon={compareDeathExplosion} />
                        {deathExplosionWeapon.ammoDetails && <AmmoSection ammo={deathExplosionWeapon.ammoDetails} />}
                      </div>
                    ) : (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No death explosion</div>
                    )}
                    {compareUnit ? (
                      compareDeathExplosion ? (
                        <div className="space-y-6">
                          <WeaponSection weapon={compareDeathExplosion} compareWeapon={deathExplosionWeapon} />
                          {compareDeathExplosion.ammoDetails && <AmmoSection ammo={compareDeathExplosion.ammoDetails} factionId={compareFactionId || factionId} />}
                        </div>
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No death explosion</div>
                      )
                    ) : (
                      <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                    )}
                  </div>
                )}

                {/* Storage row */}
                {((specs.storage?.unitStorage ?? 0) > 0 || (compareSpecs?.storage?.unitStorage ?? 0) > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <StorageSection storage={specs.storage} compareStorage={compareSpecs?.storage} />
                    {compareUnit ? (
                      <StorageSection storage={compareSpecs?.storage} compareStorage={specs.storage} />
                    ) : (
                      <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                    )}
                  </div>
                )}

                {/* Target priorities row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                  <TargetPrioritiesSection weapons={regularWeapons} />
                  {compareUnit ? (
                    <TargetPrioritiesSection weapons={compareRegularWeapons} />
                  ) : (
                    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                  )}
                </div>

                {/* Built by row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                  <BuiltBySection builtBy={buildRelationships?.builtBy} buildCost={specs.economy.buildCost} factionId={factionId} />
                  {compareUnit ? (
                    <BuiltBySection builtBy={compareUnit.buildRelationships?.builtBy} buildCost={compareUnit.specs.economy.buildCost} factionId={compareFactionId} />
                  ) : (
                    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/30" />
                  )}
                </div>
              </div>
            )
          })()
        ) : (
          // Normal single-unit layout
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
        )}
      </div>
    </CurrentFactionProvider>
  )
}
