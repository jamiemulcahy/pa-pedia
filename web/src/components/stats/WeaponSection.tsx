import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import { ComparisonValue } from '../ComparisonValue';
import { isDifferent } from '@/utils/comparison';
import type { Weapon } from '@/types/faction';

interface WeaponSectionProps {
  weapon: Weapon;
  compareWeapon?: Weapon;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
}

export const WeaponSection: React.FC<WeaponSectionProps> = ({ weapon, compareWeapon, showDifferencesOnly, hideDiff }) => {
  const count = weapon.count ?? 1;
  const compareCount = compareWeapon?.count ?? 1;

  // Determine section title based on weapon type
  // Note: deathExplosion takes precedence because in PA, a weapon triggers
  // either on death (passive) or on self-destruct command (active), not both
  let baseTitle = 'Weapon';
  if (weapon.deathExplosion) {
    baseTitle = 'Death Explosion';
  } else if (weapon.selfDestruct) {
    baseTitle = 'Self-Destruct';
  }
  const title = count > 1 ? `${baseTitle} ×${count}` : baseTitle;

  // Check if weapon has sustained DPS (ammo-limited weapons)
  const hasSustainedDps = weapon.sustainedDps !== undefined && weapon.sustainedDps !== weapon.dps;

  // Format target layers
  const formatTargetLayers = (layers?: string[]) => {
    if (!layers || layers.length === 0) return undefined;
    return layers.join(', ');
  };

  // Extract weapon ID from resource name (last part after last slash)
  const weaponId = weapon.resourceName.split('/').pop() || weapon.resourceName;

  // Display name: prefer explicit name, fall back to weapon ID
  const displayName = weapon.name || weaponId;

  // Check which rows have differences
  const rangeDiff = isDifferent(weapon.maxRange, compareWeapon?.maxRange);
  const projDiff = isDifferent(weapon.projectilesPerFire, compareWeapon?.projectilesPerFire);
  const damageDiff = isDifferent(weapon.damage, compareWeapon?.damage);
  const rofDiff = isDifferent(weapon.rateOfFire, compareWeapon?.rateOfFire);
  const dpsDiff = isDifferent(weapon.dps ? weapon.dps * count : undefined, compareWeapon?.dps ? compareWeapon.dps * compareCount : undefined);
  const sustainedDpsDiff = isDifferent(
    weapon.sustainedDps ? weapon.sustainedDps * count : undefined,
    compareWeapon?.sustainedDps ? compareWeapon.sustainedDps * compareCount : undefined
  );
  const yawDiff = isDifferent(weapon.yawRange, compareWeapon?.yawRange) || isDifferent(weapon.yawRate, compareWeapon?.yawRate);
  const pitchDiff = isDifferent(weapon.pitchRange, compareWeapon?.pitchRange) || isDifferent(weapon.pitchRate, compareWeapon?.pitchRate);
  const targetsDiff = formatTargetLayers(weapon.targetLayers) !== formatTargetLayers(compareWeapon?.targetLayers);
  const ammoSourceDiff = isDifferent(weapon.ammoSource, compareWeapon?.ammoSource);
  const ammoCapDiff = isDifferent(weapon.ammoCapacity, compareWeapon?.ammoCapacity);
  const storedShotsDiff = isDifferent(weapon.ammoShotsToDrain, compareWeapon?.ammoShotsToDrain);
  const ammoDrainDiff = isDifferent(weapon.ammoDrainTime, compareWeapon?.ammoDrainTime);
  const ammoRechargeDiff = isDifferent(weapon.ammoRechargeTime, compareWeapon?.ammoRechargeTime);
  const metalShotDiff = isDifferent(weapon.metalPerShot, compareWeapon?.metalPerShot);
  const energyShotDiff = isDifferent(weapon.energyPerShot, compareWeapon?.energyPerShot);

  // In diff mode with compare weapon, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareWeapon ||
    rangeDiff || projDiff || damageDiff || rofDiff || dpsDiff || sustainedDpsDiff ||
    yawDiff || pitchDiff || targetsDiff || ammoSourceDiff || ammoCapDiff ||
    storedShotsDiff || ammoDrainDiff || ammoRechargeDiff || metalShotDiff || energyShotDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !compareWeapon || hasDiff;

  return (
    <StatSection title={title} subtitle={displayName}>
      {/* Show name on small screens where subtitle is hidden */}
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 md:hidden">
        {displayName}
      </h3>
      <div className="py-1">
        <BlueprintLink
          resourceName={weapon.resourceName}
          displayName="View Blueprint"
          resolvedData={weapon}
        />
      </div>
      {weapon.maxRange !== undefined && showRow(rangeDiff) && (
        <StatRow label="Range" value={weapon.maxRange} />
      )}
      {weapon.projectilesPerFire !== undefined && showRow(projDiff) && (
        <StatRow label="Projectiles per shot" value={weapon.projectilesPerFire} />
      )}
      {weapon.damage !== undefined && showRow(damageDiff) && (
        <StatRow
          label="Damage"
          value={
            <ComparisonValue
              value={Number(weapon.damage.toFixed(0))}
              compareValue={compareWeapon?.damage ? Number(compareWeapon.damage.toFixed(0)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {weapon.rateOfFire !== undefined && showRow(rofDiff) && (
        <StatRow
          label="Rate of Fire"
          value={
            <ComparisonValue
              value={Number(weapon.rateOfFire.toFixed(1))}
              compareValue={compareWeapon?.rateOfFire ? Number(compareWeapon.rateOfFire.toFixed(1)) : undefined}
              comparisonType="higher-better"
              suffix="/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {weapon.dps !== undefined && weapon.dps > 0 && showRow(dpsDiff) && (
        <StatRow
          label={hasSustainedDps ? "DPS (Burst)" : "DPS"}
          tooltip={hasSustainedDps ? "Maximum damage per second at full fire rate, before ammo depletes" : undefined}
          value={
            <ComparisonValue
              value={Number((weapon.dps * count).toFixed(1))}
              compareValue={compareWeapon?.dps ? Number((compareWeapon.dps * compareCount).toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {hasSustainedDps && showRow(sustainedDpsDiff) && (
        <StatRow
          label="DPS (Sustained)"
          tooltip="Continuous damage per second when limited by ammo recovery rate"
          value={
            <ComparisonValue
              value={Number((weapon.sustainedDps! * count).toFixed(1))}
              compareValue={compareWeapon?.sustainedDps ? Number((compareWeapon.sustainedDps * compareCount).toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {weapon.yawRange !== undefined && showRow(yawDiff) && (
        <StatRow label="Yaw" value={`${weapon.yawRange}° at ${weapon.yawRate}° per second`} />
      )}
      {weapon.pitchRange !== undefined && showRow(pitchDiff) && (
        <StatRow label="Pitch" value={`${weapon.pitchRange}° at ${weapon.pitchRate}° per second`} />
      )}
      {formatTargetLayers(weapon.targetLayers) && showRow(targetsDiff) && (
        <StatRow label="Targets" value={formatTargetLayers(weapon.targetLayers)} />
      )}
      {weapon.ammoSource && showRow(ammoSourceDiff) && (
        <StatRow label="Ammo source" value={weapon.ammoSource} />
      )}
      {weapon.ammoCapacity !== undefined && weapon.ammoCapacity > 0 && showRow(ammoCapDiff) && (
        <>
          <StatRow label="Ammo capacity" value={weapon.ammoCapacity} />
          {weapon.ammoShotsToDrain !== undefined && weapon.ammoShotsToDrain > 0 && showRow(storedShotsDiff) && (
            <StatRow
              label="Stored shots"
              tooltip="Number of shots that can be fired before ammo depletes"
              value={weapon.ammoShotsToDrain}
            />
          )}
          {weapon.ammoDrainTime !== undefined && showRow(ammoDrainDiff) && (
            <StatRow
              label="Ammo drain time"
              tooltip="Time to empty ammo reserves when firing continuously"
              value={`${weapon.ammoDrainTime.toFixed(1)}s`}
            />
          )}
          {weapon.ammoRechargeTime !== undefined && showRow(ammoRechargeDiff) && (
            <StatRow
              label="Ammo recharge time"
              tooltip="Time to fully recharge ammo from empty"
              value={`${weapon.ammoRechargeTime.toFixed(1)}s`}
            />
          )}
        </>
      )}
      {weapon.metalPerShot !== undefined && weapon.metalPerShot > 0 && showRow(metalShotDiff) && (
        <StatRow label="Metal per shot" value={weapon.metalPerShot} />
      )}
      {weapon.energyPerShot !== undefined && weapon.energyPerShot > 0 && showRow(energyShotDiff) && (
        <StatRow label="Energy per shot" value={weapon.energyPerShot} />
      )}
    </StatSection>
  );
};
