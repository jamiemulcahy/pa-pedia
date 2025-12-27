import { StatSection } from '../StatSection'
import { StatRow } from '../StatRow'
import { ComparisonValue } from '../ComparisonValue'
import type { AggregatedWeapon } from '@/types/group'
import { formatNumber } from '@/utils/groupAggregation'

interface GroupWeaponsSectionProps {
  weapons: AggregatedWeapon[]
  compareWeapons?: AggregatedWeapon[]
  /** Hide diff indicators (for primary group side) */
  hideDiff?: boolean
}

/**
 * Match comparison weapons to primary weapons by safeName
 */
function findMatchingWeapon(
  weapons: AggregatedWeapon[],
  targetSafeName: string
): AggregatedWeapon | undefined {
  return weapons.find(w => w.safeName === targetSafeName)
}

export interface GroupWeaponCardProps {
  weapon: AggregatedWeapon
  compareWeapon?: AggregatedWeapon
  hideDiff?: boolean
}

/** Single weapon card - exported for use in aligned weapon rows */
export function GroupWeaponCard({ weapon, compareWeapon, hideDiff }: GroupWeaponCardProps) {
  // Determine if sustained DPS is different from burst DPS
  const hasSustainedDps = weapon.totalSustainedDps !== undefined &&
    weapon.totalSustainedDps !== weapon.totalDps

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
          {weapon.safeName}
        </h4>
        <span className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          x{formatNumber(weapon.totalCount)}
        </span>
      </div>

      {/* Single column layout like unit mode */}
      <div className="space-y-1 text-sm">
        <StatRow
          label={hasSustainedDps ? "DPS (Burst)" : "Total DPS"}
          value={
            <ComparisonValue
              value={Number(weapon.totalDps.toFixed(1))}
              compareValue={compareWeapon ? Number(compareWeapon.totalDps.toFixed(1)) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
        {hasSustainedDps && (
          <StatRow
            label="DPS (Sustained)"
            value={
              <ComparisonValue
                value={Number(weapon.totalSustainedDps!.toFixed(1))}
                compareValue={compareWeapon?.totalSustainedDps !== undefined ? Number(compareWeapon.totalSustainedDps.toFixed(1)) : undefined}
                comparisonType="higher-better"
                hideDiff={hideDiff}
              />
            }
          />
        )}
        {weapon.maxRange !== undefined && (
          <StatRow
            label="Max Range"
            value={
              <ComparisonValue
                value={Math.round(weapon.maxRange)}
                compareValue={compareWeapon?.maxRange !== undefined ? Math.round(compareWeapon.maxRange) : undefined}
                comparisonType="higher-better"
                hideDiff={hideDiff}
              />
            }
          />
        )}
        <StatRow
          label="Total Damage"
          value={
            <ComparisonValue
              value={Math.round(weapon.totalDamage)}
              compareValue={compareWeapon ? Math.round(compareWeapon.totalDamage) : undefined}
              comparisonType="higher-better"
              hideDiff={hideDiff}
            />
          }
        />
        {weapon.rateOfFire !== undefined && (
          <StatRow
            label="Rate of Fire"
            value={`${weapon.rateOfFire.toFixed(1)}/s`}
          />
        )}
      </div>

      {weapon.targetLayers && weapon.targetLayers.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Targets: {weapon.targetLayers.join(', ')}
        </div>
      )}

      {/* Source units - always show inline */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        From: {weapon.sourceUnits.map(s => `${s.quantity}x ${s.displayName}`).join(', ')}
      </div>
    </div>
  )
}

export function GroupWeaponsSection({
  weapons,
  compareWeapons,
  hideDiff,
}: GroupWeaponsSectionProps) {
  if (weapons.length === 0) {
    return null
  }

  return (
    <StatSection title="Weapons">
      <div className="space-y-3">
        {weapons.map((weapon, index) => {
          const compareWeapon = compareWeapons
            ? findMatchingWeapon(compareWeapons, weapon.safeName)
            : undefined

          return (
            <GroupWeaponCard
              key={`${weapon.safeName}-${index}`}
              weapon={weapon}
              compareWeapon={compareWeapon}
              hideDiff={hideDiff}
            />
          )
        })}
      </div>
    </StatSection>
  )
}
