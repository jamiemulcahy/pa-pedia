import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import type { MobilitySpecs, SpecialSpecs } from '@/types/faction';

interface PhysicsSectionProps {
  mobility: MobilitySpecs;
  special?: SpecialSpecs;
  compareMobility?: MobilitySpecs;
  compareSpecial?: SpecialSpecs;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
}

/** Check if two values are different (for comparison filtering) */
function isDifferent(a: number | boolean | undefined, b: number | boolean | undefined): boolean {
  if (a === undefined && b === undefined) return false;
  if (a === undefined || b === undefined) return true;
  return a !== b;
}

export const PhysicsSection: React.FC<PhysicsSectionProps> = ({
  mobility,
  special,
  compareMobility,
  compareSpecial,
  showDifferencesOnly,
  hideDiff,
}) => {
  const hasAnyStats =
    mobility.moveSpeed !== undefined ||
    mobility.acceleration !== undefined ||
    mobility.brake !== undefined ||
    mobility.turnSpeed !== undefined;

  if (!hasAnyStats) return null;

  // Check which rows have differences
  const speedDiff = isDifferent(mobility.moveSpeed, compareMobility?.moveSpeed);
  const accelDiff = isDifferent(mobility.acceleration, compareMobility?.acceleration);
  const brakeDiff = isDifferent(mobility.brake, compareMobility?.brake);
  const turnDiff = isDifferent(mobility.turnSpeed, compareMobility?.turnSpeed);
  const amphibDiff = isDifferent(special?.amphibious, compareSpecial?.amphibious);
  const hoverDiff = isDifferent(special?.hover, compareSpecial?.hover);

  // In diff mode with compare mobility, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareMobility ||
    speedDiff || accelDiff || brakeDiff || turnDiff || amphibDiff || hoverDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !compareMobility || hasDiff;

  return (
    <StatSection title="Physics">
      {mobility.moveSpeed !== undefined && showRow(speedDiff) && (
        <StatRow
          label="Max speed"
          value={
            <ComparisonValue
              value={mobility.moveSpeed}
              compareValue={compareMobility?.moveSpeed}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {mobility.acceleration !== undefined && showRow(accelDiff) && (
        <StatRow
          label="Acceleration"
          value={
            <ComparisonValue
              value={mobility.acceleration}
              compareValue={compareMobility?.acceleration}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {mobility.brake !== undefined && showRow(brakeDiff) && (
        <StatRow
          label="Braking rate"
          value={
            <ComparisonValue
              value={mobility.brake}
              compareValue={compareMobility?.brake}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {mobility.turnSpeed !== undefined && showRow(turnDiff) && (
        <StatRow
          label="Turn rate"
          value={
            <ComparisonValue
              value={mobility.turnSpeed}
              compareValue={compareMobility?.turnSpeed}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
      )}
      {special?.amphibious && showRow(amphibDiff) && (
        <StatRow label="Amphibious" value="Yes" />
      )}
      {special?.hover && showRow(hoverDiff) && (
        <StatRow label="Hover" value="Yes" />
      )}
    </StatSection>
  );
};
