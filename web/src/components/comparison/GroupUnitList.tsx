import { UnitIcon } from '../UnitIcon'
import { QuantitySelector } from './QuantitySelector'
import { BreadcrumbNav } from '../BreadcrumbNav'
import type { Unit } from '@/types/faction'

interface GroupUnitListProps {
  members: { factionId: string; unitId: string; quantity: number }[]
  units: (Unit | undefined)[]
  onQuantityChange: (index: number, quantity: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
  /** Index of a pending unit selection (shows selector inline) */
  pendingSelectionIndex?: number
  /** Callback when a pending unit is selected */
  onSelectPendingUnit?: (factionId: string, unitId: string) => void
  /** Callback to cancel pending selection */
  onCancelPendingSelection?: () => void
  /** Default faction ID for new unit selections */
  defaultFactionId?: string
  /** Number of units in the other group (for placeholder alignment) */
  otherGroupUnitCount?: number
  /** Callback to remove entire group */
  onRemoveGroup?: () => void
}

export function GroupUnitList({
  members,
  units,
  onQuantityChange,
  onRemove,
  onAdd,
  pendingSelectionIndex,
  onSelectPendingUnit,
  onCancelPendingSelection,
  defaultFactionId,
  otherGroupUnitCount = 0,
  onRemoveGroup,
}: GroupUnitListProps) {
  const hasPendingSelection = pendingSelectionIndex !== undefined
  const validMembers = members.filter(m => m.unitId)
  const placeholderCount = Math.max(0, otherGroupUnitCount - validMembers.length)

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
      {/* Unit list */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {members.map((member, index) => {
          const unit = units[index]
          // Check if this is a pending selection slot (empty unitId)
          const isPendingSlot = !member.unitId

          if (isPendingSlot) {
            return null // Pending slots are rendered separately below
          }

          return (
            <div
              key={`${member.factionId}-${member.unitId}-${index}`}
              className="flex items-center gap-3 p-3"
            >
              {/* Unit icon */}
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded">
                {unit ? (
                  <UnitIcon
                    imagePath={unit.image}
                    alt={unit.displayName}
                    className="max-w-full max-h-full object-contain"
                    factionId={member.factionId}
                  />
                ) : (
                  <span className="text-xs text-gray-400">...</span>
                )}
              </div>

              {/* Unit name */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {unit?.displayName || 'Loading...'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {member.factionId}
                </p>
              </div>

              {/* Quantity selector */}
              <QuantitySelector
                value={member.quantity}
                onChange={(qty) => onQuantityChange(index, qty)}
              />

              {/* Remove button - always shown */}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Remove from group"
                aria-label="Remove from group"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        })}
        {/* Placeholder rows for alignment */}
        {Array.from({ length: placeholderCount }).map((_, index) => (
          <div
            key={`placeholder-${index}`}
            className="flex items-center gap-3 p-3 opacity-30"
          >
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded border border-dashed border-gray-300 dark:border-gray-600" />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Add unit section */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        {hasPendingSelection ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Select unit to add:
              </p>
              <button
                type="button"
                onClick={onCancelPendingSelection}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Cancel"
                aria-label="Cancel adding unit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <BreadcrumbNav
              factionId={defaultFactionId || ''}
              unitId={undefined}
              onUnitChange={(newFactionId, newUnitId) => {
                onSelectPendingUnit?.(newFactionId, newUnitId)
              }}
              enableAllFactions
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-gray-200 dark:border-gray-600 border-dashed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add unit</span>
            </button>
            {onRemoveGroup && (
              <button
                type="button"
                onClick={onRemoveGroup}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
                title="Remove group"
                aria-label="Remove group"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
