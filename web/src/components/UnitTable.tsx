import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { UnitIcon } from '@/components/UnitIcon'
import type { UnitIndexEntry } from '@/types/faction'
import { getUnitCategory, CATEGORY_ORDER, type UnitCategory } from '@/utils/unitCategories'

interface UnitTableProps {
  units: UnitIndexEntry[]
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
}

type SortColumn = 'name' | 'category' | 'tier' | 'health' | 'dps' | 'range' | 'cost' | 'speed'
type SortDirection = 'asc' | 'desc'

function formatNumber(value: number | undefined): string {
  if (value === undefined) return '-'
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`
  }
  return value.toFixed(0)
}

function formatDps(value: number | undefined): string {
  if (value === undefined || value === 0) return '-'
  return value.toFixed(1)
}

function formatSpeed(value: number | undefined): string {
  if (value === undefined) return '-'
  return value.toFixed(0)
}

function getTierLabel(tier: number): string {
  switch (tier) {
    case 1: return 'T1'
    case 2: return 'T2'
    case 3: return 'T3'
    default: return '-'
  }
}

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

function getMaxRange(entry: UnitIndexEntry): number {
  return entry.unit.specs.combat.weapons?.reduce(
    (max, w) => Math.max(max, w.maxRange ?? 0),
    0
  ) ?? 0
}

interface SortHeaderProps {
  column: SortColumn
  currentSort: SortColumn
  direction: SortDirection
  onSort: (column: SortColumn) => void
  children: React.ReactNode
  className?: string
}

function SortHeader({ column, currentSort, direction, onSort, children, className = '' }: SortHeaderProps) {
  const isActive = currentSort === column

  return (
    <th className={`py-3 px-2 font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-primary transition-colors"
        aria-label={`Sort by ${column}${isActive ? (direction === 'asc' ? ', currently ascending' : ', currently descending') : ''}`}
      >
        {children}
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
}: UnitTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedUnits = useMemo(() => {
    const sorted = [...units].sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName)
          break
        case 'category': {
          const catA = getUnitCategory(a.unitTypes)
          const catB = getUnitCategory(b.unitTypes)
          comparison = CATEGORY_ORDER.indexOf(catA) - CATEGORY_ORDER.indexOf(catB)
          break
        }
        case 'tier':
          comparison = a.unit.tier - b.unit.tier
          break
        case 'health':
          comparison = a.unit.specs.combat.health - b.unit.specs.combat.health
          break
        case 'dps':
          comparison = (a.unit.specs.combat.dps ?? 0) - (b.unit.specs.combat.dps ?? 0)
          break
        case 'range':
          comparison = getMaxRange(a) - getMaxRange(b)
          break
        case 'cost':
          comparison = a.unit.specs.economy.buildCost - b.unit.specs.economy.buildCost
          break
        case 'speed':
          comparison = (a.unit.specs.mobility?.moveSpeed ?? 0) - (b.unit.specs.mobility?.moveSpeed ?? 0)
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [units, sortColumn, sortDirection])

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
            <th className="text-left py-3 px-2 font-semibold w-10"></th>
            <SortHeader
              column="name"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-left"
            >
              Name
            </SortHeader>
            <SortHeader
              column="category"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-left hidden sm:table-cell"
            >
              Category
            </SortHeader>
            <SortHeader
              column="tier"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-center hidden md:table-cell"
            >
              Tier
            </SortHeader>
            <SortHeader
              column="health"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-right"
            >
              Health
            </SortHeader>
            <SortHeader
              column="dps"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-right hidden sm:table-cell"
            >
              DPS
            </SortHeader>
            <SortHeader
              column="range"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-right hidden lg:table-cell"
            >
              Range
            </SortHeader>
            <SortHeader
              column="cost"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-right hidden md:table-cell"
            >
              Cost
            </SortHeader>
            <SortHeader
              column="speed"
              currentSort={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-right hidden xl:table-cell"
            >
              Speed
            </SortHeader>
          </tr>
        </thead>
        <tbody>
          {sortedUnits.map((entry) => {
            const unit = entry.unit
            const category = getUnitCategory(entry.unitTypes)
            const maxRange = getMaxRange(entry)

            return (
              <tr
                key={entry.identifier}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                <td className="py-2 px-2">
                  <div className="w-8 h-8 flex items-center justify-center">
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
                      />
                    )}
                  </div>
                </td>
                <td className="py-2 px-2">
                  <Link
                    to={`/faction/${factionId}/unit/${entry.identifier}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {entry.displayName}
                  </Link>
                </td>
                <td className="py-2 px-2 hidden sm:table-cell">
                  <span className={getCategoryBadgeClass(category)}>
                    {category}
                  </span>
                </td>
                <td className="py-2 px-2 text-center hidden md:table-cell">
                  <span className="font-mono text-xs">{getTierLabel(unit.tier)}</span>
                </td>
                <td className="py-2 px-2 text-right font-mono">
                  {formatNumber(unit.specs.combat.health)}
                </td>
                <td className="py-2 px-2 text-right font-mono hidden sm:table-cell">
                  {formatDps(unit.specs.combat.dps)}
                </td>
                <td className="py-2 px-2 text-right font-mono hidden lg:table-cell">
                  {maxRange ? formatNumber(maxRange) : '-'}
                </td>
                <td className="py-2 px-2 text-right font-mono hidden md:table-cell">
                  {formatNumber(unit.specs.economy.buildCost)}
                </td>
                <td className="py-2 px-2 text-right font-mono hidden xl:table-cell">
                  {formatSpeed(unit.specs.mobility?.moveSpeed)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
