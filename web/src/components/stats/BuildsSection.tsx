import React from 'react';
import { Link } from 'react-router-dom';
import { StatSection } from '../StatSection';
import { StatLink } from '../StatRow';
import { useFaction } from '@/hooks/useFaction';
import { useCurrentFaction } from '@/contexts/CurrentFactionContext';
import type { UnitIndexEntry } from '@/types/faction';

interface BuildsSectionProps {
  builds?: string[];
  buildRate: number;
  /** Optional faction ID override (used for comparison mode) */
  factionId?: string;
  /** Builds from the other unit (for showing diff on comparison side) */
  compareBuilds?: string[];
  /** When true, only show section if there are differences */
  showDifferencesOnly?: boolean;
  /** When true, this is the comparison side and should show the merged diff view */
  isComparisonSide?: boolean;
  /** Units from the other faction (for cross-faction comparison) */
  compareUnits?: UnitIndexEntry[];
}

interface BuildEntry {
  id: string;
  name: string;
  tier: number;
  buildTime: number;
  inThis: boolean;
  inCompare: boolean;
  factionId: string;
}

export const BuildsSection: React.FC<BuildsSectionProps> = ({
  builds,
  buildRate,
  factionId: propFactionId,
  compareBuilds,
  showDifferencesOnly,
  isComparisonSide,
  compareUnits,
}) => {
  const { factionId: contextFactionId } = useCurrentFaction();
  const factionId = propFactionId || contextFactionId;
  const { units } = useFaction(factionId);

  if (!builds || builds.length === 0) return null;

  const thisBuilds = new Set(builds);
  const compareBuildsSet = new Set(compareBuilds || []);

  // Check if there are any differences
  const hasDifferences = compareBuilds && (
    thisBuilds.size !== compareBuildsSet.size ||
    [...thisBuilds].some(b => !compareBuildsSet.has(b)) ||
    [...compareBuildsSet].some(b => !thisBuilds.has(b))
  );

  // In diff mode with comparison, hide if no differences
  if (showDifferencesOnly && compareBuilds && !hasDifferences) {
    return null;
  }

  // Get all units to show (merged only on comparison side)
  const allBuildIds = isComparisonSide && compareBuilds
    ? new Set([...thisBuilds, ...compareBuildsSet])
    : thisBuilds;

  // Get buildable units with their build costs
  const allBuilds = Array.from(allBuildIds)
    .map(unitId => {
      // First try to find in this faction's units
      let targetUnit = units?.find(u => u.identifier === unitId);
      let targetFactionId = factionId;

      // If not found and we have compareUnits, try the primary faction's units
      if (!targetUnit && compareUnits) {
        targetUnit = compareUnits.find(u => u.identifier === unitId);
        // For cross-faction units, link to the primary faction
        targetFactionId = contextFactionId || factionId;
      }

      if (!targetUnit) return null;

      const buildCost = targetUnit.unit.specs.economy.buildCost || 0;
      const buildTime = buildRate > 0 ? buildCost / buildRate : 0;

      return {
        id: unitId,
        name: targetUnit.displayName,
        tier: targetUnit.unit.tier,
        buildTime,
        inThis: thisBuilds.has(unitId),
        inCompare: compareBuildsSet.has(unitId),
        factionId: targetFactionId,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  // Sort by tier, then by name
  const sortedBuilds: BuildEntry[] = allBuilds.sort(
    (a, b) => a.tier - b.tier || a.name.localeCompare(b.name)
  );

  const formatBuildTime = (seconds: number): string => {
    if (seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTierLabel = (tier: number): string => {
    switch (tier) {
      case 1: return 'T1';
      case 2: return 'T2';
      case 3: return 'T3';
      default: return '';
    }
  };

  return (
    <StatSection title="Builds">
      <StatLink
        label=""
        value={
          <div className="space-y-1">
            {sortedBuilds.map(build => {
              // Only show diff styling on comparison side
              const showDiff = isComparisonSide && !!compareBuilds;
              const isAdded = showDiff && build.inThis && !build.inCompare;
              const isRemoved = showDiff && !build.inThis && build.inCompare;

              return (
                <div key={build.id} className="flex items-center gap-2">
                  {showDiff && (
                    <span className={`w-3 font-medium ${
                      isAdded ? 'text-green-600 dark:text-green-400' :
                      isRemoved ? 'text-red-600 dark:text-red-400' :
                      'text-transparent'
                    }`}>
                      {isAdded ? '+' : isRemoved ? '−' : ''}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-6">
                    {getTierLabel(build.tier)}
                  </span>
                  <Link
                    to={`/faction/${build.factionId}/unit/${build.id}`}
                    className={`hover:underline flex-1 ${
                      isAdded ? 'text-green-600 dark:text-green-400' :
                      isRemoved ? 'text-red-600 dark:text-red-400' :
                      'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {build.name}
                  </Link>
                  <span className={`text-sm ${
                    isAdded ? 'text-green-600 dark:text-green-400' :
                    isRemoved ? 'text-red-600 dark:text-red-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {formatBuildTime(build.buildTime)}
                  </span>
                </div>
              );
            })}
          </div>
        }
      />
    </StatSection>
  );
};
