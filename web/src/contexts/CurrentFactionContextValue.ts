import { createContext } from 'react'
import type { FactionMetadataWithLocal } from '@/services/factionLoader'

export interface CurrentFactionContextValue {
  factionId: string
  isLocal: boolean
  metadata: FactionMetadataWithLocal | undefined
}

export const CurrentFactionContext = createContext<CurrentFactionContextValue | null>(null)
