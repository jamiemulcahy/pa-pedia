import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import type { ReconSpecs } from '@/types/faction';

interface ReconSectionProps {
  recon: ReconSpecs;
  compareRecon?: ReconSpecs;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
}

/** Check if two values are different (for comparison filtering) */
function isDifferent(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined && b === undefined) return false;
  if (a === undefined || b === undefined) return true;
  return a !== b;
}

export const ReconSection: React.FC<ReconSectionProps> = ({ recon, compareRecon, showDifferencesOnly, hideDiff }) => {
  const hasAnyRecon =
    recon.visionRadius !== undefined ||
    recon.underwaterVisionRadius !== undefined ||
    recon.orbitalVisionRadius !== undefined ||
    recon.mineVisionRadius !== undefined ||
    recon.radarRadius !== undefined ||
    recon.sonarRadius !== undefined ||
    recon.orbitalRadarRadius !== undefined;

  if (!hasAnyRecon) return null;

  // Check which rows have differences
  const visionDiff = isDifferent(recon.visionRadius, compareRecon?.visionRadius);
  const underwaterDiff = isDifferent(recon.underwaterVisionRadius, compareRecon?.underwaterVisionRadius);
  const orbitalVisionDiff = isDifferent(recon.orbitalVisionRadius, compareRecon?.orbitalVisionRadius);
  const mineDiff = isDifferent(recon.mineVisionRadius, compareRecon?.mineVisionRadius);
  const radarDiff = isDifferent(recon.radarRadius, compareRecon?.radarRadius);
  const sonarDiff = isDifferent(recon.sonarRadius, compareRecon?.sonarRadius);
  const orbitalRadarDiff = isDifferent(recon.orbitalRadarRadius, compareRecon?.orbitalRadarRadius);

  // In diff mode with compare recon, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareRecon ||
    visionDiff || underwaterDiff || orbitalVisionDiff || mineDiff || radarDiff || sonarDiff || orbitalRadarDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !compareRecon || hasDiff;

  return (
    <StatSection title="Recon">
      {recon.visionRadius !== undefined && showRow(visionDiff) && (
        <StatRow
          label="Vision radius"
          value={
            <ComparisonValue
              value={recon.visionRadius}
              compareValue={compareRecon?.visionRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {recon.underwaterVisionRadius !== undefined && recon.underwaterVisionRadius > 0 && showRow(underwaterDiff) ? (
        <StatRow
          label="Underwater vision radius"
          value={
            <ComparisonValue
              value={recon.underwaterVisionRadius}
              compareValue={compareRecon?.underwaterVisionRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      ) : recon.visionRadius !== undefined && showRow(underwaterDiff) && (
        <StatRow label="No underwater vision" value="" />
      )}
      {recon.orbitalVisionRadius !== undefined && showRow(orbitalVisionDiff) && (
        <StatRow
          label="Orbital vision radius"
          value={
            <ComparisonValue
              value={recon.orbitalVisionRadius}
              compareValue={compareRecon?.orbitalVisionRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {recon.mineVisionRadius !== undefined && showRow(mineDiff) && (
        <StatRow
          label="Mine vision radius"
          value={
            <ComparisonValue
              value={recon.mineVisionRadius}
              compareValue={compareRecon?.mineVisionRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {recon.radarRadius !== undefined && showRow(radarDiff) && (
        <StatRow
          label="Radar radius"
          value={
            <ComparisonValue
              value={recon.radarRadius}
              compareValue={compareRecon?.radarRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {recon.sonarRadius !== undefined && showRow(sonarDiff) && (
        <StatRow
          label="Sonar radius"
          value={
            <ComparisonValue
              value={recon.sonarRadius}
              compareValue={compareRecon?.sonarRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {recon.orbitalRadarRadius !== undefined && showRow(orbitalRadarDiff) && (
        <StatRow
          label="Orbital radar radius"
          value={
            <ComparisonValue
              value={recon.orbitalRadarRadius}
              compareValue={compareRecon?.orbitalRadarRadius}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
    </StatSection>
  );
};
