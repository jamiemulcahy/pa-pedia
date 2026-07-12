/**
 * PA unit models bundle auxiliary meshes alongside the visible geometry:
 *   - `*_nav` — the build/nav platform units are placed on top of while being
 *     constructed (a second object that isn't part of the unit's appearance).
 *   - `*_col` — the collision hull, invisible in-game.
 *
 * Neither belongs in the 3D showcase viewer — left in, factories render a stray
 * "extra box" next to the actual model. This predicate flags those meshes so the
 * viewer can drop them.
 *
 * The match is on a trailing `_nav`/`_col` segment of the mesh/node name only.
 * Real geometry that merely *contains* those tokens — Blender-split duplicates
 * (`..._mesh.001`), detail meshes (`..._edge_highlight`), or names like
 * `navmesh` — is kept.
 */
export function isAuxiliaryMeshName(name: string | undefined | null): boolean {
  if (!name) return false
  return /_(?:nav|col)$/i.test(name)
}
