import React from 'react';
import { StatSection } from '../StatSection';
import type { Weapon } from '@/types/faction';

interface TargetPrioritiesSectionProps {
  weapons?: Weapon[];
}

export const TargetPrioritiesSection: React.FC<TargetPrioritiesSectionProps> = ({ weapons }) => {
  if (!weapons || weapons.length === 0) return null;

  // Extract unique target layers from all weapons
  const allTargetLayers = new Set<string>();
  weapons.forEach(weapon => {
    weapon.targetLayers?.forEach(layer => allTargetLayers.add(layer));
  });

  if (allTargetLayers.size === 0) return null;

  // Format target priorities as lines
  const targetLines = Array.from(allTargetLayers);

  return (
    <StatSection title="Target Priorities">
      <div className="space-y-1">
        {targetLines.map((target, idx) => (
          <p key={idx} className="text-gray-900 dark:text-gray-100">{target}</p>
        ))}
      </div>
    </StatSection>
  );
};
