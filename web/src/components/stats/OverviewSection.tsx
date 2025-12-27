import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { BlueprintLink } from '../BlueprintLink';
import { ComparisonValue } from '../ComparisonValue';
import { SpawnUnitLink } from './SpawnUnitLink';
import { isDifferent } from '@/utils/comparison';
import type { Unit } from '@/types/faction';
import type { AggregatedGroupStats } from '@/types/group';

/**
 * Calculate sustained DPS for a unit from its weapons.
 * Returns undefined if no weapons have sustained DPS that differs from burst DPS.
 * This ensures consistent behavior with group mode calculation.
 */
function calculateUnitSustainedDps(unit: Unit | undefined): number | undefined {
  if (!unit?.specs.combat.weapons) return undefined;

  // Check if any weapon has sustained DPS that differs from burst
  const hasSustainedWeapons = unit.specs.combat.weapons.some(
    w => !w.selfDestruct && !w.deathExplosion &&
         w.sustainedDps !== undefined && w.sustainedDps !== w.dps
  );

  if (!hasSustainedWeapons) return undefined;

  // Sum sustained DPS: use sustainedDps if available, otherwise use dps
  return unit.specs.combat.weapons.reduce((sum, w) => {
    if (w.selfDestruct || w.deathExplosion) return sum;
    return sum + (w.sustainedDps ?? w.dps ?? 0) * (w.count ?? 1);
  }, 0);
}

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

  // Get sustained DPS - from groupStats or calculated from unit weapons
  const sustainedDps = isGroupMode
    ? groupStats?.totalSustainedDps
    : calculateUnitSustainedDps(unit);

  // Check if we have sustained DPS that differs from burst DPS
  const hasSustainedDps = sustainedDps !== undefined && dps !== undefined && sustainedDps !== dps;

  // Max weapon range
  const maxRange = groupStats?.maxWeaponRange ?? (unit?.specs.combat.weapons
    ?.filter(w => w.maxRange !== undefined)
    .reduce((max, w) => Math.max(max, w.maxRange || 0), 0));

  // Compare values
  const compareHp = compareGroupStats?.totalHp ?? compareUnit?.specs.combat.health;
  const compareBuildCost = compareGroupStats?.totalBuildCost ?? compareUnit?.specs.economy.buildCost;
  const compareDps = compareGroupStats?.totalDps ?? compareUnit?.specs.combat.dps;
  const compareSalvoDamage = compareGroupStats?.totalSalvoDamage ?? compareUnit?.specs.combat.salvoDamage;
  const compareSustainedDps = isGroupMode
    ? compareGroupStats?.totalSustainedDps
    : calculateUnitSustainedDps(compareUnit);
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
  const sustainedDpsDiff = isDifferent(sustainedDps, compareSustainedDps);
  const salvoDiff = isDifferent(salvoDamage, compareSalvoDamage);
  const buildLocDiff = buildLocations.join(',') !== compareBuildLocations.join(',');
  const spawnDiff = !isGroupMode && unit?.specs.special?.spawnUnitOnDeath !== compareUnit?.specs.special?.spawnUnitOnDeath;

  // In diff mode with compare, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !hasCompare ||
    hpDiff || costDiff || rangeDiff || dpsDiff || sustainedDpsDiff || salvoDiff || buildLocDiff || spawnDiff;

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
              compareValue={compareHp !== undefined ? Math.round(compareHp) : undefined}
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
                compareValue={compareBuildCost !== undefined ? Math.round(compareBuildCost) : undefined}
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
          label={hasSustainedDps
            ? (isGroupMode ? "Total DPS (Burst)" : "DPS (Burst)")
            : (isGroupMode ? "Total DPS" : "Total DPS")}
          value={
            <ComparisonValue
              value={Number(dps.toFixed(1))}
              compareValue={compareDps !== undefined ? Number(compareDps.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {hasSustainedDps && showRow(sustainedDpsDiff) && (
        <StatRow
          label={isGroupMode ? "Total DPS (Sustained)" : "DPS (Sustained)"}
          value={
            <ComparisonValue
              value={Number(sustainedDps!.toFixed(1))}
              compareValue={compareSustainedDps !== undefined ? Number(compareSustainedDps.toFixed(1)) : undefined}
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
              compareValue={compareSalvoDamage !== undefined ? Math.round(compareSalvoDamage) : undefined}
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
              compareValue={compareMaxRange !== undefined ? Math.round(compareMaxRange) : undefined}
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
