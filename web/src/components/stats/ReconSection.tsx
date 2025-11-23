import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import type { ReconSpecs } from '@/types/faction';

interface ReconSectionProps {
  recon: ReconSpecs;
  compareRecon?: ReconSpecs;
}

export const ReconSection: React.FC<ReconSectionProps> = ({ recon, compareRecon }) => {
  const hasAnyRecon =
    recon.visionRadius !== undefined ||
    recon.underwaterVisionRadius !== undefined ||
    recon.orbitalVisionRadius !== undefined ||
    recon.mineVisionRadius !== undefined ||
    recon.radarRadius !== undefined ||
    recon.sonarRadius !== undefined ||
    recon.orbitalRadarRadius !== undefined;

  if (!hasAnyRecon) return null;

  return (
    <StatSection title="Recon">
      {recon.visionRadius !== undefined && (
        <StatRow
          label="Vision radius"
          value={
            <ComparisonValue
              value={recon.visionRadius}
              compareValue={compareRecon?.visionRadius}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {recon.underwaterVisionRadius !== undefined && recon.underwaterVisionRadius > 0 ? (
        <StatRow
          label="Underwater vision radius"
          value={
            <ComparisonValue
              value={recon.underwaterVisionRadius}
              compareValue={compareRecon?.underwaterVisionRadius}
              comparisonType="higher-better"
            />
          }
        />
      ) : recon.visionRadius !== undefined && (
        <StatRow label="No underwater vision" value="" />
      )}
      {recon.orbitalVisionRadius !== undefined && (
        <StatRow
          label="Orbital vision radius"
          value={
            <ComparisonValue
              value={recon.orbitalVisionRadius}
              compareValue={compareRecon?.orbitalVisionRadius}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {recon.mineVisionRadius !== undefined && (
        <StatRow
          label="Mine vision radius"
          value={
            <ComparisonValue
              value={recon.mineVisionRadius}
              compareValue={compareRecon?.mineVisionRadius}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {recon.radarRadius !== undefined && (
        <StatRow
          label="Radar radius"
          value={
            <ComparisonValue
              value={recon.radarRadius}
              compareValue={compareRecon?.radarRadius}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {recon.sonarRadius !== undefined && (
        <StatRow
          label="Sonar radius"
          value={
            <ComparisonValue
              value={recon.sonarRadius}
              compareValue={compareRecon?.sonarRadius}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {recon.orbitalRadarRadius !== undefined && (
        <StatRow
          label="Orbital radar radius"
          value={
            <ComparisonValue
              value={recon.orbitalRadarRadius}
              compareValue={compareRecon?.orbitalRadarRadius}
              comparisonType="higher-better"
            />
          }
        />
      )}
    </StatSection>
  );
};
