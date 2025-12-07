import React from 'react';
import { StatSection } from '../StatSection';
import { StatRow } from '../StatRow';
import { ComparisonValue } from '../ComparisonValue';
import type { StorageSpecs } from '@/types/faction';

interface StorageSectionProps {
  storage?: StorageSpecs;
  compareStorage?: StorageSpecs;
}

export const StorageSection: React.FC<StorageSectionProps> = ({
  storage,
  compareStorage,
}) => {
  const unitStorage = storage?.unitStorage || 0;

  if (unitStorage <= 0) return null;

  const compareUnitStorage = compareStorage?.unitStorage;
  const storedUnitType = storage?.storedUnitType || 'unit';

  return (
    <StatSection title="Unit Storage">
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
      {storage?.storedUnitType && storage.storedUnitType !== 'unit' && (
        <StatRow label="Stored type" value={storage.storedUnitType} />
      )}
    </StatSection>
  );
};
