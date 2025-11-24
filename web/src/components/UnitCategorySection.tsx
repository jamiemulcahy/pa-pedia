import { Link } from 'react-router-dom'
import { UnitIcon } from '@/components/UnitIcon'
import type { UnitIndexEntry } from '@/types/faction'
import type { UnitCategory } from '@/utils/unitCategories'

interface UnitCategorySectionProps {
  category: UnitCategory
  units: UnitIndexEntry[]
  isExpanded: boolean
  onToggle: () => void
  factionId: string
  brokenImages: Set<string>
  onImageError: (unitId: string) => void
}

export function UnitCategorySection({
  category,
  units,
  isExpanded,
  onToggle,
  factionId,
  brokenImages,
  onImageError,
}: UnitCategorySectionProps) {
  if (units.length === 0) {
    return null
  }

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 px-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls={`category-${category}`}
      >
        <svg
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <h2 className="text-xl font-display font-bold">{category}</h2>
        <span className="px-2 py-0.5 text-sm font-mono bg-primary/20 text-primary rounded">
          {units.length}
        </span>
      </button>

      {isExpanded && (
        <div
          id={`category-${category}`}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4"
          role="list"
        >
          {units.map((unit) => (
            <Link
              key={unit.identifier}
              to={`/faction/${factionId}/unit/${unit.identifier}`}
              className="block border rounded-lg p-3 hover:border-primary transition-all hover:shadow-lg hover:shadow-primary/20 text-center"
              role="listitem"
              aria-label={`View ${unit.displayName} details`}
            >
              <div className="aspect-square mb-2 flex items-center justify-center">
                {brokenImages.has(unit.identifier) ? (
                  <div
                    className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs font-mono"
                    aria-label={`${unit.displayName} icon not available`}
                  >
                    No Icon
                  </div>
                ) : (
                  <UnitIcon
                    imagePath={unit.unit.image}
                    alt={`${unit.displayName} icon`}
                    className="max-w-full max-h-full object-contain"
                    onError={() => onImageError(unit.identifier)}
                  />
                )}
              </div>
              <div className="text-sm font-semibold truncate">{unit.displayName}</div>
              <div className="text-xs text-muted-foreground flex gap-1 flex-wrap justify-center mt-1">
                {unit.unitTypes.slice(0, 2).map((type) => (
                  <span key={type} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                    {type}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
