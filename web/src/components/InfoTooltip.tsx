import React from 'react';

interface InfoTooltipProps {
  /** The tooltip text to display on hover */
  text: string;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * An info icon (ⓘ) that displays a tooltip on hover.
 * Uses CSS-only tooltip for simplicity and accessibility.
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = '' }) => {
  return (
    <span className={`relative inline-flex items-center group ${className}`}>
      <svg
        className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeLinecap="round" strokeWidth="2" d="M12 16v-4M12 8h.01" />
      </svg>
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="
          absolute bottom-full left-0 mb-2
          px-2.5 py-1.5 text-sm font-normal text-white bg-gray-900 dark:bg-gray-700
          rounded shadow-lg w-max max-w-xs
          opacity-0 invisible group-hover:opacity-100 group-hover:visible
          transition-opacity duration-150 z-50
          pointer-events-none
        "
      >
        {text}
        {/* Arrow */}
        <span
          className="absolute top-full left-2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"
          aria-hidden="true"
        />
      </span>
    </span>
  );
};
