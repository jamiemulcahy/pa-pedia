import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import { ComparisonValue } from '../ComparisonValue';
import type { Weapon } from '@/types/faction';

interface WeaponSectionProps {
  weapon: Weapon;
  compareWeapon?: Weapon;
}

// Helper to calculate burst DPS
function calculateBurstDps(weapon: Weapon): number | undefined {
  const projectiles = weapon.projectilesPerFire ?? 1;
  return weapon.ammoPerShot && weapon.ammoDemand && weapon.ammoDemand > 0 && weapon.damage
    ? (weapon.ammoPerShot / weapon.ammoDemand) * weapon.damage * projectiles
    : undefined;
}

export const WeaponSection: React.FC<WeaponSectionProps> = ({ weapon, compareWeapon }) => {
  const count = weapon.count ?? 1;
  const compareCount = compareWeapon?.count ?? 1;
  const title = count > 1 ? `Weapon ×${count}` : 'Weapon';

  // Calculate burst DPS for weapons with ammo system
  // Burst DPS = (ammo consumed per shot / ammo demand) * damage * projectiles per fire
  // This represents instantaneous damage potential before ammo depletion
  const burstDps = calculateBurstDps(weapon);
  const compareBurstDps = compareWeapon ? calculateBurstDps(compareWeapon) : undefined;

  // Format target layers
  const formatTargetLayers = (layers?: string[]) => {
    if (!layers || layers.length === 0) return undefined;
    return layers.join(', ');
  };

  // Extract weapon ID from resource name (last part after last slash)
  const weaponId = weapon.resourceName.split('/').pop() || weapon.resourceName;

  return (
    <StatSection title={title}>
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
        {weaponId}
      </h3>
      <div className="py-1">
        <BlueprintLink
          resourceName={weapon.resourceName}
          displayName="View Blueprint"
        />
      </div>
      {weapon.maxRange !== undefined && (
        <StatRow label="Range" value={weapon.maxRange} />
      )}
      {weapon.projectilesPerFire !== undefined && (
        <StatRow label="Projectiles per fire" value={weapon.projectilesPerFire} />
      )}
      {weapon.damage !== undefined && (
        <StatRow
          label="Damage"
          value={
            <ComparisonValue
              value={Number(weapon.damage.toFixed(0))}
              compareValue={compareWeapon?.damage ? Number(compareWeapon.damage.toFixed(0)) : undefined}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {weapon.rateOfFire !== undefined && (
        <StatRow
          label="Rate of Fire"
          value={
            <ComparisonValue
              value={Number(weapon.rateOfFire.toFixed(1))}
              compareValue={compareWeapon?.rateOfFire ? Number(compareWeapon.rateOfFire.toFixed(1)) : undefined}
              comparisonType="higher-better"
              suffix="/s"
            />
          }
        />
      )}
      {weapon.dps !== undefined && weapon.dps > 0 && (
        <StatRow
          label="DPS"
          value={
            <ComparisonValue
              value={Number((weapon.dps * count).toFixed(1))}
              compareValue={compareWeapon?.dps ? Number((compareWeapon.dps * compareCount).toFixed(1)) : undefined}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {burstDps !== undefined && burstDps !== weapon.dps && (
        <StatRow
          label="DPS (Burst)"
          value={
            <ComparisonValue
              value={Number((burstDps * count).toFixed(1))}
              compareValue={compareBurstDps ? Number((compareBurstDps * compareCount).toFixed(1)) : undefined}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {weapon.yawRange !== undefined && (
        <StatRow label="Yaw" value={`${weapon.yawRange}° at ${weapon.yawRate}° per second`} />
      )}
      {weapon.pitchRange !== undefined && (
        <StatRow label="Pitch" value={`${weapon.pitchRange}° at ${weapon.pitchRate}° per second`} />
      )}
      {formatTargetLayers(weapon.targetLayers) && (
        <StatRow label="Targets" value={formatTargetLayers(weapon.targetLayers)} />
      )}
      {weapon.ammoSource && (
        <StatRow label="Ammo source" value={weapon.ammoSource} />
      )}
      {weapon.ammoCapacity !== undefined && weapon.ammoCapacity > 0 && (
        <>
          <StatRow label="Ammo capacity" value={weapon.ammoCapacity} />
          {weapon.ammoDrainTime !== undefined && (
            <StatRow label="Ammo drain time" value={`${weapon.ammoDrainTime.toFixed(1)}s`} />
          )}
          {weapon.ammoRechargeTime !== undefined && (
            <StatRow label="Ammo recharge time" value={`${weapon.ammoRechargeTime.toFixed(1)}s`} />
          )}
        </>
      )}
      {weapon.metalPerShot !== undefined && weapon.metalPerShot > 0 && (
        <StatRow label="Metal per shot" value={weapon.metalPerShot} />
      )}
      {weapon.energyPerShot !== undefined && weapon.energyPerShot > 0 && (
        <StatRow label="Energy per shot" value={weapon.energyPerShot} />
      )}
    </StatSection>
  );
};
