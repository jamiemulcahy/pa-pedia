import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import { isDifferent } from '@/utils/comparison';
import type { ReconSpecs } from '@/types/faction';
import type { AggregatedGroupStats } from '@/types/group';

interface ReconSectionProps {
  /** Unit recon specs (for unit mode) */
  recon?: ReconSpecs;
  compareRecon?: ReconSpecs;
  /** Group stats (for group mode) - takes precedence over recon */
  groupStats?: AggregatedGroupStats;
  compareGroupStats?: AggregatedGroupStats;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
}

export const ReconSection: React.FC<ReconSectionProps> = ({
  recon,
  compareRecon,
  groupStats,
  compareGroupStats,
  showDifferencesOnly,
  hideDiff,
}) => {
  const isGroupMode = !!groupStats;

  // Extract values based on mode
  // For groups: use MAX values (best scout capability)
  const visionRadius = groupStats?.maxVisionRadius ?? recon?.visionRadius;
  const underwaterVisionRadius = groupStats?.maxUnderwaterVisionRadius ?? recon?.underwaterVisionRadius;
  const radarRadius = groupStats?.maxRadarRadius ?? recon?.radarRadius;
  const sonarRadius = groupStats?.maxSonarRadius ?? recon?.sonarRadius;
  // Unit-only fields (not aggregated in groups)
  const orbitalVisionRadius = !isGroupMode ? recon?.orbitalVisionRadius : undefined;
  const mineVisionRadius = !isGroupMode ? recon?.mineVisionRadius : undefined;
  const orbitalRadarRadius = !isGroupMode ? recon?.orbitalRadarRadius : undefined;

  // Compare values
  const compareVisionRadius = compareGroupStats?.maxVisionRadius ?? compareRecon?.visionRadius;
  const compareUnderwaterVisionRadius = compareGroupStats?.maxUnderwaterVisionRadius ?? compareRecon?.underwaterVisionRadius;
  const compareRadarRadius = compareGroupStats?.maxRadarRadius ?? compareRecon?.radarRadius;
  const compareSonarRadius = compareGroupStats?.maxSonarRadius ?? compareRecon?.sonarRadius;
  const compareOrbitalVisionRadius = !isGroupMode ? compareRecon?.orbitalVisionRadius : undefined;
  const compareMineVisionRadius = !isGroupMode ? compareRecon?.mineVisionRadius : undefined;
  const compareOrbitalRadarRadius = !isGroupMode ? compareRecon?.orbitalRadarRadius : undefined;

  const hasAnyRecon =
    visionRadius !== undefined ||
    underwaterVisionRadius !== undefined ||
    orbitalVisionRadius !== undefined ||
    mineVisionRadius !== undefined ||
    radarRadius !== undefined ||
    sonarRadius !== undefined ||
    orbitalRadarRadius !== undefined;

  const hasCompare = !!compareRecon || !!compareGroupStats;

  const compareHasAnyRecon =
    compareVisionRadius !== undefined ||
    compareUnderwaterVisionRadius !== undefined ||
    compareOrbitalVisionRadius !== undefined ||
    compareMineVisionRadius !== undefined ||
    compareRadarRadius !== undefined ||
    compareSonarRadius !== undefined ||
    compareOrbitalRadarRadius !== undefined;

  if (!hasAnyRecon && !compareHasAnyRecon) return null;

  // Check which rows have differences
  const visionDiff = isDifferent(visionRadius, compareVisionRadius);
  const underwaterDiff = isDifferent(underwaterVisionRadius, compareUnderwaterVisionRadius);
  const orbitalVisionDiff = isDifferent(orbitalVisionRadius, compareOrbitalVisionRadius);
  const mineDiff = isDifferent(mineVisionRadius, compareMineVisionRadius);
  const radarDiff = isDifferent(radarRadius, compareRadarRadius);
  const sonarDiff = isDifferent(sonarRadius, compareSonarRadius);
  const orbitalRadarDiff = isDifferent(orbitalRadarRadius, compareOrbitalRadarRadius);

  // In diff mode with compare, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !hasCompare ||
    visionDiff || underwaterDiff || orbitalVisionDiff || mineDiff || radarDiff || sonarDiff || orbitalRadarDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !hasCompare || hasDiff;

  return (
    <StatSection title="Recon">
      {visionRadius !== undefined && showRow(visionDiff) && (
        <StatRow
          label="Vision radius"
          value={
            <ComparisonValue
              value={Math.round(visionRadius)}
              compareValue={compareVisionRadius ? Math.round(compareVisionRadius) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
          tooltip={isGroupMode ? "Maximum vision radius (best scout)" : undefined}
        />
      )}
      {underwaterVisionRadius !== undefined && underwaterVisionRadius > 0 && showRow(underwaterDiff) ? (
        <StatRow
          label="Underwater vision"
          value={
            <ComparisonValue
              value={Math.round(underwaterVisionRadius)}
              compareValue={compareUnderwaterVisionRadius ? Math.round(compareUnderwaterVisionRadius) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
          tooltip={isGroupMode ? "Maximum underwater vision radius" : undefined}
        />
      ) : !isGroupMode && visionRadius !== undefined && showRow(underwaterDiff) && (
        <StatRow label="No underwater vision" value="" />
      )}
      {/* Unit-only fields (not aggregated in groups) */}
      {orbitalVisionRadius !== undefined && showRow(orbitalVisionDiff) && (
        <StatRow
          label="Orbital vision radius"
          value={
            <ComparisonValue
              value={Math.round(orbitalVisionRadius)}
              compareValue={compareOrbitalVisionRadius ? Math.round(compareOrbitalVisionRadius) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {mineVisionRadius !== undefined && showRow(mineDiff) && (
        <StatRow
          label="Mine vision radius"
          value={
            <ComparisonValue
              value={Math.round(mineVisionRadius)}
              compareValue={compareMineVisionRadius ? Math.round(compareMineVisionRadius) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {radarRadius !== undefined && showRow(radarDiff) && (
        <StatRow
          label="Radar radius"
          value={
            <ComparisonValue
              value={Math.round(radarRadius)}
              compareValue={compareRadarRadius ? Math.round(compareRadarRadius) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
          tooltip={isGroupMode ? "Maximum radar detection radius" : undefined}
        />
      )}
      {sonarRadius !== undefined && showRow(sonarDiff) && (
        <StatRow
          label="Sonar radius"
          value={
            <ComparisonValue
              value={Math.round(sonarRadius)}
              compareValue={compareSonarRadius ? Math.round(compareSonarRadius) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
          tooltip={isGroupMode ? "Maximum sonar detection radius" : undefined}
        />
      )}
      {orbitalRadarRadius !== undefined && showRow(orbitalRadarDiff) && (
        <StatRow
          label="Orbital radar radius"
          value={
            <ComparisonValue
              value={Math.round(orbitalRadarRadius)}
              compareValue={compareOrbitalRadarRadius ? Math.round(compareOrbitalRadarRadius) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
    </StatSection>
  );
};
