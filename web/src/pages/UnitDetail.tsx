import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUnit } from '@/hooks/useUnit'
import { getUnitIconPath } from '@/services/factionLoader'
import { OverviewSection } from '@/components/stats/OverviewSection'
import { PhysicsSection } from '@/components/stats/PhysicsSection'
import { ReconSection } from '@/components/stats/ReconSection'
import { WeaponSection } from '@/components/stats/WeaponSection'
import { AmmoSection } from '@/components/stats/AmmoSection'
import { TargetPrioritiesSection } from '@/components/stats/TargetPrioritiesSection'
import { BuiltBySection } from '@/components/stats/BuiltBySection'
import { UnitTypesSection } from '@/components/stats/UnitTypesSection'

export function UnitDetail() {
  const { factionId, unitId } = useParams<{ factionId: string; unitId: string }>()
  const { unit, loading, error } = useUnit(factionId || '', unitId || '')

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to={`/faction/${factionId}`} className="text-primary hover:underline mb-4 inline-block">
        &larr; Back to faction
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column - Unit icon and basic info */}
        <div className="md:col-span-1">
          <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 sticky top-4">
            <div className="aspect-square mb-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded">
              <img
                src={getUnitIconPath(factionId || '', unitId || '')}
                alt={unit.displayName}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = ''
                }}
              />
            </div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              {unit.displayName}
            </h1>
            {unit.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-4">
                {unit.description}
              </p>
            )}
          </div>
        </div>

        {/* Right column - All stats sections */}
        <div className="md:col-span-2 space-y-6">
          <OverviewSection unit={unit} factionId={factionId || ''} />

          {specs.mobility && (
            <PhysicsSection mobility={specs.mobility} special={specs.special} />
          )}

          {specs.recon && <ReconSection recon={specs.recon} />}

          <UnitTypesSection unitTypes={unit.unitTypes} />

          {regularWeapons.map((weapon, idx) => (
            <React.Fragment key={idx}>
              <WeaponSection
                weapon={weapon}
                index={idx}
                factionId={factionId || ''}
                unitId={unitId || ''}
              />
              {weapon.ammoDetails && (
                <AmmoSection
                  ammo={weapon.ammoDetails}
                  factionId={factionId || ''}
                  unitId={unitId || ''}
                />
              )}
            </React.Fragment>
          ))}

          {selfDestructWeapon && (
            <>
              <WeaponSection
                weapon={selfDestructWeapon}
                index={0}
                factionId={factionId || ''}
                unitId={unitId || ''}
              />
              {selfDestructWeapon.ammoDetails && (
                <AmmoSection
                  ammo={selfDestructWeapon.ammoDetails}
                  factionId={factionId || ''}
                  unitId={unitId || ''}
                />
              )}
            </>
          )}

          {deathExplosionWeapon && (
            <>
              <WeaponSection
                weapon={deathExplosionWeapon}
                index={0}
                factionId={factionId || ''}
                unitId={unitId || ''}
              />
              {deathExplosionWeapon.ammoDetails && (
                <AmmoSection
                  ammo={deathExplosionWeapon.ammoDetails}
                  factionId={factionId || ''}
                  unitId={unitId || ''}
                />
              )}
            </>
          )}

          <TargetPrioritiesSection weapons={regularWeapons} />

          <BuiltBySection
            factionId={factionId || ''}
            builtBy={buildRelationships?.builtBy}
            buildCost={specs.economy.buildCost}
          />
        </div>
      </div>
    </div>
  )
}
