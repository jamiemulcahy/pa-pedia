import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UnitIcon } from '@/components/UnitIcon'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitIndexEntryWithFaction } from '@/hooks/useAllFactions'
import { getUnitCategory, CATEGORY_ORDER, type UnitCategory } from '@/utils/unitCategories'
import type { CommanderGroup, CommanderGroupingResult } from '@/utils/commanderDedup'
import { useCommanderGroupMaps } from '@/hooks/useCommanderGroupMaps'
import {
  detectPresetFromFilters,
  getColumnsForPreset,
  COLUMN_DEFS,
  type ColumnId,
  type ColumnDef,
} from '@/utils/tableColumns'

interface UnitTableProps {
  units: (UnitIndexEntry | UnitIndexEntryWithFaction)[]
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
  showFactionColumn?: boolean
  getUnitFactionId?: (unit: UnitIndexEntry | UnitIndexEntryWithFaction) => string
  commanderGrouping?: CommanderGroupingResult
  typeFilters?: string[]
}

type SortDirection = 'asc' | 'desc'

function getCategoryBadgeClass(category: UnitCategory): string {
  const baseClass = 'px-1.5 py-0.5 text-xs font-mono rounded whitespace-nowrap'
  switch (category) {
    case 'Commanders':
      return `${baseClass} bg-yellow-500/20 text-yellow-600 dark:text-yellow-400`
    case 'Titans':
      return `${baseClass} bg-purple-500/20 text-purple-600 dark:text-purple-400`
    case 'Factories':
      return `${baseClass} bg-blue-500/20 text-blue-600 dark:text-blue-400`
    case 'Defenses':
      return `${baseClass} bg-red-500/20 text-red-600 dark:text-red-400`
    case 'Structures':
      return `${baseClass} bg-gray-500/20 text-gray-600 dark:text-gray-400`
    default:
      return `${baseClass} bg-muted text-muted-foreground`
  }
}

interface SortHeaderProps {
  column: ColumnId
  columnDef: ColumnDef
  currentSort: ColumnId
  direction: SortDirection
  onSort: (column: ColumnId) => void
}

