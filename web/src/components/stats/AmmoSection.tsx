import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import { SpawnUnitLink } from './SpawnUnitLink';
import { ComparisonValue } from '../ComparisonValue';
import { isDifferent } from '@/utils/comparison';
import { useCurrentFaction } from '@/contexts/CurrentFactionContext';
import type { Ammo } from '@/types/faction';

interface AmmoSectionProps {
  ammo: Ammo;
  compareAmmo?: Ammo;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
  /** Optional faction ID override (used for comparison mode) */
  factionId?: string;
}

export const AmmoSection: React.FC<AmmoSectionProps> = ({ ammo, compareAmmo, showDifferencesOnly, hideDiff, factionId: propFactionId }) => {
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
  const calculateFalloffBreakdown = (damage: number, fullRadius: number, splashRadius: number) => {
    const midRadius = Math.round((fullRadius + splashRadius) / 2);
    const midDamage = Math.round(damage * (1 - (midRadius - fullRadius) / (splashRadius - fullRadius)));
    return [
      { radius: `0-${fullRadius}`, damage, percent: 100 },
      { radius: `${midRadius}`, damage: midDamage, percent: 50 },
      { radius: `${splashRadius}`, damage: 0, percent: 0 },
    ];
  };

  // Determine if we should show falloff breakdown
  const showFalloff = effectiveSplashDamage !== undefined &&
    ammo.fullDamageRadius !== undefined &&
    ammo.splashRadius !== undefined &&
    ammo.fullDamageRadius < ammo.splashRadius;

  const falloffBreakdown = showFalloff
    ? calculateFalloffBreakdown(effectiveSplashDamage!, ammo.fullDamageRadius!, ammo.splashRadius!)
    : null;

  // Check which rows have differences
  const damageDiff = isDifferent(ammo.damage, compareAmmo?.damage);
  const splashDamageDiff = isDifferent(effectiveSplashDamage, compareEffectiveSplashDamage);
  const splashRadiusDiff = isDifferent(ammo.splashRadius, compareAmmo?.splashRadius);
  const fullDamageRadiusDiff = isDifferent(ammo.fullDamageRadius, compareAmmo?.fullDamageRadius);
  const muzzleVelDiff = isDifferent(ammo.muzzleVelocity, compareAmmo?.muzzleVelocity);
  const maxVelDiff = isDifferent(ammo.maxVelocity, compareAmmo?.maxVelocity);
  const spawnDiff = isDifferent(ammo.spawnUnitOnDeath, compareAmmo?.spawnUnitOnDeath);

  // In diff mode with compare ammo, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareAmmo ||
    damageDiff || splashDamageDiff || splashRadiusDiff || fullDamageRadiusDiff || muzzleVelDiff || maxVelDiff || spawnDiff;

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
        />
      </div>
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
