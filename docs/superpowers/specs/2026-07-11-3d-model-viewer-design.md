# 3D Unit Model Viewer — Design

**Status:** Approved to implement · **Date:** 2026-07-11 · **Author:** spike-validated (see `memory/papa-to-gltf-pipeline.md`)

## Goal

Show a rotatable, textured 3D model of each PA unit on the Unit Detail page, with PA's
two-colour team-paint system: a per-faction **default** colour pair plus a live
**user-adjustable** main + highlight colour picker (as proven in the spike GIF).

## Non-goals (v1)

- Animations (idle/build/death `.papa` anims exist but are deferred).
- Particle effects (`.pfx`).
- Fully automated model generation inside the daily faction-update CI (see "CI / automation" — v1 generates locally/on-demand; automation is a fast follow).
- Normal maps / advanced PBR. v1 uses grayscale diffuse + mask (+ optional material/roughness map).

## Background (from the spike — all validated)

- `.papa` → `.glb` via **headless Blender** (`blender --background --factory-startup --python`)
  with the **Blender-PAPA-IO** addon (MIT). No custom `.papa` parser needed at runtime.
- Textures are DXT inside `.papa`; the addon decodes them. `radar.papa` → 40 KB Draco glb.
- **Team colour does not survive glTF export.** PA tints at runtime via a mask. Solution:
  ship **geometry glb + grayscale diffuse + mask** and tint in a small three.js `ShaderMaterial`.
  Mask channels: **R = main region, G = highlight region, B = emissive**. Diffuse is grayscale.
  Shader: `base = grayscale; base = mix(base, main*(0.35+lum), mask.r); base = mix(base, highlight*(0.35+lum), mask.g); base += mask.b*main`.
- Addon needs a 2-line patch on Blender 5.1: `import_papa.py` `outputs["R"]` → `outputs["Red"]`
  (lines ~517 & ~767). We vendor a pinned, patched copy.

## Architecture overview

Two independent deliverables (two PRs), plus shared data-contract changes.

```
PR1 (CLI + tooling)                         PR2 (web)
─────────────────────                       ─────────────
raw .papa (base+mods)                        manifest.json (+ model fields)
   │  CLI resolves per-unit model+texture         │
   │  paths using existing overlay/provenance      │  lazy per-unit fetch
   ▼                                                ▼
headless Blender (vendored patched addon)     modelLoader (range-read into
   │  → geometry.glb + diffuse + mask (+material) per-faction model bundle)
   ▼                                                ▼
per-faction MODEL BUNDLE zip + models.json     UnitModelViewer (three.js
   │  uploaded to `faction-models` release        ShaderMaterial + colour picker)
   ▼                                                ▼
manifest.json gains model bundle info          UnitDetail shows 3D tab / graceful absence
```

### Data contract (shared, defined in PR1, consumed by PR2)

1. **Model bundle** (per faction+version): a zip named
   `{factionId}-{version}-pedia{timestamp}-models.zip`, uploaded to a **separate release tag
   `faction-models`** (keeps the fast `faction-data` release and its download flow untouched).
   Contents:
   - `models/{unitId}.glb` — Draco geometry, no baked material.
   - `textures/{unitId}_diffuse.<ext>` — grayscale.
   - `textures/{unitId}_mask.<ext>` — R/G/B channel mask.
   - (optional) `textures/{unitId}_material.<ext>`.
   - `models.json` — index: `{ generated, unitCount, units: { [unitId]: { glb, diffuse, mask, material?, sizes } } }`.
     This is the **availability source of truth** — the web reads it to know which units have
     models without issuing failed requests.

2. **`manifest.json`** — each `VersionEntry` gains optional:
   ```jsonc
   "models": { "filename": "...-models.zip", "downloadUrl": "/faction-models/...", "size": 1234, "unitCount": 87 }
   ```
   Absent `models` = that faction/version has no models yet (the common case during backfill).

3. **Faction default colours** — extend `FactionMetadata` (CLI, from profile config) with:
   ```jsonc
   "teamColors": { "primary": "#007cff", "secondary": "#ff6400" }
   ```
   Defaults per faction: MLA blue/orange, Legion red/black, others chosen to match faction art.
   Web falls back to a neutral pair if absent.

### Texture format & size

- v1 target **512²**, exposed as a CLI flag (`--texture-size`, default 512). Grayscale diffuse
  and flat mask compress well.
- v1 encodes textures as **PNG** (simple, universal). **KTX2/Basis** is a documented follow-up
  optimisation (smaller + GPU-native) — the loader abstracts format so it can swap later.
- Estimated per-faction bundle ≈ 8–20 MB at 512²; per-unit fetch ≈ 30–120 KB.

## Component detail

### PR1 — CLI model pipeline

**New CLI surface** (Go), reusing existing profile + overlay/provenance resolution:
- Command `extract-models` (or `describe-faction --with-models`) that, for a profile:
  1. Resolves each unit's model `.papa` + linked texture `.papa` paths via the existing
     loader/overlay logic (base game + mods, first-wins).
  2. For each unit, shells out to headless Blender running the vendored `convert.py`
     (import `.papa` → export geometry glb + save diffuse/mask/(material) PNG at `--texture-size`).
  3. Writes outputs to a model output dir mirroring the unit index.
