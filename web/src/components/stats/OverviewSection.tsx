import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import { ComparisonValue } from '../ComparisonValue';
import type { Unit } from '@/types/faction';

interface OverviewSectionProps {
  unit: Unit;
  compareUnit?: Unit;
  factionId?: string;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ unit, compareUnit, factionId }) => {
  const { specs } = unit;
  const maxRange = specs.combat.weapons
    ?.filter(w => w.maxRange !== undefined)
    .reduce((max, w) => Math.max(max, w.maxRange || 0), 0);

  const compareWeaponsWithRange = compareUnit?.specs.combat.weapons
    ?.filter(w => w.maxRange !== undefined);
  const compareMaxRange = compareWeaponsWithRange?.length
    ? compareWeaponsWithRange.reduce((max, w) => Math.max(max, w.maxRange || 0), 0)
    : undefined;

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
          factionId={factionId}
        />
      </div>
      <StatRow
        label="HP"
        value={
          <ComparisonValue
            value={specs.combat.health}
            compareValue={compareUnit?.specs.combat.health}
            comparisonType="higher-better"
            formatDiff={(d) => Math.abs(d).toLocaleString()}
          />
        }
      />
      <StatRow
        label="Build cost"
        value={
          <span>
            <ComparisonValue
              value={specs.economy.buildCost}
              compareValue={compareUnit?.specs.economy.buildCost}
              comparisonType="lower-better"
              formatDiff={(d) => Math.abs(d).toLocaleString()}
            />
            {' metal'}
          </span>
        }
      />
      {maxRange !== undefined && maxRange > 0 && (
        <StatRow
          label="Maximum range"
          value={
            <ComparisonValue
              value={maxRange}
              compareValue={compareMaxRange}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {specs.combat.dps !== undefined && specs.combat.dps > 0 && (
        <StatRow
          label="Total DPS"
          value={
            <ComparisonValue
              value={Number(specs.combat.dps.toFixed(1))}
              compareValue={compareUnit?.specs.combat.dps ? Number(compareUnit.specs.combat.dps.toFixed(1)) : undefined}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {buildLocations.length > 0 && (
        <StatRow label="Build locations" value={buildLocations.join(', ')} />
      )}
    </StatSection>
  );
};
