import { useParams, Link } from 'react-router-dom'
import { useUnit } from '@/hooks/useUnit'
import { getUnitIconPath } from '@/services/factionLoader'

export function UnitDetail() {
  const { factionId, unitId } = useParams<{ factionId: string; unitId: string }>()
  const { unit, loading, error } = useUnit(factionId || '', unitId || '')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2">Loading unit...</div>
        </div>
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl font-semibold text-destructive mb-2">Error loading unit</div>
          <div className="text-muted-foreground">{error?.message || 'Unit not found'}</div>
          <Link to={`/faction/${factionId}`} className="text-primary hover:underline mt-4 inline-block">
            Back to faction
          </Link>
        </div>
      </div>
    )
  }

  const { specs, buildRelationships } = unit
  const weapons = specs.combat.weapons

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to={`/faction/${factionId}`} className="text-primary hover:underline mb-4 inline-block">
        &larr; Back to faction
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="md:col-span-1">
          <div className="border rounded-lg p-6">
            <div className="aspect-square mb-4 flex items-center justify-center bg-muted rounded">
              <img
                src={getUnitIconPath(factionId || '', unitId || '')}
                alt={unit.displayName}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = ''
                }}
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">{unit.displayName}</h1>
            {unit.description && (
              <p className="text-sm text-muted-foreground mb-4">{unit.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {unit.unitTypes.map(type => (
                <span key={type} className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <section className="border rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Combat</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Health</dt>
                <dd className="text-lg font-semibold">{specs.combat.health.toLocaleString()}</dd>
              </div>
              {specs.combat.dps !== undefined && (
                <div>
                  <dt className="text-sm text-muted-foreground">Total DPS</dt>
                  <dd className="text-lg font-semibold">{specs.combat.dps.toFixed(1)}</dd>
                </div>
              )}
            </dl>

            {weapons && weapons.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Weapons</h3>
                <div className="space-y-2">
                  {weapons.map((weapon, idx) => (
                    <div key={idx} className="text-sm border-l-2 border-primary/20 pl-3">
                      {weapon.name && <div className="font-medium">{weapon.name}</div>}
                      <div className="text-muted-foreground grid grid-cols-2 gap-2 mt-1">
                        {weapon.dps !== undefined && <div>DPS: {weapon.dps.toFixed(1)}</div>}
                        {weapon.maxRange !== undefined && <div>Range: {weapon.maxRange}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="border rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Economy</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Metal Cost</dt>
                <dd className="text-lg font-semibold">
                  {specs.economy.buildCost.toLocaleString()}
                </dd>
              </div>
              {specs.economy.buildRate !== undefined && (
                <div>
                  <dt className="text-sm text-muted-foreground">Build Rate</dt>
                  <dd className="text-lg font-semibold">{specs.economy.buildRate}</dd>
                </div>
              )}
            </dl>

            {(specs.economy.production || specs.economy.consumption) && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Production/Consumption</h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  {specs.economy.production?.metal !== undefined && (
                    <div>
                      <dt className="text-muted-foreground">Metal Production</dt>
                      <dd className="text-green-600">+{specs.economy.production.metal}/s</dd>
                    </div>
                  )}
                  {specs.economy.consumption?.metal !== undefined && (
                    <div>
                      <dt className="text-muted-foreground">Metal Consumption</dt>
                      <dd className="text-red-600">-{specs.economy.consumption.metal}/s</dd>
                    </div>
                  )}
                  {specs.economy.production?.energy !== undefined && (
                    <div>
                      <dt className="text-muted-foreground">Energy Production</dt>
                      <dd className="text-green-600">+{specs.economy.production.energy}/s</dd>
                    </div>
                  )}
                  {specs.economy.consumption?.energy !== undefined && (
                    <div>
                      <dt className="text-muted-foreground">Energy Consumption</dt>
                      <dd className="text-red-600">-{specs.economy.consumption.energy}/s</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </section>

          {specs.mobility && (
            <section className="border rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Mobility</h2>
              <dl className="grid grid-cols-2 gap-4">
                {specs.mobility.moveSpeed !== undefined && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Move Speed</dt>
                    <dd className="text-lg font-semibold">{specs.mobility.moveSpeed}</dd>
                  </div>
                )}
                {specs.mobility.turnSpeed !== undefined && (
                  <div>
                    <dt className="text-sm text-muted-foreground">Turn Speed</dt>
                    <dd className="text-lg font-semibold">{specs.mobility.turnSpeed}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {buildRelationships && (
            <section className="border rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Build Relationships</h2>
              {buildRelationships.builtBy && buildRelationships.builtBy.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Built By</h3>
                  <div className="flex flex-wrap gap-2">
                    {buildRelationships.builtBy.map((builder) => (
                      <Link
                        key={builder}
                        to={`/faction/${factionId}/unit/${builder}`}
                        className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-sm"
                      >
                        {builder}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {buildRelationships.builds && buildRelationships.builds.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Can Build</h3>
                  <div className="flex flex-wrap gap-2">
                    {buildRelationships.builds.map((buildable) => (
                      <Link
                        key={buildable}
                        to={`/faction/${factionId}/unit/${buildable}`}
                        className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-sm"
                      >
                        {buildable}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
