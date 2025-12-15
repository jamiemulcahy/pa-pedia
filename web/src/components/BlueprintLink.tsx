import React, { useState } from 'react';
import { BlueprintModal } from './BlueprintModal';
import { useCurrentFaction } from '@/contexts/CurrentFactionContext';
import type { Unit, Weapon, Ammo } from '@/types/faction';

interface BlueprintLinkProps {
  resourceName: string;
  displayName?: string;
  factionId?: string;
  resolvedData?: Unit | Weapon | Ammo;
}

export const BlueprintLink: React.FC<BlueprintLinkProps> = ({
  resourceName,
  displayName,
  factionId: propFactionId,
  resolvedData
}) => {
  const { factionId: contextFactionId } = useCurrentFaction();
  const factionId = propFactionId || contextFactionId;
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Convert PA resource name to faction data path
  // e.g., /pa/units/land/tank_light_laser/tank_light_laser.json
  // becomes {BASE_URL}factions/MLA/assets/pa/units/land/tank_light_laser/tank_light_laser.json
  const getBlueprintPath = () => {
    return `${import.meta.env.BASE_URL}factions/${factionId}/assets${resourceName}`;
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-blue-600 dark:text-blue-400 hover:underline text-left"
      >
        {displayName || resourceName}
      </button>
      <BlueprintModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        blueprintPath={getBlueprintPath()}
        title={`Blueprint: ${resourceName}`}
        resolvedData={resolvedData}
      />
    </>
  );
};
