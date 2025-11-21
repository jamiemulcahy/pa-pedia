import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import type { MobilitySpecs, SpecialSpecs } from '@/types/faction';

interface PhysicsSectionProps {
  mobility: MobilitySpecs;
  special?: SpecialSpecs;
}

export const PhysicsSection: React.FC<PhysicsSectionProps> = ({ mobility, special }) => {
  const hasAnyStats =
    mobility.moveSpeed !== undefined ||
    mobility.acceleration !== undefined ||
    mobility.brake !== undefined ||
    mobility.turnSpeed !== undefined;

  if (!hasAnyStats) return null;

  return (
    <StatSection title="Physics">
      {mobility.moveSpeed !== undefined && (
        <StatRow label="Max speed" value={mobility.moveSpeed} />
      )}
      {mobility.acceleration !== undefined && (
        <StatRow label="Acceleration" value={mobility.acceleration} />
      )}
      {mobility.brake !== undefined && (
        <StatRow label="Braking rate" value={mobility.brake} />
      )}
      {mobility.turnSpeed !== undefined && (
        <StatRow label="Turn rate" value={mobility.turnSpeed} />
      )}
      {special?.amphibious && (
        <StatRow label="Amphibious" value="Yes" />
      )}
      {special?.hover && (
        <StatRow label="Hover" value="Yes" />
      )}
    </StatSection>
  );
};
