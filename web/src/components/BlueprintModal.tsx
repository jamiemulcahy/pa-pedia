import React, { useEffect, useState } from 'react';

interface BlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  blueprintPath: string;
  title: string;
}

export const BlueprintModal: React.FC<BlueprintModalProps> = ({
  isOpen,
  onClose,
  blueprintPath,
  title
}) => {
  const [blueprintContent, setBlueprintContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !blueprintPath) {
      setBlueprintContent('');
      setError(null);
      return;
    }

    const loadBlueprint = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(blueprintPath);
        if (!response.ok) {
          throw new Error(`Failed to load blueprint: ${response.statusText}`);
        }
        const json = await response.json();
        setBlueprintContent(JSON.stringify(json, null, 2));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load blueprint');
        setBlueprintContent('');
      } finally {
        setLoading(false);
      }
    };

    loadBlueprint();
  }, [isOpen, blueprintPath]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-600 dark:text-gray-400">Loading blueprint...</div>
            </div>
          )}
          {error && (
            <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded">
              {error}
            </div>
          )}
          {!loading && !error && blueprintContent && (
            <pre className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 p-4 rounded overflow-x-auto">
              <code>{blueprintContent}</code>
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
