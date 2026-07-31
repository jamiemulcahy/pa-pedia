# Automating 3D model generation

Scoping note for making `faction-models` run automatically when faction data
updates, without the cost that made it manual-dispatch in the first place.

Status: **investigation only** — nothing here is implemented.

## 1. What the pipeline actually costs today

Measured from the three real `faction-models` runs (GitHub Actions API), not
estimated:

| Run | Date | Scope | Blender step | Total job |
|-----|------|-------|--------------|-----------|
| #1 | 2026-07-11 | all (failed late) | — | 13m 07s |
| #2 | 2026-07-12 | MLA, Legion, Bugs, Second-Wave (491 units) | **9m 31s** | 11m 17s |
| #3 | 2026-07-12 | Exiles only (109 units) | **1m 43s** | 3m 40s |

Two independent samples put conversion at **~1 second per unit** (1.16 s/unit
and 0.94 s/unit). Fixed overhead is **~2 minutes** per run regardless of scope:

| Step | Time |
|------|------|
| checkout + base-data download + decrypt | ~30s |
| setup-go + build CLI | ~12s |
| setup-node + npm ci | ~7s |
| **install Blender 5.1.2** | **~45s** |
| bundle + upload + manifest regen | ~20–40s |

Current faction sizes total **611 units** (MLA 193, Bugs 128, Legion 126,
Exiles 109, Second-Wave 44, Replicate 11), so a full regeneration today is
**~12–13 minutes**, of which ~10 minutes is Blender.

Bundle sizes: MLA 86.5 MB, Bugs 35.2 MB, Exiles 33.2 MB, Legion 22.7 MB,
Second-Wave 12.8 MB — **~190 MB per full regeneration**, and
`upload-model-bundles` never deletes old bundles.

Update frequency: 17 faction-data merges in the last two months (~2/week,
arriving in bursts — five landed on 2026-07-30).

## 2. The premise is worth re-checking: minutes are free here

`pa-pedia` is a **public** repository, and GitHub Actions on standard runners
is free and unmetered for public repos. The API confirms it for the model run:

```json
"billable": { "UBUNTU": { "total_ms": 0, "jobs": 1 } }
```

So a daily full regeneration would cost **£0 in Actions minutes**. The concern
that made this workflow manual doesn't apply to this repo as it stands. (It
would apply immediately if the repo ever went private — 13 min/day ≈ 390
min/month against a 2,000-minute free tier, so still affordable but no longer
free.)

What *does* cost something:

1. **Release-asset accumulation.** Every full run adds ~190 MB of bundles that
   are never pruned. Daily ⇒ ~5.7 GB/month, forever.
2. **The manifest generator downloads whole bundles.** `readModelUnitCount()`
   in `scripts/generate-manifest.ts` fetches each entire model bundle just to
   read one integer out of `models.json`. That runs on **every faction-data
   push** — already ~190 MB per daily run, and it grows linearly with the
   number of bundles. This is the real budget problem, and it exists today
   independently of anything proposed here.
3. **Wall-clock**, if you care about how long after a merge the models appear.

So the honest framing is: this is not primarily a cost-saving exercise, it's a
*freshness* and *waste* exercise. That changes which option is best.

## 3. A correctness bug found while scoping

