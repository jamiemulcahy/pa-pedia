import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import type { ReconSpecs } from '@/types/faction';

interface ReconSectionProps {
  recon: ReconSpecs;
}

export const ReconSection: React.FC<ReconSectionProps> = ({ recon }) => {
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
        <StatRow label="Vision radius" value={recon.visionRadius} />
      )}
      {recon.underwaterVisionRadius !== undefined && recon.underwaterVisionRadius > 0 ? (
        <StatRow label="Underwater vision radius" value={recon.underwaterVisionRadius} />
      ) : recon.visionRadius !== undefined && (
        <StatRow label="No underwater vision" value="" />
      )}
      {recon.orbitalVisionRadius !== undefined && (
        <StatRow label="Orbital vision radius" value={recon.orbitalVisionRadius} />
      )}
      {recon.mineVisionRadius !== undefined && (
        <StatRow label="Mine vision radius" value={recon.mineVisionRadius} />
      )}
      {recon.radarRadius !== undefined && (
        <StatRow label="Radar radius" value={recon.radarRadius} />
      )}
      {recon.sonarRadius !== undefined && (
        <StatRow label="Sonar radius" value={recon.sonarRadius} />
      )}
      {recon.orbitalRadarRadius !== undefined && (
        <StatRow label="Orbital radar radius" value={recon.orbitalRadarRadius} />
      )}
    </StatSection>
  );
};
