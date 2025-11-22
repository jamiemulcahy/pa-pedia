import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import type { Unit } from '@/types/faction';

interface OverviewSectionProps {
  unit: Unit;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ unit }) => {
  const { specs } = unit;
  const maxRange = specs.combat.weapons
    ?.filter(w => w.maxRange !== undefined)
    .reduce((max, w) => Math.max(max, w.maxRange || 0), 0);

  // Determine build locations based on unit types
  const buildLocations: string[] = [];
  if (unit.unitTypes.includes('Land')) buildLocations.push('land');
  if (unit.unitTypes.includes('Naval') || unit.unitTypes.includes('Sea')) buildLocations.push('water surface');
  if (unit.unitTypes.includes('Air')) buildLocations.push('air');
  if (unit.unitTypes.includes('Orbital')) buildLocations.push('orbital');
  if (specs.special?.amphibious) buildLocations.push('water');

  return (
    <StatSection title="Overview">
      <div className="py-1">
        <BlueprintLink
          resourceName={unit.resourceName}
          displayName="View Blueprint"
        />
      </div>
      <StatRow label="HP" value={specs.combat.health.toLocaleString()} />
      <StatRow label="Build cost" value={`${specs.economy.buildCost.toLocaleString()} metal`} />
      {maxRange !== undefined && maxRange > 0 && (
        <StatRow label="Maximum range" value={maxRange} />
      )}
      {specs.combat.dps !== undefined && specs.combat.dps > 0 && (
        <StatRow label="Total DPS" value={specs.combat.dps.toFixed(1)} />
      )}
      {buildLocations.length > 0 && (
        <StatRow label="Build locations" value={buildLocations.join(', ')} />
      )}
    </StatSection>
  );
};
