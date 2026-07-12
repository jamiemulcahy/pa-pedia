import { describe, it, expect } from 'vitest'
import { isAuxiliaryMeshName } from '../auxiliaryMesh'

describe('isAuxiliaryMeshName', () => {
  it('flags the build/nav platform mesh (the factory "extra box")', () => {
    expect(isAuxiliaryMeshName('air_factory_nav')).toBe(true)
    expect(isAuxiliaryMeshName('vehicle_factory_nav')).toBe(true)
    expect(isAuxiliaryMeshName('bot_factory_nav')).toBe(true)
  })

  it('flags the collision-hull mesh', () => {
    expect(isAuxiliaryMeshName('bot_factory_col')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isAuxiliaryMeshName('AIR_FACTORY_NAV')).toBe(true)
    expect(isAuxiliaryMeshName('Bot_Factory_Col')).toBe(true)
  })

  it('keeps the real geometry mesh', () => {
    expect(isAuxiliaryMeshName('air_factory_mesh')).toBe(false)
    expect(isAuxiliaryMeshName('radar_mesh')).toBe(false)
    expect(isAuxiliaryMeshName('assault_bot_mesh')).toBe(false)
  })

  it('keeps Blender-split geometry parts and detail meshes', () => {
    // Real geometry that merely *contains* mesh/highlight tokens, or is a
    // numbered duplicate — only a trailing _nav/_col segment is auxiliary.
    expect(isAuxiliaryMeshName('sea_mine_mesh.001')).toBe(false)
    expect(isAuxiliaryMeshName('tank_hover_mesh001')).toBe(false)
    expect(isAuxiliaryMeshName('bot_aa_mesh.008_edge_highlight')).toBe(false)
  })

  it('only matches a trailing _nav/_col segment, not substrings', () => {
    expect(isAuxiliaryMeshName('navmesh')).toBe(false)
    expect(isAuxiliaryMeshName('some_navy')).toBe(false)
    expect(isAuxiliaryMeshName('color_mesh')).toBe(false)
  })

  it('handles empty / missing names', () => {
    expect(isAuxiliaryMeshName('')).toBe(false)
    expect(isAuxiliaryMeshName(undefined)).toBe(false)
    expect(isAuxiliaryMeshName(null)).toBe(false)
  })
})
