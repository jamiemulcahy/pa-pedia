import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import { isDifferent } from '@/utils/comparison';
import type { EconomySpecs } from '@/types/faction';

interface EconomySectionProps {
  economy: EconomySpecs;
  compareEconomy?: EconomySpecs;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
}

export const EconomySection: React.FC<EconomySectionProps> = ({
  economy,
  compareEconomy,
  showDifferencesOnly,
  hideDiff,
}) => {
  // Production stats
  const metalProduction = economy.production?.metal || 0;
  const energyProduction = economy.production?.energy || 0;
  const compareMetalProduction = compareEconomy?.production?.metal;
  const compareEnergyProduction = compareEconomy?.production?.energy;

  // Storage stats
  const metalStorage = economy.storage?.metal || 0;
  const energyStorage = economy.storage?.energy || 0;
  const compareMetalStorage = compareEconomy?.storage?.metal;
  const compareEnergyStorage = compareEconomy?.storage?.energy;

  // Build arm stats
  const buildRate = economy.buildRate || 0;
  const compareBuildRate = compareEconomy?.buildRate;
  const energyConsumption = economy.toolConsumption?.energy || 0;
  const compareEnergyConsumption = compareEconomy?.toolConsumption?.energy;
  const buildRange = economy.buildRange || 0;
  const compareBuildRange = compareEconomy?.buildRange;

  // Derived build arm stats
  // Build power cost: total effective metal cost per unit of build rate
  // Includes metal cost + energy consumption converted to metal equivalent (energy × 2/3)
  const costEffectiveness = buildRate > 0 && economy.buildCost > 0
    ? (economy.buildCost + energyConsumption * (2/3)) / buildRate
    : undefined;
  const compareCostEffectiveness = compareBuildRate && compareBuildRate > 0 && compareEconomy?.buildCost
    ? (compareEconomy.buildCost + (compareEnergyConsumption || 0) * (2/3)) / compareBuildRate
    : undefined;
  const energyEfficiency = economy.buildInefficiency;
  const compareEnergyEfficiency = compareEconomy?.buildInefficiency;

  // Check if we have any economy stats to display
  const hasProductionStats = metalProduction > 0 || energyProduction > 0;
  const hasStorageStats = metalStorage > 0 || energyStorage > 0;
  const hasBuildArmStats = buildRate > 0;

  if (!hasProductionStats && !hasStorageStats && !hasBuildArmStats) return null;

  // Check which rows have differences
  const metalProdDiff = isDifferent(metalProduction, compareMetalProduction || 0);
  const energyProdDiff = isDifferent(energyProduction, compareEnergyProduction || 0);
  const metalStorDiff = isDifferent(metalStorage, compareMetalStorage || 0);
  const energyStorDiff = isDifferent(energyStorage, compareEnergyStorage || 0);
  const buildRateDiff = isDifferent(buildRate, compareBuildRate || 0);
  const energyConsDiff = isDifferent(energyConsumption, compareEnergyConsumption || 0);
  const buildRangeDiff = isDifferent(buildRange, compareBuildRange || 0);
  const costEffDiff = isDifferent(costEffectiveness, compareCostEffectiveness);
  const energyEffDiff = isDifferent(energyEfficiency, compareEnergyEfficiency);

  // In diff mode with compare economy, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareEconomy ||
    metalProdDiff || energyProdDiff || metalStorDiff || energyStorDiff ||
    buildRateDiff || energyConsDiff || buildRangeDiff || costEffDiff || energyEffDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !compareEconomy || hasDiff;

  return (
    <StatSection title="Economy">
      {/* Production stats */}
      {metalProduction > 0 && showRow(metalProdDiff) && (
        <StatRow
          label="Metal production"
          value={
            <ComparisonValue
              value={Number(metalProduction.toFixed(1))}
              compareValue={compareMetalProduction ? Number(compareMetalProduction.toFixed(1)) : undefined}
              comparisonType="higher-better"
              suffix="/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {energyProduction > 0 && showRow(energyProdDiff) && (
        <StatRow
          label="Energy production"
          value={
            <ComparisonValue
              value={Number(energyProduction.toFixed(0))}
              compareValue={compareEnergyProduction ? Number(compareEnergyProduction.toFixed(0)) : undefined}
              comparisonType="higher-better"
              suffix="/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {/* Storage stats */}
      {metalStorage > 0 && showRow(metalStorDiff) && (
        <StatRow
          label="Metal storage"
          value={
            <ComparisonValue
              value={Number(metalStorage.toFixed(0))}
              compareValue={compareMetalStorage ? Number(compareMetalStorage.toFixed(0)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {energyStorage > 0 && showRow(energyStorDiff) && (
        <StatRow
          label="Energy storage"
          value={
            <ComparisonValue
              value={Number(energyStorage.toFixed(0))}
              compareValue={compareEnergyStorage ? Number(compareEnergyStorage.toFixed(0)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}

      {/* Build arm stats */}
      {buildRate > 0 && showRow(buildRateDiff) && (
        <StatRow
          label="Build rate"
          value={
            <ComparisonValue
              value={Number(buildRate.toFixed(1))}
              compareValue={compareBuildRate ? Number(compareBuildRate.toFixed(1)) : undefined}
              comparisonType="higher-better"
              suffix=" metal/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {energyConsumption > 0 && showRow(energyConsDiff) && (
        <StatRow
          label="Build energy"
          value={
            <ComparisonValue
              value={Number(energyConsumption.toFixed(0))}
              compareValue={compareEnergyConsumption ? Number(compareEnergyConsumption.toFixed(0)) : undefined}
              comparisonType="lower-better"
              suffix=" energy/s"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {buildRange > 0 && showRow(buildRangeDiff) && (
        <StatRow
          label="Build range"
          value={
            <ComparisonValue
              value={Number(buildRange.toFixed(0))}
              compareValue={compareBuildRange ? Number(compareBuildRange.toFixed(0)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
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
