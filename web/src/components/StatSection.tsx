import React, { useState } from 'react';

interface StatSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
}

export const StatSection: React.FC<StatSectionProps> = ({
  title,
  children,
  className = '',
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-t-lg"
        aria-expanded={isExpanded}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <dl className="space-y-2 px-4 pb-4">
          {children}
        </dl>
      )}
    </section>
  );
};
