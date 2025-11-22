import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import type { Ammo } from '@/types/faction';

interface AmmoSectionProps {
  ammo: Ammo;
}

export const AmmoSection: React.FC<AmmoSectionProps> = ({ ammo }) => {
  return (
    <StatSection title="Ammo">
      <div className="py-1">
        <BlueprintLink
          resourceName={ammo.resourceName}
          displayName="View Blueprint"
        />
      </div>
      <StatRow label="Type" value="Projectile" />
      <StatRow label="Flight type" value="Ballistic" />
      <StatRow label="Damage target" value="HitPoints" />
      {ammo.damage !== undefined && (
        <StatRow label="Damage" value={ammo.damage} />
      )}
      {ammo.splashDamage !== undefined && ammo.splashRadius !== undefined && (
        <StatRow
          label="Burn damage"
          value={`${ammo.splashDamage}, radius ${ammo.splashRadius}`}
        />
      )}
      {ammo.muzzleVelocity !== undefined && (
        <StatRow label="Muzzle velocity" value={ammo.muzzleVelocity.toFixed(1)} />
      )}
      {ammo.maxVelocity !== undefined && (
        <StatRow label="Max velocity" value={ammo.maxVelocity.toFixed(1)} />
      )}
      <StatRow label="Collision check" value="enemies" />
      <StatRow label="Collision response" value="impact" />
    </StatSection>
  );
};
