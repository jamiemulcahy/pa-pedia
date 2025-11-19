import React from 'react';
import { StatSection } from '../StatSection';

interface UnitTypesSectionProps {
  unitTypes: string[];
}

export const UnitTypesSection: React.FC<UnitTypesSectionProps> = ({ unitTypes }) => {
  if (!unitTypes || unitTypes.length === 0) return null;

  return (
    <StatSection title="Unit Types">
      <div className="flex flex-wrap gap-2">
        {unitTypes.map(type => (
          <span
            key={type}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm"
          >
            {type}
          </span>
        ))}
      </div>
    </StatSection>
  );
};
