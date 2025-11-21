import React from 'react';

interface StatSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const StatSection: React.FC<StatSectionProps> = ({ title, children, className = '' }) => {
  return (
    <section className={`mb-8 ${className}`}>
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        {title}
      </h2>
      <dl className="space-y-2">
        {children}
      </dl>
    </section>
  );
};
