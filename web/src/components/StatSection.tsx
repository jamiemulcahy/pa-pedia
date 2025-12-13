import React, { useState, useMemo } from 'react';

interface StatSectionProps {
  title: string;
  /** Optional item name shown after title on larger screens (e.g., "Weapon: Uber Cannon") */
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
}

export const StatSection: React.FC<StatSectionProps> = ({
  title,
  subtitle,
  children,
  className = '',
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const contentId = useMemo(
    () => `section-content-${title.toLowerCase().replace(/\s+/g, '-')}`,
    [title]
  );

  return (
    <section className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-t-lg"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        title={isExpanded ? 'Click to collapse' : 'Click to expand'}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center min-w-0">
          <span className="flex-shrink-0">{title}</span>
          {subtitle && (
            <span
              className="hidden md:inline ml-1 font-normal text-gray-600 dark:text-gray-400 truncate"
              title={subtitle}
            >
              : {subtitle}
            </span>
          )}
        </h2>
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <dl id={contentId} className="space-y-2 px-4 pb-4">
            {children}
          </dl>
        </div>
      </div>
    </section>
  );
};
