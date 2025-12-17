import React, { useState, useRef, useCallback } from 'react';

interface InfoTooltipProps {
  /** The tooltip text to display on hover */
  text: string;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * An info icon (ⓘ) that displays a tooltip on hover or focus.
 * Supports keyboard navigation and smart positioning to avoid viewport clipping.
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [flipBelow, setFlipBelow] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Flip below if less than 80px from top of viewport
      setFlipBelow(rect.top < 80);
    }
  }, []);

  const showTooltip = useCallback(() => {
    updatePosition();
    setIsVisible(true);
  }, [updatePosition]);

  const hideTooltip = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Position classes based on flip state
  const positionClasses = flipBelow
    ? 'top-full mt-2'  // Below the icon
    : 'bottom-full mb-2';  // Above the icon (default)

  // Arrow position classes
  const arrowClasses = flipBelow
    ? 'bottom-full left-2 border-b-gray-900 dark:border-b-gray-700 border-t-transparent'
    : 'top-full left-2 border-t-gray-900 dark:border-t-gray-700 border-b-transparent';

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="text-gray-400 dark:text-gray-500 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded-full"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-describedby="tooltip"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path strokeLinecap="round" strokeWidth="2" d="M12 16v-4M12 8h.01" />
        </svg>
        <span className="sr-only">Info: {text}</span>
      </button>
      <span
        id="tooltip"
        role="tooltip"
        className={`
          absolute left-0 ${positionClasses}
          px-2.5 py-1.5 text-sm font-normal text-white bg-gray-900 dark:bg-gray-700
          rounded shadow-lg w-max max-w-xs
          transition-opacity duration-150 z-50
          pointer-events-none
          ${isVisible ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `}
      >
        {text}
        {/* Arrow */}
        <span
          className={`absolute border-4 border-transparent ${arrowClasses}`}
          aria-hidden="true"
        />
      </span>
    </span>
  );
};
