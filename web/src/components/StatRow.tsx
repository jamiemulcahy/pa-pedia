import React from 'react';

interface StatRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

export const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  className = '',
  valueClassName = ''
}) => {
  return (
    <div className={`flex justify-between py-1 ${className}`}>
      <dt className="text-gray-600 dark:text-gray-400">{label}:</dt>
      <dd className={`font-medium text-gray-900 dark:text-gray-100 ${valueClassName}`}>
        {value}
      </dd>
    </div>
  );
};

interface StatLinkProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export const StatLink: React.FC<StatLinkProps> = ({ label, value, className = '' }) => {
  return (
    <div className={`py-1 ${className}`}>
      <dt className="text-gray-600 dark:text-gray-400 mb-1">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-gray-100">
        {value}
      </dd>
    </div>
  );
};
