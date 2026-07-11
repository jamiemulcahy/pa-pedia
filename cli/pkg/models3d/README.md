# models3d — PA `.papa` → web model pipeline

Converts Planetary Annihilation `.papa` unit models into browser-renderable assets
(geometry `.glb` + grayscale diffuse + team-colour mask) using **headless Blender**.

See the design spec: `docs/superpowers/specs/2026-07-11-3d-model-viewer-design.md`.

## How it works

`convert.py` runs under Blender and batch-converts a list of units:

```
blender --background --factory-startup --python convert.py -- <addon.zip> <jobs.json> <texture_size>
```

- `<addon.zip>` — a zip of `blender-papa-io/` (see below). Zip it at build time.
- `<jobs.json>` — `[{ "unitId", "papa": "<abs windows path>", "outDir" }, ...]`.
  Texture `.papa` files must sit alongside the model `.papa` (as they do in a PA install /
  extracted mod tree); the addon auto-loads them.
- `<texture_size>` — max texture edge (design default 512).

Per unit it writes `models/<unitId>.glb` (Draco, no baked material) and
`textures/<unitId>_{diffuse,mask,material}.png`, and prints `RESULT <json>` per unit
(`ok`, `files` or `error`) so the caller can assemble `models.json`. One unit's failure
never aborts the batch.

**Team colour is applied at runtime in the web viewer**, so we export geometry + raw
grayscale diffuse + RGB mask (R=main, G=highlight, B=emissive) rather than the addon's
baked material.

## Requirements

- **Blender 5.1.x** (pinned — validated). Newer/older versions may drift on shader-node
  socket names; re-validate before bumping.
- The vendored addon must be zipped and passed to `convert.py`.

## Vendored addon: `blender-papa-io/`

Source: https://github.com/Luther-1/Blender-PAPA-IO (MIT, see `blender-papa-io/LICENSE`).

**Local patch applied** (needed on Blender 5.1): in `import_papa.py`, the `SeparateColor`
node output was renamed `"R"` → `"Red"` in current Blender (lines ~517 and ~767).
Both occurrences are patched. If you re-vendor a newer upstream, re-apply / re-verify this.