function SortHeader({ column, columnDef, currentSort, direction, onSort }: SortHeaderProps) {
  const isActive = currentSort === column
  const alignClass = columnDef.align === 'left' ? 'text-left' : columnDef.align === 'right' ? 'text-right' : 'text-center'
  const responsiveClass = columnDef.responsive ?? ''

  return (
    <th className={`py-3 px-2 font-semibold ${alignClass} ${responsiveClass}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-primary transition-colors"
        aria-label={`Sort by ${columnDef.label}${isActive ? (direction === 'asc' ? ', currently ascending' : ', currently descending') : ''}`}
      >
        {columnDef.shortLabel ?? columnDef.label}
        <span className="inline-flex flex-col text-[10px] leading-none" aria-hidden="true">
          <svg
            className={`w-2 h-2 ${isActive && direction === 'asc' ? 'text-primary' : 'text-muted-foreground/40'}`}
            fill="currentColor"
            viewBox="0 0 8 4"
          >
            <path d="M4 0L8 4H0L4 0Z" />
          </svg>
          <svg
            className={`w-2 h-2 ${isActive && direction === 'desc' ? 'text-primary' : 'text-muted-foreground/40'}`}
            fill="currentColor"
            viewBox="0 0 8 4"
          >
            <path d="M4 4L0 0H8L4 4Z" />
          </svg>
        </span>
      </button>
    </th>
  )
}

export function UnitTable({
  units,
  factionId,
  brokenImages,
  onImageError,
  showFactionColumn = false,
  getUnitFactionId,
  commanderGrouping,
  typeFilters = [],
}: UnitTableProps) {
  const [sortColumn, setSortColumn] = useState<ColumnId>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Detect which column preset to use based on type filters
  const presetId = useMemo(() => detectPresetFromFilters(typeFilters), [typeFilters])

  // Get column definitions for this preset
  const columns = useMemo(
    () => getColumnsForPreset(presetId, showFactionColumn),
    [presetId, showFactionColumn]
  )

  const handleSort = useCallback((column: ColumnId) => {
    setSortColumn(prev => {
      if (prev === column) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
        return prev
      }
      setSortDirection('asc')
      return column
    })
  }, [])

  const toggleGroup = useCallback((statsHash: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(statsHash)) {
        next.delete(statsHash)
      } else {
        next.add(statsHash)
      }
      return next
    })
  }, [])

  // Build lookup maps for commander group membership
  const { groupMap: commanderGroupMap, variantIdentifiers } = useCommanderGroupMaps(
    commanderGrouping?.commanders
  )

  const sortedUnits = useMemo(() => {
    const sorted = [...units].sort((a, b) => {
      let comparison = 0

      // Special handling for columns that need custom sorting
      switch (sortColumn) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName)
          break
        case 'faction': {
          const factionA = showFactionColumn ? (a as UnitIndexEntryWithFaction).factionDisplayName : ''
          const factionB = showFactionColumn ? (b as UnitIndexEntryWithFaction).factionDisplayName : ''
          comparison = factionA.localeCompare(factionB)
          break
        }
        case 'category': {
          const catA = getUnitCategory(a.unitTypes)
          const catB = getUnitCategory(b.unitTypes)
          comparison = CATEGORY_ORDER.indexOf(catA) - CATEGORY_ORDER.indexOf(catB)
          break
        }
        case 'tier':
          comparison = a.unit.tier - b.unit.tier
          break
        default: {
          // Use column definition's getValue for other columns
          const columnDef = COLUMN_DEFS[sortColumn]
          if (columnDef) {
            const valueA = columnDef.getValue(a)
            const valueB = columnDef.getValue(b)
            const numA = typeof valueA === 'number' ? valueA : 0
            const numB = typeof valueB === 'number' ? valueB : 0
            comparison = numA - numB
          }
          break
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [units, sortColumn, sortDirection, showFactionColumn])

  // Build display rows: filter out variants that are collapsed, insert expanded variants after their representative
  const displayRows = useMemo(() => {
    const rows: Array<{
      entry: UnitIndexEntry | UnitIndexEntryWithFaction
      isVariant: boolean
      group?: CommanderGroup
    }> = []

    for (const entry of sortedUnits) {
      const group = commanderGroupMap.get(entry.identifier)
      const isVariant = variantIdentifiers.has(entry.identifier)

      if (isVariant) {
        // Skip variants in main iteration - they'll be added after their representative
        continue
      }

      // Add the unit (representative or non-grouped)
      rows.push({ entry, isVariant: false, group: group?.variants.length ? group : undefined })

      // If this is a representative of an expanded group, add its variants
      if (group && group.variants.length > 0 && expandedGroups.has(group.statsHash)) {
        // Sort variants alphabetically
        const sortedVariants = [...group.variants].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        )
        for (const variant of sortedVariants) {
          rows.push({ entry: variant, isVariant: true, group })
        }
      }
    }

    return rows
  }, [sortedUnits, commanderGroupMap, variantIdentifiers, expandedGroups])

  if (units.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No units match your filters
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {/* Icon column - always first */}
            <th className="text-left py-3 px-2 font-semibold w-10"></th>
            {/* Dynamic columns based on preset */}
            {columns.map((colDef) => (
              <SortHeader
                key={colDef.id}
                column={colDef.id}
                columnDef={colDef}
                currentSort={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map(({ entry, isVariant, group }) => {
            const unit = entry.unit
            const category = getUnitCategory(entry.unitTypes)
            const unitFactionId = getUnitFactionId ? getUnitFactionId(entry) : factionId
            const factionDisplayName = showFactionColumn ? (entry as UnitIndexEntryWithFaction).factionDisplayName : ''
            const hasVariants = group && group.variants.length > 0
            const isExpanded = group && expandedGroups.has(group.statsHash)

            return (
              <tr
                key={showFactionColumn ? `${unitFactionId}:${entry.identifier}` : entry.identifier}
                className={`border-b hover:bg-muted/30 transition-colors ${isVariant ? 'bg-muted/20 border-dashed' : ''}`}
              >
                {/* Icon cell */}
                <td className="py-2 px-2">
                  <div className={`w-8 h-8 flex items-center justify-center ${isVariant ? 'ml-2' : ''}`}>
                    {brokenImages.has(entry.identifier) ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-[8px] font-mono rounded">
                        ?
                      </div>
                    ) : (
                      <UnitIcon
                        imagePath={unit.image}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                        onError={() => onImageError(entry.identifier)}
                        factionId={unitFactionId}
                      />
                    )}
                  </div>
                </td>
                {/* Dynamic column cells */}
                {columns.map((colDef) => {
                  const alignClass = colDef.align === 'left' ? 'text-left' : colDef.align === 'right' ? 'text-right' : 'text-center'
                  const responsiveClass = colDef.responsive ?? ''

                  // Special handling for name column (includes link and variant controls)
                  if (colDef.id === 'name') {
                    return (
                      <td key={colDef.id} className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          {isVariant && (
                            <span className="text-muted-foreground">↳</span>
                          )}
                          <Link
                            to={showFactionColumn
                              ? `/faction/${unitFactionId}/unit/${entry.identifier}?from=all`
                              : `/faction/${unitFactionId}/unit/${entry.identifier}`
                            }
                            className="font-medium text-primary hover:underline"
                          >
                            {entry.displayName}
                          </Link>
                          {hasVariants && !isVariant && (
                            <button
                              type="button"
                              onClick={(e) => toggleGroup(group.statsHash, e)}
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? `Hide ${group.variants.length} variants` : `Show ${group.variants.length} variants`}
                            >
                              {isExpanded ? `Hide ${group.variants.length}` : `+${group.variants.length}`}
                            </button>
                          )}
                          {isVariant && (
                            <span className="text-[10px] text-muted-foreground italic">(identical stats)</span>
                          )}
                        </div>
                      </td>
                    )
                  }

                  // Special handling for faction column
                  if (colDef.id === 'faction') {
                    return (
                      <td key={colDef.id} className={`py-2 px-2 ${responsiveClass}`}>
                        <Link
                          to={`/faction/${unitFactionId}`}
                          className="text-muted-foreground hover:text-primary hover:underline text-xs"
                        >
                          {factionDisplayName}
                        </Link>
                      </td>
                    )
                  }

                  // Special handling for category column (with badge styling)
                  if (colDef.id === 'category') {
                    return (
                      <td key={colDef.id} className={`py-2 px-2 ${responsiveClass}`}>
                        <span className={getCategoryBadgeClass(category)}>
                          {category}
                        </span>
                      </td>
                    )
                  }

                  // Special handling for tier column (centered, styled)
                  if (colDef.id === 'tier') {
                    return (
                      <td key={colDef.id} className={`py-2 px-2 ${alignClass} ${responsiveClass}`}>
                        <span className="font-mono text-xs">{colDef.format(colDef.getValue(entry))}</span>
                      </td>
                    )
                  }

                  // Standard numeric/text columns
                  const value = colDef.getValue(entry)
                  const formatted = colDef.format(value)

                  return (
                    <td key={colDef.id} className={`py-2 px-2 ${alignClass} ${responsiveClass} font-mono`}>
                      {formatted}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
