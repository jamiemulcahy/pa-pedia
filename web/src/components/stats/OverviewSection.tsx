import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import { ComparisonValue } from '../ComparisonValue';
import { SpawnUnitLink } from './SpawnUnitLink';
import type { Unit } from '@/types/faction';

interface OverviewSectionProps {
  unit: Unit;
  compareUnit?: Unit;
  factionId?: string;
  showDifferencesOnly?: boolean;
  /** Hide diff indicators (for primary unit side) */
  hideDiff?: boolean;
}

/** Check if two values are different (for comparison filtering) */
function isDifferent(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined && b === undefined) return false;
  if (a === undefined || b === undefined) return true;
  return a !== b;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ unit, compareUnit, factionId, showDifferencesOnly, hideDiff }) => {
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

  const compareBuildLocations: string[] = [];
  if (compareUnit) {
    if (compareUnit.unitTypes.includes('Land')) compareBuildLocations.push('land');
    if (compareUnit.unitTypes.includes('Naval') || compareUnit.unitTypes.includes('Sea')) compareBuildLocations.push('water surface');
    if (compareUnit.unitTypes.includes('Air')) compareBuildLocations.push('air');
    if (compareUnit.unitTypes.includes('Orbital')) compareBuildLocations.push('orbital');
    if (compareUnit.specs.special?.amphibious) compareBuildLocations.push('water');
  }

  // Check which rows have differences (when in comparison mode)
  const hpDiff = isDifferent(specs.combat.health, compareUnit?.specs.combat.health);
  const costDiff = isDifferent(specs.economy.buildCost, compareUnit?.specs.economy.buildCost);
  const rangeDiff = isDifferent(maxRange, compareMaxRange);
  const dpsDiff = isDifferent(specs.combat.dps, compareUnit?.specs.combat.dps);
  const buildLocDiff = buildLocations.join(',') !== compareBuildLocations.join(',');
  const spawnDiff = specs.special?.spawnUnitOnDeath !== compareUnit?.specs.special?.spawnUnitOnDeath;

  // In diff mode with compare unit, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareUnit ||
    hpDiff || costDiff || rangeDiff || dpsDiff || buildLocDiff || spawnDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !compareUnit || hasDiff;

  return (
    <StatSection title="Overview">
      <div className="py-1">
        <BlueprintLink
          resourceName={unit.resourceName}
          displayName="View Blueprint"
          factionId={factionId}
        />
      </div>
      {showRow(hpDiff) && (
        <StatRow
          label="HP"
          value={
            <ComparisonValue
              value={specs.combat.health}
              compareValue={compareUnit?.specs.combat.health}
              comparisonType="higher-better"
              formatDiff={(d) => Math.abs(d).toLocaleString()}
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {showRow(costDiff) && (
        <StatRow
          label="Build cost"
          value={
            <span>
              <ComparisonValue
                value={specs.economy.buildCost}
                compareValue={compareUnit?.specs.economy.buildCost}
                comparisonType="lower-better"
                formatDiff={(d) => Math.abs(d).toLocaleString()}
                hideDiff={hideDiff}
              />
              {' metal'}
            </span>
          }
        />
      )}
      {maxRange !== undefined && maxRange > 0 && showRow(rangeDiff) && (
        <StatRow
          label="Maximum range"
          value={
            <ComparisonValue
              value={maxRange}
              compareValue={compareMaxRange}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {specs.combat.dps !== undefined && specs.combat.dps > 0 && showRow(dpsDiff) && (
        <StatRow
          label="Total DPS"
          value={
            <ComparisonValue
              value={Number(specs.combat.dps.toFixed(1))}
              compareValue={compareUnit?.specs.combat.dps ? Number(compareUnit.specs.combat.dps.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {buildLocations.length > 0 && showRow(buildLocDiff) && (
        <StatRow label="Build locations" value={buildLocations.join(', ')} />
      )}
      {specs.special?.spawnUnitOnDeath && showRow(spawnDiff) && (
        <StatRow
          label="Spawns on death"
          value={
            <SpawnUnitLink
              resourcePath={specs.special.spawnUnitOnDeath}
              factionId={factionId}
            />
          }
        />
      )}
    </StatSection>
  );
};
