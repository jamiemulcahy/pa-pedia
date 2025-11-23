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
import type { Unit } from '@/types/faction'

export function UnitDetail() {
  const { factionId, unitId } = useParams<{ factionId: string; unitId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Parse comparison parameters from URL
  const compareParam = searchParams.get('compare')
  const isComparing = compareParam !== null

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
          <Link to={`/faction/${factionId}`} className="text-primary hover:underline mt-4 inline-block">
            Back to faction
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

  // Render unit panel content (reused for both primary and comparison)
  const renderUnitPanel = (panelUnit: Unit, isComparison: boolean = false, panelFactionId?: string) => {
    const panelSpecs = panelUnit.specs
    const panelWeapons = panelSpecs.combat.weapons || []
    const panelRegularWeapons = panelWeapons.filter(w => !w.selfDestruct && !w.deathExplosion)
    const panelSelfDestruct = panelWeapons.find(w => w.selfDestruct)
    const panelDeathExplosion = panelWeapons.find(w => w.deathExplosion)

    // When comparing, we need to show sections even if this unit doesn't have them
    // to maintain alignment with the other panel
    const otherUnit = isComparison ? unit : compareUnit
    const otherSpecs = otherUnit?.specs
    const otherWeapons = otherSpecs?.combat.weapons || []
    const otherRegularWeapons = otherWeapons.filter(w => !w.selfDestruct && !w.deathExplosion)
    const otherSelfDestruct = otherWeapons.find(w => w.selfDestruct)
    const otherDeathExplosion = otherWeapons.find(w => w.deathExplosion)

    // Determine which sections to show (union of both units' sections)
    const showMobility = panelSpecs.mobility || (isComparing && otherSpecs?.mobility)
    const showRecon = panelSpecs.recon || (isComparing && otherSpecs?.recon)
    const showSelfDestruct = panelSelfDestruct || (isComparing && otherSelfDestruct)
    const showDeathExplosion = panelDeathExplosion || (isComparing && otherDeathExplosion)

    // For weapons, show max of both units' weapon counts
    const maxWeaponCount = isComparing
      ? Math.max(panelRegularWeapons.length, otherRegularWeapons.length)
      : panelRegularWeapons.length

    return (
      <div className="space-y-6">
        {/* Unit card */}
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
          <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded max-w-[200px] mx-auto">
            <UnitIcon
              imagePath={panelUnit.image}
              alt={panelUnit.displayName}
              className="max-w-full max-h-full object-contain"
              factionId={panelFactionId}
            />
          </div>
          <h2 className={`font-bold mb-2 text-gray-900 dark:text-gray-100 text-center ${isComparison ? 'text-2xl' : 'text-3xl'}`}>
            {panelUnit.displayName}
          </h2>
          {panelUnit.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 italic text-center">
              {panelUnit.description}
            </p>
          )}
        </div>

        <UnitTypesSection unitTypes={panelUnit.unitTypes} />

        <OverviewSection unit={panelUnit} compareUnit={isComparison ? unit : compareUnit} />

        {showMobility && (
          panelSpecs.mobility ? (
            <PhysicsSection
              mobility={panelSpecs.mobility}
              special={panelSpecs.special}
              compareMobility={isComparison ? specs.mobility : compareUnit?.specs.mobility}
              compareSpecial={isComparison ? specs.special : compareUnit?.specs.special}
            />
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm">
              No mobility data
            </div>
          )
        )}

        {showRecon && (
          panelSpecs.recon ? (
            <ReconSection
              recon={panelSpecs.recon}
              compareRecon={isComparison ? specs.recon : compareUnit?.specs.recon}
            />
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm">
              No recon data
            </div>
          )
        )}

        {Array.from({ length: maxWeaponCount }).map((_, index) => {
          const weapon = panelRegularWeapons[index]
          if (weapon) {
            return (
              <React.Fragment key={`${weapon.resourceName}-${index}`}>
                <WeaponSection weapon={weapon} />
                {weapon.ammoDetails && (
                  <AmmoSection ammo={weapon.ammoDetails} />
                )}
              </React.Fragment>
            )
          } else {
            return (
              <div key={`empty-weapon-${index}`} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm">
                No weapon {index + 1}
              </div>
            )
          }
        })}

        {showSelfDestruct && (
          panelSelfDestruct ? (
            <>
              <WeaponSection weapon={panelSelfDestruct} />
              {panelSelfDestruct.ammoDetails && (
                <AmmoSection ammo={panelSelfDestruct.ammoDetails} />
              )}
            </>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm">
              No self-destruct
            </div>
          )
        )}

        {showDeathExplosion && (
          panelDeathExplosion ? (
            <>
              <WeaponSection weapon={panelDeathExplosion} />
              {panelDeathExplosion.ammoDetails && (
                <AmmoSection ammo={panelDeathExplosion.ammoDetails} />
              )}
            </>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm">
              No death explosion
            </div>
          )
        )}

        <TargetPrioritiesSection weapons={panelRegularWeapons} />

        <BuiltBySection
          builtBy={panelUnit.buildRelationships?.builtBy}
          buildCost={panelSpecs.economy.buildCost}
          factionId={panelFactionId}
        />
      </div>
    )
  }

  return (
    <CurrentFactionProvider factionId={factionId || ''}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link to={`/faction/${factionId}`} className="text-primary hover:underline mb-4 inline-block">
          &larr; Back to faction
        </Link>

        {/* Navigation row with breadcrumbs and compare button */}
        {isComparing ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div>
              <BreadcrumbNav factionId={factionId || ''} unitId={unitId} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <BreadcrumbNav
                factionId={compareFactionId || factionId || ''}
                unitId={compareUnitId}
                onUnitChange={(newFactionId, newUnitId) => {
                  const params = new URLSearchParams(searchParams)
                  params.set('compare', `${newFactionId}/${newUnitId}`)
                  navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
                }}
              />
              <div className="flex items-center gap-2">
                {compareUnit && (
                  <button
                    onClick={handleSwap}
                    className="p-2 text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    title="Swap primary and comparison units"
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
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 mb-6">
            <BreadcrumbNav factionId={factionId || ''} unitId={unitId} />
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.set('compare', '')
                navigate(`/faction/${factionId}/unit/${unitId}?${params.toString()}`)
              }}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              Compare
            </button>
          </div>
        )}

        {isComparing ? (
          // Comparison mode layout - render sections side by side for alignment
          <>
            {compareLoading && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Loading comparison unit...
              </div>
            )}

            {compareUnit && (() => {
              const compareSpecs = compareUnit.specs
              const compareWeapons = compareSpecs.combat.weapons || []
              const compareRegularWeapons = compareWeapons.filter(w => !w.selfDestruct && !w.deathExplosion)
              const compareSelfDestruct = compareWeapons.find(w => w.selfDestruct)
              const compareDeathExplosion = compareWeapons.find(w => w.deathExplosion)

              const showMobility = specs.mobility || compareSpecs.mobility
              const showRecon = specs.recon || compareSpecs.recon
              const showSelfDestruct = selfDestructWeapon || compareSelfDestruct
              const showDeathExplosion = deathExplosionWeapon || compareDeathExplosion
              const maxWeaponCount = Math.max(regularWeapons.length, compareRegularWeapons.length)

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
                    <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
                      <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded max-w-[200px] mx-auto">
                        <UnitIcon imagePath={compareUnit.image} alt={compareUnit.displayName} className="max-w-full max-h-full object-contain" factionId={compareFactionId} />
                      </div>
                      <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100 text-center">{compareUnit.displayName}</h2>
                      {compareUnit.description && <p className="text-sm text-gray-600 dark:text-gray-400 italic text-center">{compareUnit.description}</p>}
                    </div>
                  </div>

                  {/* Unit Types row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <UnitTypesSection unitTypes={unit.unitTypes} />
                    <UnitTypesSection unitTypes={compareUnit.unitTypes} />
                  </div>

                  {/* Overview row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <OverviewSection unit={unit} />
                    <OverviewSection unit={compareUnit} compareUnit={unit} factionId={compareFactionId} />
                  </div>

                  {/* Physics row */}
                  {showMobility && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                      {specs.mobility ? (
                        <PhysicsSection mobility={specs.mobility} special={specs.special} />
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No mobility data</div>
                      )}
                      {compareSpecs.mobility ? (
                        <PhysicsSection mobility={compareSpecs.mobility} special={compareSpecs.special} compareMobility={specs.mobility} compareSpecial={specs.special} />
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No mobility data</div>
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
                      {compareSpecs.recon ? (
                        <ReconSection recon={compareSpecs.recon} compareRecon={specs.recon} />
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No recon data</div>
                      )}
                    </div>
                  )}

                  {/* Weapons rows */}
                  {Array.from({ length: maxWeaponCount }).map((_, index) => {
                    const weapon1 = regularWeapons[index]
                    const weapon2 = compareRegularWeapons[index]
                    return (
                      <div key={`weapon-row-${index}`} className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                        {weapon1 ? (
                          <div className="space-y-6">
                            <WeaponSection weapon={weapon1} />
                            {weapon1.ammoDetails && <AmmoSection ammo={weapon1.ammoDetails} />}
                          </div>
                        ) : (
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No weapon {index + 1}</div>
                        )}
                        {weapon2 ? (
                          <div className="space-y-6">
                            <WeaponSection weapon={weapon2} />
                            {weapon2.ammoDetails && <AmmoSection ammo={weapon2.ammoDetails} />}
                          </div>
                        ) : (
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No weapon {index + 1}</div>
                        )}
                      </div>
                    )
                  })}

                  {/* Self-destruct row */}
                  {showSelfDestruct && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                      {selfDestructWeapon ? (
                        <div className="space-y-6">
                          <WeaponSection weapon={selfDestructWeapon} />
                          {selfDestructWeapon.ammoDetails && <AmmoSection ammo={selfDestructWeapon.ammoDetails} />}
                        </div>
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No self-destruct</div>
                      )}
                      {compareSelfDestruct ? (
                        <div className="space-y-6">
                          <WeaponSection weapon={compareSelfDestruct} />
                          {compareSelfDestruct.ammoDetails && <AmmoSection ammo={compareSelfDestruct.ammoDetails} />}
                        </div>
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No self-destruct</div>
                      )}
                    </div>
                  )}

                  {/* Death explosion row */}
                  {showDeathExplosion && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                      {deathExplosionWeapon ? (
                        <div className="space-y-6">
                          <WeaponSection weapon={deathExplosionWeapon} />
                          {deathExplosionWeapon.ammoDetails && <AmmoSection ammo={deathExplosionWeapon.ammoDetails} />}
                        </div>
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No death explosion</div>
                      )}
                      {compareDeathExplosion ? (
                        <div className="space-y-6">
                          <WeaponSection weapon={compareDeathExplosion} />
                          {compareDeathExplosion.ammoDetails && <AmmoSection ammo={compareDeathExplosion.ammoDetails} />}
                        </div>
                      ) : (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center">No death explosion</div>
                      )}
                    </div>
                  )}

                  {/* Target priorities row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <TargetPrioritiesSection weapons={regularWeapons} />
                    <TargetPrioritiesSection weapons={compareRegularWeapons} />
                  </div>

                  {/* Built by row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <BuiltBySection builtBy={buildRelationships?.builtBy} buildCost={specs.economy.buildCost} factionId={factionId} />
                    <BuiltBySection builtBy={compareUnit.buildRelationships?.builtBy} buildCost={compareSpecs.economy.buildCost} factionId={compareFactionId} />
                  </div>
                </div>
              )
            })()}

            {!compareUnit && !compareLoading && !compareUnitId && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Select a unit to compare
              </div>
            )}
          </>
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

              <TargetPrioritiesSection weapons={regularWeapons} />
            </div>
          </div>
        )}
      </div>
    </CurrentFactionProvider>
  )
}
