import { createContext } from 'react'
import type { FactionMetadataWithLocal } from '@/services/factionLoader'

export interface CurrentFactionContextValue {
  factionId: string
  isLocal: boolean
  metadata: FactionMetadataWithLocal | undefined
  /** The specific version being viewed, or undefined/null for latest */
  version?: string | null
}

export const CurrentFactionContext = createContext<CurrentFactionContextValue | null>(null)
