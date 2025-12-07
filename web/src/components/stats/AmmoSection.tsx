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

  // Check which rows have differences
  const damageDiff = isDifferent(ammo.damage, compareAmmo?.damage);
  const splashDamageDiff = isDifferent(ammo.splashDamage, compareAmmo?.splashDamage) || isDifferent(ammo.splashRadius, compareAmmo?.splashRadius);
  const muzzleVelDiff = isDifferent(ammo.muzzleVelocity, compareAmmo?.muzzleVelocity);
  const maxVelDiff = isDifferent(ammo.maxVelocity, compareAmmo?.maxVelocity);
  const spawnDiff = isDifferent(ammo.spawnUnitOnDeath, compareAmmo?.spawnUnitOnDeath);

  // In diff mode with compare ammo, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareAmmo ||
    damageDiff || splashDamageDiff || muzzleVelDiff || maxVelDiff || spawnDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !compareAmmo || hasDiff;

  return (
    <StatSection title="Ammo">
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
      {ammo.splashDamage !== undefined && ammo.splashRadius !== undefined && showRow(splashDamageDiff) && (
        <StatRow
          label="Burn damage"
          value={
            <span>
              <ComparisonValue
                value={ammo.splashDamage}
                compareValue={compareAmmo?.splashDamage}
                comparisonType="higher-better"
                hideDiff={hideDiff}
              />
              {`, radius `}
              <ComparisonValue
                value={ammo.splashRadius}
                compareValue={compareAmmo?.splashRadius}
                comparisonType="higher-better"
                hideDiff={hideDiff}
              />
            </span>
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
