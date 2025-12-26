import React from 'react';
import { StatSection } from '../StatSection';
import type { Weapon } from '@/types/faction';

interface TargetPrioritiesSectionProps {
  weapons?: Weapon[];
  /** Weapons from the comparison unit (for showing diff on comparison side) */
  compareWeapons?: Weapon[];
  /** Pre-computed target layers for group mode (takes precedence over weapons) */
  groupTargetLayers?: string[];
  /** Pre-computed comparison target layers for group mode */
  compareGroupTargetLayers?: string[];
  /** When true, only show section if there are differences */
  showDifferencesOnly?: boolean;
  /** When true, this is the comparison side and should show the merged diff view */
  isComparisonSide?: boolean;
}

/** Extract unique target layers from weapons */
function getTargetLayers(weapons?: Weapon[]): Set<string> {
  const layers = new Set<string>();
  weapons?.forEach(weapon => {
    weapon.targetLayers?.forEach(layer => layers.add(layer));
  });
  return layers;
}

export const TargetPrioritiesSection: React.FC<TargetPrioritiesSectionProps> = ({
  weapons,
  compareWeapons,
  groupTargetLayers,
  compareGroupTargetLayers,
  showDifferencesOnly,
  isComparisonSide,
}) => {
  // Use group mode data if available, otherwise compute from weapons
  const thisTargets = groupTargetLayers
    ? new Set(groupTargetLayers)
    : getTargetLayers(weapons);
  const compareTargets = compareGroupTargetLayers
    ? new Set(compareGroupTargetLayers)
    : getTargetLayers(compareWeapons);

  // For non-group mode, check if weapons exist
  if (!groupTargetLayers && (!weapons || weapons.length === 0)) return null;

  if (thisTargets.size === 0) return null;

  // Check if there are any differences
  const hasCompare = !!compareWeapons || !!compareGroupTargetLayers;
  const allTargets = new Set([...thisTargets, ...compareTargets]);
  const hasDifferences = hasCompare && (
    thisTargets.size !== compareTargets.size ||
    [...thisTargets].some(t => !compareTargets.has(t)) ||
    [...compareTargets].some(t => !thisTargets.has(t))
  );

  // In diff mode with comparison, hide if no differences
  if (showDifferencesOnly && hasCompare && !hasDifferences) {
    return null;
  }

  // Sort targets alphabetically for consistent display
  const sortedTargets = Array.from(allTargets).sort();

  // For comparison side with compare data, show merged diff view
  if (isComparisonSide && hasCompare) {
    return (
      <StatSection title="Target Priorities">
        <div className="space-y-1">
          {sortedTargets.map((target, idx) => {
            const inThis = thisTargets.has(target);
            const inCompare = compareTargets.has(target);

            if (inThis && inCompare) {
              // Both have it - normal display
              return (
                <p key={idx} className="text-gray-900 dark:text-gray-100">
                  {target}
                </p>
              );
            } else if (inThis && !inCompare) {
              // Only this unit (comparison) has it - gained (green +)
              return (
                <p key={idx} className="text-green-600 dark:text-green-400">
                  <span className="font-medium">+</span> {target}
                </p>
              );
            } else {
              // Only compare (primary) has it - lost (red -)
              return (
                <p key={idx} className="text-red-600 dark:text-red-400">
                  <span className="font-medium">−</span> {target}
                </p>
              );
            }
          })}
        </div>
      </StatSection>
    );
  }

  // Primary side or no comparison - show simple list
  return (
    <StatSection title="Target Priorities">
      <div className="space-y-1">
        {Array.from(thisTargets).sort().map((target, idx) => (
          <p key={idx} className="text-gray-900 dark:text-gray-100">{target}</p>
        ))}
      </div>
    </StatSection>
  );
};
