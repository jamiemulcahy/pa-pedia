import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import { isDifferent } from '@/utils/comparison';
import type { EconomySpecs } from '@/types/faction';
import type { AggregatedGroupStats } from '@/types/group';

/** Pre-aggregated economy values for group mode */
interface GroupEconomyStats {
  metalProduction: number;
  energyProduction: number;
  metalConsumption: number;
  energyConsumption: number;
  metalStorage: number;
  energyStorage: number;
  buildRate: number;
  toolEnergyConsumption: number;
  maxBuildRange?: number;
}

interface EconomySectionProps {
  /** Unit economy specs (for unit mode) */
  economy?: EconomySpecs;
  compareEconomy?: EconomySpecs;
  /** Group economy stats (for group mode) - takes precedence over economy */
  groupStats?: AggregatedGroupStats;
  compareGroupStats?: AggregatedGroupStats;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
}

/** Extract economy values from either group stats or unit economy specs */
function extractEconomyValues(
  economy?: EconomySpecs,
  groupStats?: AggregatedGroupStats
): GroupEconomyStats {
  if (groupStats) {
    return {
      metalProduction: groupStats.totalMetalProduction,
      energyProduction: groupStats.totalEnergyProduction,
      metalConsumption: groupStats.totalMetalConsumption,
      energyConsumption: groupStats.totalEnergyConsumption,
      metalStorage: groupStats.totalMetalStorage,
      energyStorage: groupStats.totalEnergyStorage,
      buildRate: groupStats.totalBuildRate,
      toolEnergyConsumption: groupStats.totalToolEnergyConsumption,
      maxBuildRange: groupStats.maxBuildRange,
    };
  }

  return {
    metalProduction: economy?.production?.metal || 0,
    energyProduction: economy?.production?.energy || 0,
    metalConsumption: economy?.consumption?.metal || 0,
    energyConsumption: economy?.consumption?.energy || 0,
    metalStorage: economy?.storage?.metal || 0,
    energyStorage: economy?.storage?.energy || 0,
    buildRate: economy?.buildRate || 0,
    toolEnergyConsumption: economy?.toolConsumption?.energy || 0,
    maxBuildRange: economy?.buildRange,
  };
}

