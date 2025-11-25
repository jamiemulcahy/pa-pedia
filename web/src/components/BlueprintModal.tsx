import React, { useEffect, useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useCurrentFaction } from '@/contexts/CurrentFactionContext';
import { getLocalAsset } from '@/services/localFactionStorage';

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
  const { factionId, isLocal } = useCurrentFaction();
  const [blueprintContent, setBlueprintContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [baseSpec, setBaseSpec] = useState<string | null>(null);
  const [viewingBaseSpec, setViewingBaseSpec] = useState(false);
  const [currentPath, setCurrentPath] = useState(blueprintPath);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset state when modal opens with new path
  useEffect(() => {
    if (isOpen) {
      setCurrentPath(blueprintPath);
      setPathHistory([]);
      setViewingBaseSpec(false);
    }
  }, [isOpen, blueprintPath]);

  // Convert a PA resource path to the faction assets path
  const getAssetPath = useCallback((resourcePath: string) => {
    // Extract the faction base from current path
    // e.g., {BASE_URL}factions/MLA/assets/pa/units/... -> {BASE_URL}factions/MLA/assets
    const baseUrl = import.meta.env.BASE_URL;
    const escapedBaseUrl = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = currentPath.match(new RegExp(`^(${escapedBaseUrl}factions/[^/]+/assets)`));
    if (match) {
      return `${match[1]}${resourcePath}`;
    }
    return resourcePath;
  }, [currentPath]);

  const handleViewBaseSpec = () => {
    if (baseSpec) {
      setPathHistory([...pathHistory, currentPath]);
      setCurrentPath(getAssetPath(baseSpec));
      setViewingBaseSpec(true);
    }
  };

  const handleGoBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      setCurrentPath(previousPath);
      setViewingBaseSpec(pathHistory.length > 1);
    }
  };

  useEffect(() => {
    if (!isOpen || !currentPath) {
      setBlueprintContent('');
      setError(null);
      setBaseSpec(null);
      return;
    }

    const controller = new AbortController();

    const loadBlueprint = async () => {
      setLoading(true);
      setError(null);
      setBaseSpec(null);
      try {
        let json;

        if (isLocal && factionId) {
          // Load from IndexedDB for local factions
          // Convert path like /factions/MyFaction/assets/pa/units/... to assets/pa/units/...
          const assetPath = currentPath.replace(/^\/factions\/[^/]+\//, '');
          const blob = await getLocalAsset(factionId, assetPath);

          if (!blob) {
            throw new Error('Blueprint file not found. This unit may not have an exported blueprint file.');
          }

          const text = await blob.text();
          json = JSON.parse(text);
        } else {
          // Load from server for static factions
          const response = await fetch(currentPath, { signal: controller.signal });
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error('Blueprint file not found. This unit may not have an exported blueprint file.');
            }
            throw new Error(`Failed to load blueprint: ${response.statusText}`);
          }

          // Check if response is actually JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Blueprint file not found or invalid format.');
          }

          json = await response.json();
        }

        setBlueprintContent(JSON.stringify(json, null, 2));

        // Check for base_spec field
        if (json.base_spec) {
          if (typeof json.base_spec === 'string') {
            setBaseSpec(json.base_spec);
          } else {
            console.warn('base_spec field exists but is not a string:', json.base_spec);
          }
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // Improve JSON parse error messages
        if (err instanceof Error && err.message.includes('JSON')) {
          setError('Blueprint file not found or contains invalid data.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load blueprint');
        }
        setBlueprintContent('');
      } finally {
        setLoading(false);
      }
    };

    loadBlueprint();

    return () => controller.abort();
  }, [isOpen, currentPath, isLocal, factionId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(blueprintContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Scrollbar styling */}
      <style>{`
        .modal-content::-webkit-scrollbar {
          width: 8px;
        }
        .modal-content::-webkit-scrollbar-track {
          background: ${isDarkMode ? '#1f2937' : '#e5e7eb'};
          border-radius: 4px;
        }
        .modal-content::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#4b5563' : '#9ca3af'};
          border-radius: 4px;
        }
        .modal-content::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? '#6b7280' : '#6b7280'};
        }
      `}</style>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] min-h-[400px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            {pathHistory.length > 0 && (
              <button
                onClick={handleGoBack}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Go back"
                title="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {viewingBaseSpec ? `Base Spec: ${currentPath.split('/').pop()}` : title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {blueprintContent && (
              <button
                onClick={handleCopy}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Copy to clipboard"
                title={copied ? 'Copied!' : 'Copy to clipboard'}
              >
                {copied ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-3xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Base spec link */}
        {baseSpec && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex-shrink-0">
            <button
              onClick={handleViewBaseSpec}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Inherits from:</span>
              <span className="font-mono">{baseSpec}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className="modal-content flex-1 overflow-auto p-4 relative min-h-0"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isDarkMode ? '#4b5563 #1f2937' : '#9ca3af #e5e7eb'
          }}
        >
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
            <SyntaxHighlighter
              language="json"
              style={isDarkMode ? vscDarkPlus : vs}
              customStyle={{
                margin: 0,
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                lineHeight: '1.5'
              }}
              showLineNumbers
            >
              {blueprintContent}
            </SyntaxHighlighter>
          )}
        </div>

        {/* Footer border - ensures modal bottom is always visible */}
        <div className="h-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0"></div>
      </div>
    </div>
    </>
  );
};
