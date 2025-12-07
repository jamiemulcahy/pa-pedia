import React from 'react';
import { StatSection } from '../StatSection';

interface UnitTypesSectionProps {
  unitTypes: string[];
  /** Unit types from the other unit (for showing diff on comparison side) */
  compareUnitTypes?: string[];
  /** When true, only show section if there are differences */
  showDifferencesOnly?: boolean;
  /** When true, this is the comparison side and should show the merged diff view */
  isComparisonSide?: boolean;
}

export const UnitTypesSection: React.FC<UnitTypesSectionProps> = ({
  unitTypes,
  compareUnitTypes,
  showDifferencesOnly,
  isComparisonSide,
}) => {
  if (!unitTypes || unitTypes.length === 0) return null;

  const thisTypes = new Set(unitTypes);
  const compareTypes = new Set(compareUnitTypes || []);

  // Check if there are any differences
  const hasDifferences = compareUnitTypes && (
    thisTypes.size !== compareTypes.size ||
    [...thisTypes].some(t => !compareTypes.has(t)) ||
    [...compareTypes].some(t => !thisTypes.has(t))
  );

  // In diff mode with comparison, hide if no differences
  if (showDifferencesOnly && compareUnitTypes && !hasDifferences) {
    return null;
  }

  // Get all types to show (merged only on comparison side)
  const allTypes = isComparisonSide && compareUnitTypes
    ? new Set([...thisTypes, ...compareTypes])
    : thisTypes;

  // Sort types alphabetically for consistent display
  const sortedTypes = Array.from(allTypes).sort();

  return (
    <StatSection title="Unit Types">
      <div className="flex flex-wrap gap-2">
        {sortedTypes.map(type => {
          const showDiff = isComparisonSide && !!compareUnitTypes;
          const inThis = thisTypes.has(type);
          const inCompare = compareTypes.has(type);
          const isAdded = showDiff && inThis && !inCompare;
          const isRemoved = showDiff && !inThis && inCompare;

          return (
            <span
              key={type}
              className={`px-3 py-1 rounded text-sm ${
                isAdded
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                  : isRemoved
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              {isAdded && <span className="font-medium">+ </span>}
              {isRemoved && <span className="font-medium">− </span>}
              {type}
            </span>
          );
        })}
      </div>
    </StatSection>
  );
};
