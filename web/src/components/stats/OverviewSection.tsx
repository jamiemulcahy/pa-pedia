import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import { ComparisonValue } from '../ComparisonValue';
import { SpawnUnitLink } from './SpawnUnitLink';
import { isDifferent } from '@/utils/comparison';
import type { Unit } from '@/types/faction';
import type { AggregatedGroupStats } from '@/types/group';

interface OverviewSectionProps {
  /** Unit for unit mode */
  unit?: Unit;
  compareUnit?: Unit;
  /** Group stats for group mode - takes precedence over unit */
  groupStats?: AggregatedGroupStats;
  compareGroupStats?: AggregatedGroupStats;
  factionId?: string;
  showDifferencesOnly?: boolean;
  /** Hide diff indicators (for primary unit side) */
  hideDiff?: boolean;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  unit,
  compareUnit,
  groupStats,
  compareGroupStats,
  factionId,
  showDifferencesOnly,
  hideDiff,
}) => {
  const isGroupMode = !!groupStats;

  // Extract values based on mode
  const hp = groupStats?.totalHp ?? unit?.specs.combat.health ?? 0;
  const buildCost = groupStats?.totalBuildCost ?? unit?.specs.economy.buildCost ?? 0;
  const dps = groupStats?.totalDps ?? unit?.specs.combat.dps;
  const salvoDamage = groupStats?.totalSalvoDamage ?? unit?.specs.combat.salvoDamage;

  // Max weapon range
  const maxRange = groupStats?.maxWeaponRange ?? (unit?.specs.combat.weapons
    ?.filter(w => w.maxRange !== undefined)
    .reduce((max, w) => Math.max(max, w.maxRange || 0), 0));

  // Compare values
  const compareHp = compareGroupStats?.totalHp ?? compareUnit?.specs.combat.health;
  const compareBuildCost = compareGroupStats?.totalBuildCost ?? compareUnit?.specs.economy.buildCost;
  const compareDps = compareGroupStats?.totalDps ?? compareUnit?.specs.combat.dps;
  const compareSalvoDamage = compareGroupStats?.totalSalvoDamage ?? compareUnit?.specs.combat.salvoDamage;
  const compareMaxRange = compareGroupStats?.maxWeaponRange ?? (compareUnit?.specs.combat.weapons
    ?.filter(w => w.maxRange !== undefined)
    .reduce((max, w) => Math.max(max, w.maxRange || 0), 0));

  // Unit-only: build locations
  const buildLocations: string[] = [];
  if (!isGroupMode && unit) {
    if (unit.unitTypes.includes('Land')) buildLocations.push('land');
    if (unit.unitTypes.includes('Naval') || unit.unitTypes.includes('Sea')) buildLocations.push('water surface');
    if (unit.unitTypes.includes('Air')) buildLocations.push('air');
    if (unit.unitTypes.includes('Orbital')) buildLocations.push('orbital');
    if (unit.specs.special?.amphibious) buildLocations.push('water');
  }

  const compareBuildLocations: string[] = [];
  if (!isGroupMode && compareUnit) {
    if (compareUnit.unitTypes.includes('Land')) compareBuildLocations.push('land');
    if (compareUnit.unitTypes.includes('Naval') || compareUnit.unitTypes.includes('Sea')) compareBuildLocations.push('water surface');
    if (compareUnit.unitTypes.includes('Air')) compareBuildLocations.push('air');
    if (compareUnit.unitTypes.includes('Orbital')) compareBuildLocations.push('orbital');
    if (compareUnit.specs.special?.amphibious) compareBuildLocations.push('water');
  }

  const hasCompare = !!compareUnit || !!compareGroupStats;

  // Check which rows have differences
  const hpDiff = isDifferent(hp, compareHp);
  const costDiff = isDifferent(buildCost, compareBuildCost);
  const rangeDiff = isDifferent(maxRange, compareMaxRange);
  const dpsDiff = isDifferent(dps, compareDps);
  const salvoDiff = isDifferent(salvoDamage, compareSalvoDamage);
  const buildLocDiff = buildLocations.join(',') !== compareBuildLocations.join(',');
  const spawnDiff = !isGroupMode && unit?.specs.special?.spawnUnitOnDeath !== compareUnit?.specs.special?.spawnUnitOnDeath;

  // In diff mode with compare, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !hasCompare ||
    hpDiff || costDiff || rangeDiff || dpsDiff || salvoDiff || buildLocDiff || spawnDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !hasCompare || hasDiff;

  return (
    <StatSection title="Overview">
      {/* Blueprint link - unit mode only */}
      {!isGroupMode && unit && (
        <div className="py-1">
          <BlueprintLink
            resourceName={unit.resourceName}
            displayName="View Blueprint"
            factionId={factionId}
            resolvedData={unit}
          />
        </div>
      )}

      {showRow(hpDiff) && (
        <StatRow
          label={isGroupMode ? "Total HP" : "HP"}
          value={
            <ComparisonValue
              value={Math.round(hp)}
              compareValue={compareHp ? Math.round(compareHp) : undefined}
              comparisonType="higher-better"
              formatDiff={(d) => Math.abs(d).toLocaleString()}
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {showRow(costDiff) && (
        <StatRow
          label={isGroupMode ? "Total build cost" : "Build cost"}
          value={
            <span>
              <ComparisonValue
                value={Math.round(buildCost)}
                compareValue={compareBuildCost ? Math.round(compareBuildCost) : undefined}
                comparisonType="lower-better"
                formatDiff={(d) => Math.abs(d).toLocaleString()}
                hideDiff={hideDiff}
              />
              {' metal'}
            </span>
          }
        />
      )}

      {dps !== undefined && dps > 0 && showRow(dpsDiff) && (
        <StatRow
          label={isGroupMode ? "Total DPS" : "Total DPS"}
          value={
            <ComparisonValue
              value={Number(dps.toFixed(1))}
              compareValue={compareDps ? Number(compareDps.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {salvoDamage !== undefined && salvoDamage > 0 && showRow(salvoDiff) && (
        <StatRow
          label={isGroupMode ? "Total salvo damage" : "Salvo damage"}
          value={
            <ComparisonValue
              value={Math.round(salvoDamage)}
              compareValue={compareSalvoDamage ? Math.round(compareSalvoDamage) : undefined}
              comparisonType="higher-better"
              formatDiff={(d) => Math.abs(d).toLocaleString()}
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {maxRange !== undefined && maxRange > 0 && showRow(rangeDiff) && (
        <StatRow
          label={isGroupMode ? "Max weapon range" : "Maximum range"}
          value={
            <ComparisonValue
              value={Math.round(maxRange)}
              compareValue={compareMaxRange ? Math.round(compareMaxRange) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {/* Unit-only stats */}
      {!isGroupMode && buildLocations.length > 0 && showRow(buildLocDiff) && (
        <StatRow label="Build locations" value={buildLocations.join(', ')} />
      )}

      {!isGroupMode && unit?.specs.special?.spawnUnitOnDeath && showRow(spawnDiff) && (
        <StatRow
          label="Spawns on death"
          value={
            <SpawnUnitLink
              resourcePath={unit.specs.special.spawnUnitOnDeath}
              factionId={factionId}
            />
          }
        />
      )}
    </StatSection>
  );
};
