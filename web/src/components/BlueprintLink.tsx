import React, { useState } from 'react';
import { BlueprintModal } from './BlueprintModal';

interface BlueprintLinkProps {
  factionId: string;
  resourceName: string;
  displayName?: string;
}

export const BlueprintLink: React.FC<BlueprintLinkProps> = ({
  factionId,
  resourceName,
  displayName
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Convert PA resource name to faction data path
  // e.g., /pa/units/land/tank_light_laser/tank_light_laser.json
  // becomes /factions/MLA/assets/pa/units/land/tank_light_laser/tank_light_laser.json
  const getBlueprintPath = () => {
    return `/factions/${factionId}/assets${resourceName}`;
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
