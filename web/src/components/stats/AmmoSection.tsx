import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import { SpawnUnitLink } from './SpawnUnitLink';
import { ComparisonValue } from '../ComparisonValue';
import { isDifferent } from '@/utils/comparison';
import { useCurrentFaction } from '@/contexts/CurrentFactionContext';
import type { AmmoBuildCost } from '@/utils/ammoBuild';
import type { Ammo } from '@/types/faction';

interface AmmoSectionProps {
  ammo: Ammo;
  compareAmmo?: Ammo;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
  /** Optional faction ID override (used for comparison mode) */
  factionId?: string;
  /**
   * Cost of building one round, for factory-sourced ammo only. Omitted when the
   * round is not built (e.g. the Ward drains metal directly), because the ammo
   * blueprint's build_metal_cost is then unused and would contradict the weapon's
   * own "Metal per shot".
   */
  buildCost?: AmmoBuildCost;
  compareBuildCost?: AmmoBuildCost;
}

export const AmmoSection: React.FC<AmmoSectionProps> = ({ ammo, compareAmmo, showDifferencesOnly, hideDiff, factionId: propFactionId, buildCost, compareBuildCost }) => {
  const { factionId: contextFactionId } = useCurrentFaction();
  const factionId = propFactionId || contextFactionId;

  // Extract ammo ID from resource name (last part after last slash)
  const ammoId = ammo.resourceName.split('/').pop() || ammo.resourceName;

  // Display name: prefer explicit name, fall back to ammo ID
  const displayName = ammo.name || ammoId;

  // Falloff weapons have splashRadius but no explicit splashDamage - use base damage for full damage at epicenter
  const getEffectiveSplashDamage = (a?: Ammo) =>
    a?.splashDamage ?? (a?.splashRadius ? a.damage : undefined);

  const effectiveSplashDamage = getEffectiveSplashDamage(ammo);
  const compareEffectiveSplashDamage = getEffectiveSplashDamage(compareAmmo);

  // Calculate damage falloff breakdown for splash weapons
  // Within full damage radius: targets receive BASE damage (same as direct hit)
  // From full radius to splash radius: falloff from splash_damage to 0
  const calculateFalloffBreakdown = (
    baseDamage: number,
    splashDamage: number,
    fullRadius: number,
    splashRadius: number
  ) => {
    const midRadius = Math.round((fullRadius + splashRadius) / 2);
    const midDamage = Math.round(splashDamage * (1 - (midRadius - fullRadius) / (splashRadius - fullRadius)));
    return [
      // Full damage radius uses BASE damage, not splash damage
      { radius: `0-${fullRadius}`, damage: baseDamage, percent: 100 },
      { radius: `${midRadius}`, damage: midDamage, percent: Math.round(midDamage / splashDamage * 100) },
      { radius: `${splashRadius}`, damage: 0, percent: 0 },
    ];
  };

  // Determine if we should show falloff breakdown
  const showFalloff = effectiveSplashDamage !== undefined &&
    ammo.fullDamageRadius !== undefined &&
    ammo.splashRadius !== undefined &&
    ammo.fullDamageRadius < ammo.splashRadius;

  const falloffBreakdown = showFalloff
    ? calculateFalloffBreakdown(
        ammo.damage ?? effectiveSplashDamage!,
        effectiveSplashDamage!,
        ammo.fullDamageRadius!,
        ammo.splashRadius!
      )
    : null;

  // Check which rows have differences
  const damageDiff = isDifferent(ammo.damage, compareAmmo?.damage);
  const splashDamageDiff = isDifferent(effectiveSplashDamage, compareEffectiveSplashDamage);
  const splashRadiusDiff = isDifferent(ammo.splashRadius, compareAmmo?.splashRadius);
  const fullDamageRadiusDiff = isDifferent(ammo.fullDamageRadius, compareAmmo?.fullDamageRadius);
  const muzzleVelDiff = isDifferent(ammo.muzzleVelocity, compareAmmo?.muzzleVelocity);
  const maxVelDiff = isDifferent(ammo.maxVelocity, compareAmmo?.maxVelocity);
  const spawnDiff = isDifferent(ammo.spawnUnitOnDeath, compareAmmo?.spawnUnitOnDeath);
  const burnDamageDiff = isDifferent(ammo.burnDamage, compareAmmo?.burnDamage);
  const burnRadiusDiff = isDifferent(ammo.burnRadius, compareAmmo?.burnRadius);
  const burnDurationDiff = isDifferent(ammo.burnDuration, compareAmmo?.burnDuration);
  const buildMetalDiff = isDifferent(buildCost?.metal, compareBuildCost?.metal);
  const buildEnergyDiff = isDifferent(buildCost?.energy, compareBuildCost?.energy);
  const buildTimeDiff = isDifferent(
    buildCost && Number(buildCost.seconds.toFixed(1)),
    compareBuildCost && Number(compareBuildCost.seconds.toFixed(1))
  );

  // In diff mode with compare ammo, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareAmmo ||
    damageDiff || splashDamageDiff || splashRadiusDiff || fullDamageRadiusDiff || muzzleVelDiff || maxVelDiff || spawnDiff ||
    burnDamageDiff || burnRadiusDiff || burnDurationDiff ||
    buildMetalDiff || buildEnergyDiff || buildTimeDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !compareAmmo || hasDiff;

  return (
    <StatSection title="Ammo" subtitle={displayName}>
      {/* Show name on small screens where subtitle is hidden */}
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 md:hidden">
        {displayName}
      </h3>
      <div className="py-1">
        <BlueprintLink
          resourceName={ammo.resourceName}
          displayName="View Blueprint"
          resolvedData={ammo}
        />
      </div>
      {buildCost && showRow(buildMetalDiff) && (
        <StatRow
          label="Metal per shot"
          tooltip="Metal cost of one round — this unit builds its ammo rather than drawing metal as it fires"
          value={
            <ComparisonValue
              value={buildCost.metal}
              compareValue={compareBuildCost?.metal}
              comparisonType="lower-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {buildCost && buildCost.energy > 0 && showRow(buildEnergyDiff) && (
        <StatRow
          label="Energy per shot"
          tooltip="Energy drawn by the build arm over the time it takes to build one round"
          value={
            <ComparisonValue
              value={buildCost.energy}
              compareValue={compareBuildCost?.energy}
              comparisonType="lower-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {buildCost && showRow(buildTimeDiff) && (
        <StatRow
          label="Ammo build time"
          tooltip={`Time to build one round at this unit's build rate of ${Math.round(buildCost.metal / buildCost.seconds)} metal/s`}
          value={
            <ComparisonValue
              value={Number(buildCost.seconds.toFixed(1))}
              compareValue={compareBuildCost && Number(compareBuildCost.seconds.toFixed(1))}
              comparisonType="lower-better"
              suffix="s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {ammo.damage !== undefined && showRow(damageDiff) && (
        <StatRow
          label="Damage"
          value={
            <ComparisonValue
              value={ammo.damage}
              compareValue={compareAmmo?.damage}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {effectiveSplashDamage !== undefined && showRow(splashDamageDiff) && (
        <StatRow
          label="Splash damage"
          value={
            <ComparisonValue
              value={effectiveSplashDamage}
              compareValue={compareEffectiveSplashDamage}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {ammo.splashRadius && showRow(splashRadiusDiff) && (
        <StatRow
          label="Splash radius"
          value={
            <ComparisonValue
              value={ammo.splashRadius}
              compareValue={compareAmmo?.splashRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {ammo.fullDamageRadius !== undefined && showRow(fullDamageRadiusDiff) && (
        <StatRow
          label="Full damage radius"
          value={
            <ComparisonValue
              value={ammo.fullDamageRadius}
              compareValue={compareAmmo?.fullDamageRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {falloffBreakdown && !showDifferencesOnly && (
        <div className="mt-2 mb-3" data-testid="damage-falloff">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Damage falloff:</div>
          <div className="text-sm pl-4 space-y-0.5">
            {falloffBreakdown.map((entry, idx) => (
              <div key={idx} className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>{entry.radius}</span>
                <span>{entry.damage.toLocaleString()} ({entry.percent}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {ammo.burnDamage !== undefined && ammo.burnDamage > 0 && showRow(burnDamageDiff) && (
        <StatRow
          label="Burn damage"
          tooltip="Total damage dealt over time within the burn radius. Trees only — burn never damages units or structures."
          value={
            <ComparisonValue
              value={ammo.burnDamage}
              compareValue={compareAmmo?.burnDamage}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {ammo.burnRadius !== undefined && ammo.burnRadius > 0 && showRow(burnRadiusDiff) && (
        <StatRow
          label="Burn radius"
          tooltip="Radius of the burn damage area"
          value={
            <ComparisonValue
              value={ammo.burnRadius}
              compareValue={compareAmmo?.burnRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {ammo.burnDuration !== undefined && ammo.burnDuration > 0 && showRow(burnDurationDiff) && (
        <StatRow
          label="Burn duration"
          tooltip="How long the burn effect lasts"
          value={
            <ComparisonValue
              value={Number(ammo.burnDuration.toFixed(1))}
              compareValue={compareAmmo?.burnDuration ? Number(compareAmmo.burnDuration.toFixed(1)) : undefined}
              comparisonType="higher-better"
              suffix="s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {ammo.muzzleVelocity !== undefined && showRow(muzzleVelDiff) && (
        <StatRow
          label="Muzzle velocity"
          value={
            <ComparisonValue
              value={Number(ammo.muzzleVelocity.toFixed(1))}
              compareValue={compareAmmo?.muzzleVelocity ? Number(compareAmmo.muzzleVelocity.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {ammo.maxVelocity !== undefined && showRow(maxVelDiff) && (
        <StatRow
          label="Max velocity"
          value={
            <ComparisonValue
              value={Number(ammo.maxVelocity.toFixed(1))}
              compareValue={compareAmmo?.maxVelocity ? Number(compareAmmo.maxVelocity.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {ammo.spawnUnitOnDeath && showRow(spawnDiff) && (
        <StatRow
          label="Spawns on death"
          value={
            <SpawnUnitLink
              resourcePath={ammo.spawnUnitOnDeath}
              withVelocity={ammo.spawnUnitOnDeathWithVelocity}
              factionId={factionId}
            />
          }
        />
      )}
    </StatSection>
  );
};
