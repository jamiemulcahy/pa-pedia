import React from 'react';
import { Link } from 'react-router-dom';
import { StatSection } from '../StatSection';
import { StatLink } from '../StatRow';
import { useFaction } from '@/hooks/useFaction';

interface BuiltBySectionProps {
  factionId: string;
  builtBy?: string[];
  buildCost: number;
}

export const BuiltBySection: React.FC<BuiltBySectionProps> = ({
  factionId,
  builtBy,
  buildCost
}) => {
  const { units } = useFaction(factionId);

  if (!builtBy || builtBy.length === 0) return null;

  // Get builder units with their build rates
  const builders = builtBy
    .map(builderId => {
      const builder = units?.find(u => u.identifier === builderId);
      if (!builder) return null;

      const buildRate = builder.unit.specs.economy.buildRate || 0;
      const buildTime = buildRate > 0 ? buildCost / buildRate : 0;

      return {
        id: builderId,
        name: builder.displayName,
        tier: builder.unit.tier,
        buildTime
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => a.tier - b.tier);

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
            {builders.map(builder => (
              <div key={builder.id} className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-6">
                  {getTierLabel(builder.tier)}
                </span>
                <Link
                  to={`/faction/${factionId}/unit/${builder.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline flex-1"
                >
                  {builder.name}
                </Link>
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  {formatBuildTime(builder.buildTime)}
                </span>
              </div>
            ))}
          </div>
        }
      />
    </StatSection>
  );
};
