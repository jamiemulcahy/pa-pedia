import React, { useState } from 'react';
import { BlueprintModal } from './BlueprintModal';

interface BlueprintLinkProps {
  factionId: string;
  unitId: string;
  resourceName: string;
  displayName?: string;
}

export const BlueprintLink: React.FC<BlueprintLinkProps> = ({
  factionId,
  unitId,
  resourceName,
  displayName
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Convert PA resource name to faction data path
  // e.g., /pa/units/land/tank_light_laser/tank_light_laser.json
  // becomes /factions/MLA/units/tank_light_laser/tank_light_laser.json
  const getBlueprintPath = () => {
    const filename = resourceName.split('/').pop();
    return `/factions/${factionId}/units/${unitId}/${filename}`;
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
        title={`Blueprint: ${displayName || resourceName}`}
      />
    </>
  );
};
