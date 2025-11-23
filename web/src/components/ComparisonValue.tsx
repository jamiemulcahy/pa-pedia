interface ComparisonValueProps {
  value: number | string;
  compareValue?: number | string;
  /** 'higher-better' for stats like HP/DPS, 'lower-better' for costs, 'neutral' for no color */
  comparisonType?: 'higher-better' | 'lower-better' | 'neutral';
  /** Format function for the diff display */
  formatDiff?: (diff: number) => string;
  /** Unit suffix like 'm', 's', '/s' */
  suffix?: string;
}

export function ComparisonValue({
  value,
  compareValue,
  comparisonType = 'neutral',
  formatDiff,
  suffix = '',
}: ComparisonValueProps) {
  // If no comparison or values aren't numbers, just show the value
  if (compareValue === undefined || typeof value !== 'number' || typeof compareValue !== 'number') {
    return (
      <span>
        {value}{suffix}
      </span>
    );
  }

  const diff = value - compareValue;

  // No difference
  if (diff === 0) {
    return (
      <span>
        {value}{suffix}
      </span>
    );
  }

  // Determine color based on comparison type
  let colorClass = 'text-gray-500 dark:text-gray-400'; // neutral

  if (comparisonType !== 'neutral') {
    const isPositive = diff > 0;
    const isBetter = comparisonType === 'higher-better' ? isPositive : !isPositive;
    colorClass = isBetter
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  }

  // Format the diff - use threshold to handle floating-point precision issues
  const isWholeNumber = Math.abs(diff - Math.round(diff)) < 0.0001;
  const formattedDiff = formatDiff
    ? formatDiff(diff)
    : Math.abs(diff).toFixed(isWholeNumber ? 0 : 1);

  const sign = diff > 0 ? '+' : '-';

  return (
    <span className="inline-flex items-center gap-1">
      <span>{value}{suffix}</span>
      <span className={`text-sm ${colorClass}`}>
        ({sign}{formattedDiff}{suffix})
      </span>
    </span>
  );
}
