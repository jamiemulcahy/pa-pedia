import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import type { MobilitySpecs, SpecialSpecs } from '@/types/faction';

interface PhysicsSectionProps {
  mobility: MobilitySpecs;
  special?: SpecialSpecs;
  compareMobility?: MobilitySpecs;
}

export const PhysicsSection: React.FC<PhysicsSectionProps> = ({
  mobility,
  special,
  compareMobility,
}) => {
  const hasAnyStats =
    mobility.moveSpeed !== undefined ||
    mobility.acceleration !== undefined ||
    mobility.brake !== undefined ||
    mobility.turnSpeed !== undefined;

  if (!hasAnyStats) return null;

  return (
    <StatSection title="Physics">
      {mobility.moveSpeed !== undefined && (
        <StatRow
          label="Max speed"
          value={
            <ComparisonValue
              value={mobility.moveSpeed}
              compareValue={compareMobility?.moveSpeed}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {mobility.acceleration !== undefined && (
        <StatRow
          label="Acceleration"
          value={
            <ComparisonValue
              value={mobility.acceleration}
              compareValue={compareMobility?.acceleration}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {mobility.brake !== undefined && (
        <StatRow
          label="Braking rate"
          value={
            <ComparisonValue
              value={mobility.brake}
              compareValue={compareMobility?.brake}
              comparisonType="higher-better"
            />
          }
        />
      )}
      {mobility.turnSpeed !== undefined && (
        <StatRow
          label="Turn rate"
          value={
            <ComparisonValue
              value={mobility.turnSpeed}
              compareValue={compareMobility?.turnSpeed}
              comparisonType="higher-better"
            />
          }
        />
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
