import type { ComparisonMode } from '@/types/group'

interface GroupModeToggleProps {
  mode: ComparisonMode
  onModeChange: (mode: ComparisonMode) => void
}

export function GroupModeToggle({ mode, onModeChange }: GroupModeToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button
        type="button"
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'unit'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        onClick={() => onModeChange('unit')}
        aria-pressed={mode === 'unit'}
      >
        Unit
      </button>
      <button
        type="button"
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'group'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        onClick={() => onModeChange('group')}
        aria-pressed={mode === 'group'}
      >
        Group
      </button>
    </div>
  )
}
