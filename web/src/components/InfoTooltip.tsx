import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Margin between tooltip and viewport edges / trigger element */
const TOOLTIP_MARGIN = 8;

interface InfoTooltipProps {
  /** The tooltip text to display on hover */
  text: string;
  /** Additional CSS classes for the container */
  className?: string;
}

interface TooltipPosition {
  top: number;
  left: number;
  flipBelow: boolean;
}

/**
 * An info icon (i) that displays a tooltip on hover or focus.
 * Uses a portal to render the tooltip at the body level, avoiding overflow clipping.
 * Supports keyboard navigation and smart positioning to avoid viewport clipping.
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0, flipBelow: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = tooltipRef.current?.offsetHeight || 40;
    const tooltipWidth = tooltipRef.current?.offsetWidth || 200;

    // Check if tooltip would clip at top
    const spaceAbove = triggerRect.top;
    const flipBelow = spaceAbove < tooltipHeight + TOOLTIP_MARGIN;

    // Calculate vertical position
    let top: number;
    if (flipBelow) {
      top = triggerRect.bottom + TOOLTIP_MARGIN; // Below the trigger
    } else {
      top = triggerRect.top - tooltipHeight - TOOLTIP_MARGIN; // Above the trigger
    }

    // Calculate horizontal position - align left edge with trigger, but keep in viewport
    let left = triggerRect.left;

    // Prevent tooltip from going off right edge
    const rightOverflow = left + tooltipWidth - window.innerWidth + TOOLTIP_MARGIN;
    if (rightOverflow > 0) {
      left -= rightOverflow;
    }

    // Prevent tooltip from going off left edge
    if (left < TOOLTIP_MARGIN) {
      left = TOOLTIP_MARGIN;
    }

    setPosition({ top, left, flipBelow });
  }, []);

  // Update position when visibility changes or on scroll/resize
  useEffect(() => {
    if (!isVisible) return;

    updatePosition();

    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, updatePosition]);

  const showTooltip = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideTooltip = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Arrow position classes based on flip state
  const arrowStyle: React.CSSProperties = position.flipBelow
    ? {
        top: -8,
        left: 12,
        borderWidth: 4,
        borderStyle: 'solid',
        borderColor: 'transparent transparent rgb(17 24 39) transparent', // gray-900
      }
    : {
        bottom: -8,
        left: 12,
        borderWidth: 4,
        borderStyle: 'solid',
        borderColor: 'rgb(17 24 39) transparent transparent transparent', // gray-900
      };

  // Render tooltip via portal to avoid overflow clipping
  const tooltip = isVisible
    ? createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          className="fixed px-2.5 py-1.5 text-sm font-normal text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg w-max max-w-xs z-[9999] pointer-events-none"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {text}
          {/* Arrow */}
          <span
            className="absolute dark:[border-color:transparent_transparent_rgb(55,65,81)_transparent]"
            style={arrowStyle}
            aria-hidden="true"
          />
        </span>,
        document.body
      )
    : null;

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
      {tooltip}
    </span>
  );
};
