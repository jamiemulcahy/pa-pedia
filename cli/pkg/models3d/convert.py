"""
Headless PA .papa -> web-model converter.

Runs under Blender:
  blender --background --factory-startup --python convert.py -- <addon_zip> <jobs.json> <texture_size>

jobs.json: [{ "unitId": "radar", "papa": "C:/.../radar.papa", "outDir": "C:/out" }, ...]

For each job it writes, under outDir:
  models/<unitId>.glb                 geometry only (Draco), no baked material
  textures/<unitId>_diffuse.png       grayscale albedo/shading
  textures/<unitId>_mask.png          R=main G=highlight B=emissive region mask
  textures/<unitId>_material.png      (if present) roughness/spec

It prints one line per unit: "RESULT <json>" describing what was produced, so the
caller can build models.json. Team colour is applied at runtime in the web viewer,
so we deliberately export geometry + raw textures, NOT the addon's baked material.
"""
import bpy, sys, os, json, zipfile

argv = sys.argv[sys.argv.index("--") + 1:]
addon_zip, jobs_path, tex_size = argv[0], argv[1], int(argv[2])

# clean slate ONCE, then install + enable the vendored PAPA-IO addon.
# NOTE: read_factory_settings resets preferences and disables addons, so it must
# run BEFORE enabling the addon and never inside the per-unit loop.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_install(filepath=addon_zip, overwrite=True)
with zipfile.ZipFile(addon_zip) as z:
    addon_module = z.namelist()[0].split("/")[0]
bpy.ops.preferences.addon_enable(module=addon_module)


def purge_scene():
    """Remove all datablocks the previous import created (without a factory reset,
    which would disable the addon). Images MUST be cleared so texture name-matching
    doesn't pick up a prior unit's maps."""
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.images,
                 bpy.data.materials, bpy.data.armatures):
        for item in list(coll):
            coll.remove(item)

with open(jobs_path) as fh:
    jobs = json.load(fh)

TEX_TAGS = ("diffuse", "mask", "material")


def save_image(img, path, is_colour, size):
    if max(img.size) > size:
        img.scale(min(img.size[0], size), min(img.size[1], size))
    img.filepath_raw = path
    img.file_format = "PNG"
    if not is_colour:
        img.colorspace_settings.name = "Non-Color"
    img.save()


for job in jobs:
    unit_id, papa, out_dir = job["unitId"], job["papa"], job["outDir"]
    models_dir = os.path.join(out_dir, "models")
    tex_dir = os.path.join(out_dir, "textures")
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(tex_dir, exist_ok=True)

    purge_scene()  # fresh slate per unit (keeps the addon enabled)
    try:
        papa = os.path.normpath(papa)
        d = os.path.dirname(papa)
        f = os.path.basename(papa)
        bpy.ops.import_scene.uberent_papa(directory=d, files=[{"name": f}], importTextures=True)

        glb = os.path.join(models_dir, unit_id + ".glb")
        bpy.ops.export_scene.gltf(
            filepath=glb, export_format="GLB", export_materials="NONE",
            export_draco_mesh_compression_enable=True, export_apply=True,
        )

        produced = {"glb": os.path.relpath(glb, out_dir).replace("\\", "/")}
        for img in bpy.data.images:
            n = img.name.lower()
            tag = next((t for t in TEX_TAGS if t in n), None)
            if not tag:
                continue
            p = os.path.join(tex_dir, f"{unit_id}_{tag}.png")
            save_image(img, p, is_colour=(tag == "diffuse"), size=tex_size)
            produced[tag] = os.path.relpath(p, out_dir).replace("\\", "/")

        print("RESULT " + json.dumps({"unitId": unit_id, "ok": True, "files": produced}), flush=True)
    except Exception as e:  # never let one unit abort the batch
        print("RESULT " + json.dumps({"unitId": unit_id, "ok": False, "error": str(e)}), flush=True)
