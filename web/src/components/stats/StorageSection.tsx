import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import type { StorageSpecs } from '@/types/faction';

interface StorageSectionProps {
  storage?: StorageSpecs;
  compareStorage?: StorageSpecs;
  showDifferencesOnly?: boolean;
}

/** Check if two values are different (for comparison filtering) */
function isDifferent(a: number | string | undefined, b: number | string | undefined): boolean {
  if (a === undefined && b === undefined) return false;
  if (a === undefined || b === undefined) return true;
  return a !== b;
}

export const StorageSection: React.FC<StorageSectionProps> = ({
  storage,
  compareStorage,
  showDifferencesOnly,
}) => {
  const unitStorage = storage?.unitStorage || 0;

  if (!storage || unitStorage <= 0) return null;

  const compareUnitStorage = compareStorage?.unitStorage;
  const storedUnitType = storage?.storedUnitType || 'unit';

  // Check which rows have differences
  const capacityDiff = isDifferent(unitStorage, compareUnitStorage || 0);
  const typeDiff = isDifferent(storage?.storedUnitType, compareStorage?.storedUnitType);

  // In diff mode with compare storage, check if we have any visible rows
  const hasAnyDifference = !showDifferencesOnly || !compareStorage ||
    capacityDiff || typeDiff;

  if (!hasAnyDifference) {
    return null;
  }

  const showRow = (hasDiff: boolean) => !showDifferencesOnly || !compareStorage || hasDiff;

  return (
    <StatSection title="Unit Storage">
      {showRow(capacityDiff) && (
        <StatRow
          label="Capacity"
          value={
            <ComparisonValue
              value={unitStorage}
              compareValue={compareUnitStorage}
              comparisonType="higher-better"
              suffix={` ${storedUnitType}${unitStorage !== 1 ? 's' : ''}`}
            />
          }
        />
      )}
      {storage?.storedUnitType && storage.storedUnitType !== 'unit' && showRow(typeDiff) && (
        <StatRow label="Stored type" value={storage.storedUnitType} />
      )}
    </StatSection>
  );
};