- Skips units with no resolvable model (logged; they simply won't get a model — graceful).
- Deterministic-enough: Draco output isn't byte-stable, so tests assert structure/among
  presence, not hash equality.

**Vendored assets** (in repo):
- `cli/pkg/models3d/blender-papa-io/` — pinned patched PAPA-IO addon (MIT + NOTICE of patch).
- `cli/pkg/models3d/convert.py` — the headless import/export script (params: addon zip, papa, outdir, texture size).

**Packaging** (TS scripts, alongside existing `scripts/`):
- `build-model-bundles.ts` — zip each faction's model dir + emit `models.json`.
- `upload-to-releases.ts` extended (or a sibling) to push bundles to `faction-models`.
- `generate-manifest.ts` extended to attach `models` info per version (reads the
  `faction-models` release assets; matches by faction+version+timestamp).

**Runner**: `just generate-models` (needs local PA install + Blender on PATH). Blender version
**pinned** in docs and the just recipe (5.1.x validated). CI automation is a follow-up.

**Faction default colours**: add `teamColors` to profile configs + `FactionMetadata` model
+ schema-sync; MLA/Legion/Bugs/Exiles/Second-Wave values set.

### PR2 — Web viewer

**`modelLoader.ts`** (new service, mirrors `factionLoader` conventions):
- `getFactionModelsIndex(factionId, version)` — fetch + cache `models.json` (IndexedDB), or the
  whole small index; returns availability map. Absent bundle → returns "no models".
- `loadUnitModel(factionId, unitId, version)` — fetch the unit's glb + diffuse + mask. Strategy:
  **HTTP range requests** into the per-faction model bundle via `zip.js` (only the needed
  entries), cached per-unit in IndexedDB. **Fallback** (if range reads prove unreliable on the
  release CDN — a PR2 validation task): download the whole bundle once, cache, extract per-unit.
- Version-aware cache invalidation consistent with existing `staticFactionCache`.

**`UnitModelViewer.tsx`** (new component):
- three.js scene: `GLTFLoader` (+ Draco), `OrbitControls`, hemisphere+key lights, grid.
- Custom `ShaderMaterial` implementing the mask tint (formula above), uniforms `uMain`,
  `uHighlight`, `uDiffuse`, `uMask`.
- Colour UI: two `<input type=color>` (Main / Highlight) seeded from faction `teamColors`,
  plus a **Reset to faction default** control. User overrides persisted in `localStorage`
  (global preference) so the choice carries across units; reset restores faction default.
- three.js pinned as a new web dependency (bundle-size checked per CLAUDE.md).

**`UnitDetail.tsx` integration + graceful absence** (explicit requirement):
- On mount, consult the models index. If the unit **has** a model → render viewer (lazy/suspense,
  loading + error states). If **not** → render nothing extra (or a subtle "3D model not
  available yet" placeholder). The page must fully function with specs + icon exactly as today.
- No failed network request in the common no-model case (index tells us up front).
- A faction with no model bundle at all behaves identically (index fetch returns none).

## Backfill strategy (explicit requirement)

- Model bundles are keyed by faction+version+timestamp, same scheme as spec zips.
- v1 generates models for the **latest** version of each faction. A later **backfill** run
  generates bundles for older versions; `generate-manifest.ts` picks them up and attaches
  `models` to those `VersionEntry`s. No web changes needed — versions without a bundle simply
  show no 3D, versions with one show it.

## Error handling & edge cases

- Missing model / missing bundle / missing texture → graceful no-viewer (first-class path).
- Blender conversion failure for a unit → unit skipped in bundle, logged; never blocks the run.
- Corrupt/partial cached model → re-fetch (mirror existing cache fallback pattern).
- WebGL unavailable → viewer shows a static fallback message; page otherwise unaffected.
- Solid-material units (like radar) and `_diffuse`-textured units both supported (validate one
  textured combat unit early in PR1).

## Testing

- **CLI**: unit tests for path resolution (model+texture across overlay); `models.json` shape;
  skip-on-missing behaviour. One end-to-end conversion smoke test gated on Blender availability
  (skipped in CI if absent) covering a solid-material unit **and** a textured unit.
- **Web**: component tests for `UnitModelViewer` states (loading / loaded / no-model / error) and
  colour picker → uniform updates + localStorage persistence + reset; `modelLoader` caching &
  missing-bundle handling. Browser verification via the Chrome extension / Playwright per
  project convention.

## Rollout / PR split

- **PR1**: CLI `extract-models` + vendored addon/convert.py + packaging scripts + manifest &
  metadata (`teamColors`) extensions + `just generate-models` + tests + this spec. No UI.
  Produces bundles to `faction-models`. Independently reviewable; no user-visible change.
- **PR2**: `modelLoader` + `UnitModelViewer` + colour picker + `UnitDetail` integration +
  graceful absence + three.js dep + tests. Depends on PR1's data contract; can develop against
  a locally-generated bundle.

## Open questions / risks (to resolve during implementation)

1. **Range requests on GitHub release CDN** — validate early in PR2; whole-bundle fallback ready.
2. **CI model generation** — Blender-in-runner + whether the encrypted base-data archive must
   include `.papa` (adds ~1 GB). Deferred: v1 generates locally. Decide during backfill design.
3. **Texture encoding** — PNG now, KTX2/Basis follow-up; loader abstracts format.