Model bundles are correlated to faction data by `(factionId, version)` only
(`selectModelBundle` in `scripts/model-bundles.ts`). But upstream mods
regularly ship changed data **without bumping their version** — the
`update-factions` workflow explicitly handles this ("upstream changed without a
version bump", `update-factions.yml`), and history shows it: Bugs v1.38,
Legion v1.32.1 and Exiles v0.7.4.6 were each re-extracted twice.

When that happens the *new* faction data inherits the *old* bundle, silently.
If the upstream refresh changed a model, the site shows stale geometry with no
signal — the exact failure mode the "never approximate" doctrine in
`model-bundles.ts` was written to prevent. Version equality is being used as a
proxy for content equality, and it isn't one.

Content hashing (Option B below) fixes this in both directions: it skips work
when the version changed but the models didn't, *and* rebuilds when the version
didn't change but the models did.

## 4. Options

### Option A — Auto-trigger, scoped to the factions that changed

The `Faction Data Release` workflow already fires on pushes to `main` touching
`factions/**`. Add the same trigger to `faction-models`, derive the changed
faction folders from the push diff, and pass only those profiles to
`extract-models`.

- **Effort**: ~20 lines of YAML. No changes to the CLI, bundles, manifest or web app.
- **Typical run**: 1–2 factions ⇒ 2 min fixed + 1–2 min Blender = **3–5 min**.
- **Worst case** (the 2026-07-30 burst, 5 factions): ~11 min, or several
  serialised runs under the existing `concurrency: faction-models` group.
- **Gets you**: models that track faction updates automatically, today.
- **Doesn't get you**: any reduction in wasted work when models didn't change
  (which is most of the time), and it makes the manifest/asset-growth problems
  in §2 worse, roughly 2×/week instead of ad hoc.

### Option D — Cut the fixed and wall-clock cost (independent of A/B/C)

- **Cache the Blender tarball** in `actions/cache` keyed on `BLENDER_VERSION`:
  saves ~45s of the ~2 min fixed overhead.
- **Matrix the extraction per faction**, then a single dependent job to bundle,
  upload and regenerate the manifest. Public repos get 20 concurrent jobs, so
  all six factions run in parallel: full regeneration drops from ~12 min to
  **~4 min wall-clock** (bounded by MLA's 193 units). Total *machine* time goes
  up slightly, which is free here.

Cheap, low-risk, and orthogonal to everything else.

### Option B — Source-digest gate + bundle aliasing (the "copy the old artefacts" idea)

Give every unit a content hash over the exact inputs the pipeline consumes:
the resolved model `.papa` bytes, its resolved `_diffuse`/`_mask`/`_material`
`.papa` bytes, plus a **pipeline version** salt (hash of `convert.py` + the
vendored addon + `BLENDER_VERSION` + `--texture-size`). A faction digest is the
hash of the sorted per-unit hashes, so added/removed units change it too.

Compute it from the *same code path* that stages Blender jobs
(`models3d.buildJobs`) — e.g. an `extract-models --plan` mode that resolves and
hashes but never launches Blender — so the digest can never drift from what
would actually be converted. Cost: seconds, over inputs the workflow has
already downloaded.

Then:

- Publish a small **sidecar index asset** next to each bundle
  (`{id}-{ver}-pedia{ts}-models.index.json`, a few KB) carrying the faction
  digest, per-unit hashes, pipeline version and `unitCount`.
- On a faction update, run `--plan`, compare against the sidecars. If a bundle
  already exists with an identical digest, **do not run Blender at all**.

For attaching that bundle to the new version, two shapes:

| | Re-stamp (physically copy) | Alias (recommended) |
|---|---|---|
| Mechanism | download old bundle, re-upload as `{id}-{newver}-...-models.zip` | manifest attaches the existing bundle to the new version when digests match |
| Manifest change | none | `selectModelBundle` gains a digest-equality path |
| Storage | +86 MB per MLA version bump, forever | none |
| Time | ~1 min of transfer | ~0 |
| Honesty | fine | fine — equality is *proven by hash*, not inferred from adjacency |

Aliasing is strictly better and stays faithful to the doctrine in
`model-bundles.ts`: the file header rejects serving a *neighbouring* version's
bundle, which is a guess. Serving a bundle whose inputs hash identically is not
a guess.

- **Effort**: medium. New CLI mode + digest plumbed into `models.json`/sidecar,
  new asset type, manifest correlation change, tests. Realistically a day or
  two of careful work.
- **Gets you**: most updates cost ~2 minutes and produce zero new bytes; the
  §3 staleness bug is fixed; MLA (86 MB, 193 units) stops being regenerated on
  every PA build bump.
- **Hard dependency**: the manifest generator must stop downloading whole
  bundles first (§2.2) — under aliasing *many more* version entries gain a
  `models` field, so today's code would download tens of bundles per manifest
  regen. The sidecar index solves both problems with the same asset.
- **What can go wrong**:
  - *Under-hashing.* Miss an input (texture size, addon revision, a texture tag)
    and you serve stale models believing they're current. Mitigation: derive the
    pipeline salt from file contents, not a hand-maintained version string, and
    fail closed — unknown/missing sidecar ⇒ full rebuild.
  - *Sidecar/bundle divergence*, if an upload half-fails. Mitigation: upload the
    sidecar only after the bundle upload succeeds; treat a bundle with no
    sidecar as "no bundle" for aliasing (it still works for exact-version match).
  - *Client re-downloads.* `modelLoader` caches keyed by `factionId@version`, so
    an aliased bundle is still re-downloaded under a new key. Re-keying that
    cache on the bundle filename is a small, separate win worth folding in —
    otherwise users re-fetch 86 MB of unchanged MLA models on every build bump.

### Option C — Incremental per-unit rebuild

With Option B's per-unit hashes this is mechanically straightforward: download
the previous bundle, run Blender only over units whose hash changed or that are
new, splice the outputs into the old bundle's contents, prune removed units,
re-zip.

But the arithmetic is unflattering. Conversion is ~1 s/unit against ~2 min of
fixed overhead, and downloading + re-zipping an 86 MB bundle is itself ~30–60 s.
For a typical mod update the whole faction is 2 minutes of Blender anyway — the
incremental path saves maybe 60–90 seconds while adding the ability to ship a
bundle whose files came from two different Blender runs. The only case where it
clearly pays is MLA (193 units, ~3 min) with a handful of changed models.

Risks: mixed-provenance bundles (addressed by the pipeline salt forcing a full
rebuild, but only if the salt is right); permanently inheriting units that
failed or crashed in an earlier run; a partial bundle download producing a
silently truncated bundle.

**Assessment**: not worth it now. Option B already removes the common case
entirely, and Option D removes more wall-clock for a fraction of the risk.
Revisit if faction count or unit count grows several-fold.

## 5. Recommendation

Phase it, and don't build the expensive thing first.

1. **Now — Option A + D.** Auto-trigger scoped to changed factions, cache the
   Blender tarball, matrix per faction. A few hours of work, no new concepts,
   and it solves the stated problem: models track faction updates without
   anyone dispatching a workflow. Typical merge ⇒ models live in ~3 minutes.
2. **Next — fix the manifest generator** to read `unitCount` from a sidecar (or
   a ranged read of the zip's `models.json`) instead of downloading every
   bundle. This is a standing cost on the *daily* faction-data workflow today,
   and it's a prerequisite for aliasing.
3. **Then — Option B.** Worth doing for the §3 staleness bug alone; the saved
   work is a bonus. It makes the "just reuse the old artefacts" instinct
   rigorous instead of approximate.
4. **Probably never — Option C**, unless the corpus grows a lot.

The one thing worth deciding early: whether Actions minutes are genuinely a
constraint. On a public repo they aren't, and if that stays true then Option A
+ D alone may be the whole answer, with B justified by correctness rather than
cost.

## 6. Open questions

- Should a models run be triggered by the faction-data **push**, or by
  `workflow_run` on `Faction Data Release` completing? The latter serialises
  behind the release so the manifest is regenerated once, after both.
- Burst behaviour: five factions merging within a minute currently means five
  queued runs against one `concurrency` group. Debounce, or accept it?
- MLA's version is the PA build number, which changes on every base-data
  refresh even when no model does — the single biggest beneficiary of Option B
  (86 MB, 193 units, ~3 min per run avoided).
