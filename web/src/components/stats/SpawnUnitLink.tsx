import React from 'react';
import { Link } from 'react-router-dom';
import { useFaction } from '@/hooks/useFaction';
import { useCurrentFaction } from '@/contexts/CurrentFactionContext';

interface SpawnUnitLinkProps {
  /** PA resource path (e.g., "/pa/units/land/tank/tank.json") */
  resourcePath: string;
  /** Optional flag to show velocity inheritance note */
  withVelocity?: boolean;
  /** Optional faction ID override (used for comparison mode) */
  factionId?: string;
}

/**
 * Extracts unit identifier from PA resource path (fallback display only)
 * e.g., "/pa/units/land/tank/tank.json" -> "tank"
 */
function extractUnitId(resourcePath: string): string {
  const filename = resourcePath.split('/').pop() || '';
  return filename.replace('.json', '');
}

/**
 * Component that displays a spawned unit as a link if it exists in the faction,
 * or as plain text with the resource path if not found.
 */
export const SpawnUnitLink: React.FC<SpawnUnitLinkProps> = ({
  resourcePath,
  withVelocity,
  factionId: propFactionId
}) => {
  const { factionId: contextFactionId } = useCurrentFaction();
  const factionId = propFactionId || contextFactionId;
  const { units } = useFaction(factionId);

  // Look up unit by resourceName (handles collision cases where identifier differs from filename)
  const unitEntry = units?.find(u => u.unit.resourceName === resourcePath);

  const velocityNote = withVelocity ? ' (inherits velocity)' : '';

  if (unitEntry) {
    // Unit exists in faction - render as link using the actual identifier
    return (
      <span>
        <Link
          to={`/faction/${factionId}/unit/${unitEntry.identifier}`}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {unitEntry.displayName}
        </Link>
        {velocityNote && (
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            {velocityNote}
          </span>
        )}
      </span>
    );
  }

  // Unit not in faction - render as plain text with extracted ID
  const fallbackId = extractUnitId(resourcePath);
  return (
    <span className="text-gray-600 dark:text-gray-400">
      {fallbackId}
      <span className="text-xs ml-1">({resourcePath})</span>
      {velocityNote}
    </span>
  );
};
