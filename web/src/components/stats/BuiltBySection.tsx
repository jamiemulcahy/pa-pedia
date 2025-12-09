import React from 'react';
import { Link } from 'react-router-dom';
import { StatSection } from '../StatSection';
import { StatLink } from '../StatRow';
import { useFaction } from '@/hooks/useFaction';
import { useCurrentFaction } from '@/contexts/CurrentFactionContext';
import type { UnitIndexEntry } from '@/types/faction';

interface BuiltBySectionProps {
  builtBy?: string[];
  buildCost: number;
  /** Optional faction ID override (used for comparison mode) */
  factionId?: string;
  /** Builders from the other unit (for showing diff on comparison side) */
  compareBuiltBy?: string[];
  /** When true, only show section if there are differences */
  showDifferencesOnly?: boolean;
  /** When true, this is the comparison side and should show the merged diff view */
  isComparisonSide?: boolean;
  /** Units from the other faction (for cross-faction comparison) */
  compareUnits?: UnitIndexEntry[];
}

interface BuilderEntry {
  id: string;
  name: string;
  tier: number;
  buildTime: number;
  inThis: boolean;
  inCompare: boolean;
  factionId: string;
  isCommander: boolean;
  isAggregated?: boolean;
}

export const BuiltBySection: React.FC<BuiltBySectionProps> = ({
  builtBy,
  buildCost,
  factionId: propFactionId,
  compareBuiltBy,
  showDifferencesOnly,
  isComparisonSide,
  compareUnits,
}) => {
  const { factionId: contextFactionId } = useCurrentFaction();
  const factionId = propFactionId || contextFactionId;
  const { units } = useFaction(factionId);

  if (!builtBy || builtBy.length === 0) return null;

  const thisBuilders = new Set(builtBy);
  const compareBuilders = new Set(compareBuiltBy || []);

  // Check if there are any differences
  const hasDifferences = compareBuiltBy && (
    thisBuilders.size !== compareBuilders.size ||
    [...thisBuilders].some(b => !compareBuilders.has(b)) ||
    [...compareBuilders].some(b => !thisBuilders.has(b))
  );

  // In diff mode with comparison, hide if no differences
  if (showDifferencesOnly && compareBuiltBy && !hasDifferences) {
    return null;
  }

  // Get all builders to show (merged only on comparison side)
  const allBuilderIds = isComparisonSide && compareBuiltBy
    ? new Set([...thisBuilders, ...compareBuilders])
    : thisBuilders;

  // Get builder units with their build rates
  // For comparison side, we need to look up units from both factions
  const allBuilders = Array.from(allBuilderIds)
    .map(builderId => {
      // First try to find in this faction's units
      let builder = units?.find(u => u.identifier === builderId);
      let builderFactionId = factionId;

      // If not found and we have compareUnits, try the primary faction's units
      if (!builder && compareUnits) {
        builder = compareUnits.find(u => u.identifier === builderId);
        // For cross-faction builders, link to the primary faction
        builderFactionId = contextFactionId || factionId;
      }

      if (!builder) return null;

      const buildRate = builder.unit.specs.economy.buildRate || 0;
      const buildTime = buildRate > 0 ? buildCost / buildRate : 0;
      const isCommander = builder.unitTypes?.includes('Commander') ?? false;

      return {
        id: builderId,
        name: builder.displayName,
        tier: builder.unit.tier,
        buildTime,
        inThis: thisBuilders.has(builderId),
        inCompare: compareBuilders.has(builderId),
        factionId: builderFactionId,
        isCommander,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  // Separate commanders from regular builders
  const commanderBuilders = allBuilders.filter(b => b.isCommander);
  const regularBuilders = allBuilders.filter(b => !b.isCommander);

  // Create aggregated commanders entry if there are any
  let aggregatedCommanders: BuilderEntry | null = null;
  if (commanderBuilders.length > 0) {
    // Find fastest commander (tie-break by lower tier)
    const fastest = commanderBuilders.reduce((min, b) => {
      if (b.buildTime < min.buildTime) return b;
      if (b.buildTime === min.buildTime && b.tier < min.tier) return b;
      return min;
    });
    // Check if any commander is in this/compare for diff styling
    const anyInThis = commanderBuilders.some(b => b.inThis);
    const anyInCompare = commanderBuilders.some(b => b.inCompare);
    aggregatedCommanders = {
      id: 'commanders-aggregate',
      name: 'Commanders',
      tier: fastest.tier,
      buildTime: fastest.buildTime,
      inThis: anyInThis,
      inCompare: anyInCompare,
      factionId: fastest.factionId,
      isCommander: true,
      isAggregated: true,
    };
  }

  // Combine regular builders with aggregated commanders
  const builders: BuilderEntry[] = [
    ...regularBuilders,
    ...(aggregatedCommanders ? [aggregatedCommanders] : []),
  ].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

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
    <StatSection title="Built By">
      <StatLink
        label=""
        value={
          <div className="space-y-1">
            {builders.map(builder => {
              // Only show diff styling on comparison side
              const showDiff = isComparisonSide && !!compareBuiltBy;
              const isAdded = showDiff && builder.inThis && !builder.inCompare;
              const isRemoved = showDiff && !builder.inThis && builder.inCompare;

              return (
                <div key={builder.id} className="flex items-center gap-2">
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
                    {getTierLabel(builder.tier)}
                  </span>
                  {builder.isAggregated ? (
                    <span className={`flex-1 ${
                      isAdded ? 'text-green-600 dark:text-green-400' :
                      isRemoved ? 'text-red-600 dark:text-red-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {builder.name}
                    </span>
                  ) : (
                    <Link
                      to={`/faction/${builder.factionId}/unit/${builder.id}`}
                      className={`hover:underline flex-1 ${
                        isAdded ? 'text-green-600 dark:text-green-400' :
                        isRemoved ? 'text-red-600 dark:text-red-400' :
                        'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {builder.name}
                    </Link>
                  )}
                  <span className={`text-sm ${
                    isAdded ? 'text-green-600 dark:text-green-400' :
                    isRemoved ? 'text-red-600 dark:text-red-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {formatBuildTime(builder.buildTime)}
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
