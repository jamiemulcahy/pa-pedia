import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import { isDifferent } from '@/utils/comparison';
import type { MobilitySpecs, SpecialSpecs } from '@/types/faction';
import type { AggregatedGroupStats } from '@/types/group';

interface PhysicsSectionProps {
  /** Unit mobility specs (for unit mode) */
  mobility?: MobilitySpecs;
  special?: SpecialSpecs;
  compareMobility?: MobilitySpecs;
  compareSpecial?: SpecialSpecs;
  /** Group stats (for group mode) - takes precedence over mobility/special */
  groupStats?: AggregatedGroupStats;
  compareGroupStats?: AggregatedGroupStats;
  showDifferencesOnly?: boolean;
  hideDiff?: boolean;
}

/** Format boolean aggregation for display */
function formatBooleanAggregation(any: boolean, all: boolean): string {
  if (all) return 'Yes (all)';
  if (any) return 'Some';
  return 'None';
}

export const PhysicsSection: React.FC<PhysicsSectionProps> = ({
  mobility,
  special,
  compareMobility,
  compareSpecial,
  groupStats,
  compareGroupStats,
  showDifferencesOnly,
  hideDiff,
}) => {
  const isGroupMode = !!groupStats;

  // Extract values based on mode
  // For groups: use MIN values (slowest unit limits group)
  const moveSpeed = groupStats?.minMoveSpeed ?? mobility?.moveSpeed;
  const acceleration = groupStats?.minAcceleration ?? mobility?.acceleration;
  const brake = groupStats?.minBrake ?? mobility?.brake;
  const turnSpeed = groupStats?.minTurnSpeed ?? mobility?.turnSpeed;
  const isAmphibious = groupStats ? groupStats.anyAmphibious : special?.amphibious;
  const isHover = groupStats ? groupStats.anyHover : special?.hover;

  // Compare values
  const compareMoveSpeed = compareGroupStats?.minMoveSpeed ?? compareMobility?.moveSpeed;
  const compareAcceleration = compareGroupStats?.minAcceleration ?? compareMobility?.acceleration;
  const compareBrake = compareGroupStats?.minBrake ?? compareMobility?.brake;
  const compareTurnSpeed = compareGroupStats?.minTurnSpeed ?? compareMobility?.turnSpeed;
  const compareIsAmphibious = compareGroupStats ? compareGroupStats.anyAmphibious : compareSpecial?.amphibious;
  const compareIsHover = compareGroupStats ? compareGroupStats.anyHover : compareSpecial?.hover;

  // Check if we have any stats
  const hasAnyStats =
    moveSpeed !== undefined ||
    acceleration !== undefined ||
    brake !== undefined ||
    turnSpeed !== undefined ||
    isAmphibious ||
    isHover;

  const hasCompare = !!compareMobility || !!compareGroupStats;

  const compareHasAnyStats =
    compareMoveSpeed !== undefined ||
    compareAcceleration !== undefined ||
    compareBrake !== undefined ||
    compareTurnSpeed !== undefined ||
    compareIsAmphibious ||
    compareIsHover;

  if (!hasAnyStats && !compareHasAnyStats) return null;

  // Check which rows have differences
  const speedDiff = isDifferent(moveSpeed, compareMoveSpeed);
  const accelDiff = isDifferent(acceleration, compareAcceleration);
  const brakeDiff = isDifferent(brake, compareBrake);
  const turnDiff = isDifferent(turnSpeed, compareTurnSpeed);
  const amphibDiff = isDifferent(isAmphibious, compareIsAmphibious);
  const hoverDiff = isDifferent(isHover, compareIsHover);

  // In diff mode with compare, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !hasCompare ||
    speedDiff || accelDiff || brakeDiff || turnDiff || amphibDiff || hoverDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !hasCompare || hasDiff;

  return (
    <StatSection title={isGroupMode ? "Mobility" : "Physics"}>
      {moveSpeed !== undefined && showRow(speedDiff) && (
        <StatRow
          label={isGroupMode ? "Group speed" : "Max speed"}
          value={
            <ComparisonValue
              value={Number(moveSpeed.toFixed(1))}
              compareValue={compareMoveSpeed ? Number(compareMoveSpeed.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
          tooltip={isGroupMode ? "Minimum speed (slowest unit limits group)" : undefined}
        />
      )}
      {acceleration !== undefined && showRow(accelDiff) && (
        <StatRow
          label="Acceleration"
          value={
            <ComparisonValue
              value={Number(acceleration.toFixed(1))}
              compareValue={compareAcceleration ? Number(compareAcceleration.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
          tooltip={isGroupMode ? "Minimum acceleration (slowest unit)" : undefined}
        />
      )}
      {brake !== undefined && showRow(brakeDiff) && (
        <StatRow
          label="Braking rate"
          value={
            <ComparisonValue
              value={Number(brake.toFixed(1))}
              compareValue={compareBrake ? Number(compareBrake.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
          tooltip={isGroupMode ? "Minimum braking rate (slowest unit)" : undefined}
        />
      )}
      {turnSpeed !== undefined && showRow(turnDiff) && (
        <StatRow
          label="Turn rate"
          value={
            <ComparisonValue
              value={Number(turnSpeed.toFixed(1))}
              compareValue={compareTurnSpeed ? Number(compareTurnSpeed.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
          tooltip={isGroupMode ? "Minimum turn speed (slowest unit)" : undefined}
        />
      )}
      {/* Amphibious - show in different formats for unit vs group mode */}
      {isGroupMode ? (
        (groupStats?.anyAmphibious || compareGroupStats?.anyAmphibious) && showRow(amphibDiff) && (
          <StatRow
            label="Amphibious"
            value={formatBooleanAggregation(groupStats?.anyAmphibious ?? false, groupStats?.allAmphibious ?? false)}
          />
        )
      ) : (
        special?.amphibious && showRow(amphibDiff) && (
          <StatRow label="Amphibious" value="Yes" />
        )
      )}
      {/* Hover - show in different formats for unit vs group mode */}
      {isGroupMode ? (
        (groupStats?.anyHover || compareGroupStats?.anyHover) && showRow(hoverDiff) && (
          <StatRow
            label="Hover"
            value={formatBooleanAggregation(groupStats?.anyHover ?? false, groupStats?.allHover ?? false)}
          />
        )
      ) : (
        special?.hover && showRow(hoverDiff) && (
          <StatRow label="Hover" value="Yes" />
        )
      )}
    </StatSection>
  );
};