export const EconomySection: React.FC<EconomySectionProps> = ({
  economy,
  compareEconomy,
  groupStats,
  compareGroupStats,
  showDifferencesOnly,
  hideDiff,
}) => {
  const isGroupMode = !!groupStats;

  // Extract values from either group stats or unit economy
  const stats = extractEconomyValues(economy, groupStats);
  const compareStats = extractEconomyValues(compareEconomy, compareGroupStats);

  // Derived build arm stats (only for unit mode - doesn't make sense for groups)
  const costEffectiveness = !isGroupMode && stats.buildRate > 0 && economy?.buildCost && economy.buildCost > 0
    ? (economy.buildCost + stats.toolEnergyConsumption * (2/3)) / stats.buildRate
    : undefined;
  const compareCostEffectiveness = !isGroupMode && compareStats.buildRate > 0 && compareEconomy?.buildCost
    ? (compareEconomy.buildCost + compareStats.toolEnergyConsumption * (2/3)) / compareStats.buildRate
    : undefined;
  const energyEfficiency = !isGroupMode ? economy?.buildInefficiency : undefined;
  const compareEnergyEfficiency = !isGroupMode ? compareEconomy?.buildInefficiency : undefined;

  // Check if we have any economy stats to display
  const hasProductionStats = stats.metalProduction > 0 || stats.energyProduction > 0;
  const hasConsumptionStats = stats.metalConsumption > 0 || stats.energyConsumption > 0;
  const hasStorageStats = stats.metalStorage > 0 || stats.energyStorage > 0;
  const hasBuildArmStats = stats.buildRate > 0;

  if (!hasProductionStats && !hasConsumptionStats && !hasStorageStats && !hasBuildArmStats) return null;

  const hasCompare = !!compareEconomy || !!compareGroupStats;

  // Check which rows have differences
  const metalProdDiff = isDifferent(stats.metalProduction, compareStats.metalProduction);
  const energyProdDiff = isDifferent(stats.energyProduction, compareStats.energyProduction);
  const metalConsDiff = isDifferent(stats.metalConsumption, compareStats.metalConsumption);
  const energyConsDiff = isDifferent(stats.energyConsumption, compareStats.energyConsumption);
  const metalStorDiff = isDifferent(stats.metalStorage, compareStats.metalStorage);
  const energyStorDiff = isDifferent(stats.energyStorage, compareStats.energyStorage);
  const buildRateDiff = isDifferent(stats.buildRate, compareStats.buildRate);
  const toolEnergyDiff = isDifferent(stats.toolEnergyConsumption, compareStats.toolEnergyConsumption);
  const buildRangeDiff = isDifferent(stats.maxBuildRange, compareStats.maxBuildRange);
  const costEffDiff = isDifferent(costEffectiveness, compareCostEffectiveness);
  const energyEffDiff = isDifferent(energyEfficiency, compareEnergyEfficiency);

  // In diff mode with compare, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !hasCompare ||
    metalProdDiff || energyProdDiff || metalConsDiff || energyConsDiff ||
    metalStorDiff || energyStorDiff || buildRateDiff || toolEnergyDiff ||
    buildRangeDiff || costEffDiff || energyEffDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !hasCompare || hasDiff;

  return (
    <StatSection title="Economy">
      {/* Production stats */}
      {stats.metalProduction > 0 && showRow(metalProdDiff) && (
        <StatRow
          label="Metal production"
          value={
            <ComparisonValue
              value={Number(stats.metalProduction.toFixed(1))}
              compareValue={hasCompare ? Number(compareStats.metalProduction.toFixed(1)) : undefined}
              comparisonType="higher-better"
              suffix="/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {stats.energyProduction > 0 && showRow(energyProdDiff) && (
        <StatRow
          label="Energy production"
          value={
            <ComparisonValue
              value={Number(stats.energyProduction.toFixed(0))}
              compareValue={hasCompare ? Number(compareStats.energyProduction.toFixed(0)) : undefined}
              comparisonType="higher-better"
              suffix="/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {/* Consumption stats (shown in both unit and group mode) */}
      {stats.metalConsumption > 0 && showRow(metalConsDiff) && (
        <StatRow
          label="Metal consumption"
          value={
            <ComparisonValue
              value={Number(stats.metalConsumption.toFixed(1))}
              compareValue={hasCompare ? Number(compareStats.metalConsumption.toFixed(1)) : undefined}
              comparisonType="lower-better"
              suffix="/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {stats.energyConsumption > 0 && showRow(energyConsDiff) && (
        <StatRow
          label="Energy consumption"
          value={
            <ComparisonValue
              value={Number(stats.energyConsumption.toFixed(0))}
              compareValue={hasCompare ? Number(compareStats.energyConsumption.toFixed(0)) : undefined}
              comparisonType="lower-better"
              suffix="/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {/* Storage stats */}
      {stats.metalStorage > 0 && showRow(metalStorDiff) && (
        <StatRow
          label="Metal storage"
          value={
            <ComparisonValue
              value={Number(stats.metalStorage.toFixed(0))}
              compareValue={hasCompare ? Number(compareStats.metalStorage.toFixed(0)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {stats.energyStorage > 0 && showRow(energyStorDiff) && (
        <StatRow
          label="Energy storage"
          value={
            <ComparisonValue
              value={Number(stats.energyStorage.toFixed(0))}
              compareValue={hasCompare ? Number(compareStats.energyStorage.toFixed(0)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {/* Build arm stats */}
      {stats.buildRate > 0 && showRow(buildRateDiff) && (
        <StatRow
          label={isGroupMode ? "Combined build rate" : "Build rate"}
          value={
            <ComparisonValue
              value={Number(stats.buildRate.toFixed(1))}
              compareValue={hasCompare ? Number(compareStats.buildRate.toFixed(1)) : undefined}
              comparisonType="higher-better"
              suffix=" metal/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {stats.toolEnergyConsumption > 0 && showRow(toolEnergyDiff) && (
        <StatRow
          label="Build energy"
          value={
            <ComparisonValue
              value={Number(stats.toolEnergyConsumption.toFixed(0))}
              compareValue={hasCompare ? Number(compareStats.toolEnergyConsumption.toFixed(0)) : undefined}
              comparisonType="lower-better"
              suffix=" energy/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {stats.maxBuildRange !== undefined && stats.maxBuildRange > 0 && showRow(buildRangeDiff) && (
        <StatRow
          label={isGroupMode ? "Max build range" : "Build range"}
          value={
            <ComparisonValue
              value={Number(stats.maxBuildRange.toFixed(0))}
              compareValue={hasCompare && compareStats.maxBuildRange ? Number(compareStats.maxBuildRange.toFixed(0)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {/* Unit-only derived stats */}
      {costEffectiveness !== undefined && showRow(costEffDiff) && (
        <StatRow
          label="Build power cost"
          value={
            <ComparisonValue
              value={Number(costEffectiveness.toFixed(1))}
              compareValue={compareCostEffectiveness ? Number(compareCostEffectiveness.toFixed(1)) : undefined}
              comparisonType="lower-better"
              suffix=" metal"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {energyEfficiency !== undefined && energyEfficiency > 0 && showRow(energyEffDiff) && (
        <StatRow
          label="Energy efficiency"
          value={
            <ComparisonValue
              value={Number(energyEfficiency.toFixed(1))}
              compareValue={compareEnergyEfficiency ? Number(compareEnergyEfficiency.toFixed(1)) : undefined}
              comparisonType="lower-better"
              suffix=" energy/metal"
              hideDiff={hideDiff}
            />
          }
        />
      )}
    </StatSection>
  );
};
