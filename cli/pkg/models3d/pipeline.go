// Package models3d drives the PA .papa -> web-model conversion pipeline.
//
// It resolves each unit's model .papa and its linked texture .papa files across
// the base game + mod overlay (first-wins), stages them so the vendored
// Blender-PAPA-IO addon can auto-load textures alongside the model, invokes
// headless Blender running convert.py, and assembles a models.json index plus
// the per-unit glb + texture PNG layout described in the design spec.
//
// convert.py and the vendored addon are a fixed, validated contract: this file
// only orchestrates them. See README.md and the design spec.
package models3d

import (
	"archive/zip"
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
)

// convertPy is the headless Blender import/export script (the proven core).
//
//go:embed convert.py
var convertPy []byte

// addonFS embeds the vendored, patched Blender-PAPA-IO addon. The `all:` prefix
// is required so files beginning with '_' (e.g. __init__.py) are included.
//
//go:embed all:blender-papa-io
var addonFS embed.FS

// addonModule is the top-level folder name inside the addon zip. convert.py
// derives the Blender module name from the first zip entry's leading path
// component, so this must match the embedded directory name.
const addonModule = "blender-papa-io"

// textureTags are the texture kinds the addon auto-loads alongside a model,
// matching convert.py's naming (<model>_<tag>.papa).
var textureTags = []string{"diffuse", "mask", "material"}

// Resolver is the subset of *loader.Loader the pipeline needs. Kept small so the
// staging logic can be unit-tested with a fake implementation (no PA install).
type Resolver interface {
	// GetJSON returns a unit's raw (unmerged) JSON so the model reference can be read.
	GetJSON(resourcePath string) (map[string]interface{}, error)
	// ResolveResource reports whether a resource exists in any source (nil if absent).
	ResolveResource(resourcePath string) *loader.SpecFileInfo
	// CopyResourceFile copies a resolved resource's bytes to destPath.
	CopyResourceFile(resourcePath, destPath string) error
}

// UnitRef identifies a unit to convert.
type UnitRef struct {
	ID           string
	ResourceName string // PA resource path to the unit JSON (e.g. /pa/units/land/radar/radar.json)
}

// Options configures a Generate run.
type Options struct {
	BlenderPath string // Blender executable (default "blender" on PATH)
	TextureSize int    // Max texture edge in px (default 512)
	OutDir      string // Faction model output dir (receives models/, textures/, models.json)
	Verbose     bool
	// KeepWork, when set, preserves the temp staging/work dir (debugging).
	KeepWork bool
}

// ModelEntry is one unit's record in models.json.
type ModelEntry struct {
	Glb      string           `json:"glb"`
	Diffuse  string           `json:"diffuse,omitempty"`
	Mask     string           `json:"mask,omitempty"`
	Material string           `json:"material,omitempty"`
	Sizes    map[string]int64 `json:"sizes"`
}

// ModelsIndex is the models.json availability source of truth consumed by the web.
type ModelsIndex struct {
	Generated string                `json:"generated"`
	UnitCount int                   `json:"unitCount"`
	Units     map[string]ModelEntry `json:"units"`
}

// Stats summarises a Generate run.
type Stats struct {
	Total     int // units considered
	Staged    int // units with a resolvable model staged into a Blender job
	Converted int // units Blender produced a model for
	Skipped   int // units with no resolvable model / no data
	Failed    int // units Blender attempted but failed
}

// job mirrors one entry of the jobs.json convert.py consumes.
type job struct {
	UnitID string `json:"unitId"`
	Papa   string `json:"papa"`
	OutDir string `json:"outDir"`
}

// runResult mirrors convert.py's per-unit "RESULT <json>" line.
type runResult struct {
	UnitID string            `json:"unitId"`
	OK     bool              `json:"ok"`
	Files  map[string]string `json:"files"`
	Error  string            `json:"error"`
}

type logf func(format string, args ...interface{})

// modelPapaPath returns the primary model .papa resource path from a unit's raw
// JSON. PA stores "model" as an array of layer variants; the first entry with a
// .papa filename wins (defensively also accepts a single object).
func modelPapaPath(unitJSON map[string]interface{}) (string, bool) {
	raw, ok := unitJSON["model"]
	if !ok {
		return "", false
	}

	consider := func(v interface{}) (string, bool) {
		m, ok := v.(map[string]interface{})
		if !ok {
			return "", false
		}
		fn, ok := m["filename"].(string)
		if !ok {
			return "", false
		}
		if strings.HasSuffix(strings.ToLower(fn), ".papa") {
			return fn, true
		}
		return "", false
	}

	switch model := raw.(type) {
	case []interface{}:
		for _, v := range model {
			if fn, ok := consider(v); ok {
				return fn, true
			}
		}
	case map[string]interface{}:
		if fn, ok := consider(model); ok {
			return fn, true
		}
	}
	return "", false
}

// texturePapaPaths returns the sibling texture .papa resource paths the addon
// looks for, keyed by tag. Mirrors the addon's extractTexture naming: insert
// "_<tag>" before the extension (radar.papa -> radar_diffuse.papa).
func texturePapaPaths(modelPapa string) map[string]string {
	dot := strings.LastIndex(modelPapa, ".")
	if dot < 0 {
		dot = len(modelPapa)
	}
	left, right := modelPapa[:dot], modelPapa[dot:]
	out := make(map[string]string, len(textureTags))
	for _, tag := range textureTags {
		out[tag] = left + "_" + tag + right
	}
	return out
}

// baseNoExt returns the file's base name without its extension ("radar" for
// "/pa/units/land/radar/radar.papa").
func baseNoExt(resourcePath string) string {
	b := path.Base(resourcePath)
	if dot := strings.LastIndex(b, "."); dot >= 0 {
		return b[:dot]
	}
	return b
}

// buildJobs resolves + stages each unit's model and texture .papa files into
// stageRoot so the addon can auto-load textures, returning the Blender jobs and
// run stats. Units with no resolvable model are skipped (logged), never fatal.
//
// Separated from Generate so it can be tested without invoking Blender.
func buildJobs(r Resolver, units []UnitRef, stageRoot, outDir string, log logf) ([]job, *Stats) {
	stats := &Stats{}
	var jobs []job

	for _, u := range units {
		stats.Total++

		raw, err := r.GetJSON(u.ResourceName)
		if err != nil {
			log("  skip %s: could not load unit JSON: %v", u.ID, err)
			stats.Skipped++
			continue
		}

		modelPapa, ok := modelPapaPath(raw)
		if !ok {
			log("  skip %s: no .papa model reference", u.ID)
			stats.Skipped++
			continue
		}

		if r.ResolveResource(modelPapa) == nil {
			log("  skip %s: model not found in any source: %s", u.ID, modelPapa)
			stats.Skipped++
			continue
		}

		modelBase := baseNoExt(modelPapa)
		stageDir := filepath.Join(stageRoot, u.ID)
		stagedModel := filepath.Join(stageDir, modelBase+".papa")
		if err := r.CopyResourceFile(modelPapa, stagedModel); err != nil {
			log("  skip %s: failed to stage model: %v", u.ID, err)
			stats.Skipped++
			continue
		}

		// Stage any linked texture .papa files alongside the model. Missing
		// textures are fine (solid-material units have none / a subset).
		for _, tag := range textureTags {
			texPath := texturePapaPaths(modelPapa)[tag]
			if r.ResolveResource(texPath) == nil {
				continue
			}
			dst := filepath.Join(stageDir, modelBase+"_"+tag+".papa")
			if err := r.CopyResourceFile(texPath, dst); err != nil {
				log("  warn %s: failed to stage %s texture: %v", u.ID, tag, err)
			}
		}

		jobs = append(jobs, job{UnitID: u.ID, Papa: stagedModel, OutDir: outDir})
		stats.Staged++
	}

	return jobs, stats
}

// assembleIndex parses convert.py's RESULT lines into a ModelsIndex, stat-ing
// produced files for sizes. Failed/absent units are omitted (their unit IDs are
// returned for logging). outDir is the faction model output dir the relative
// paths are resolved against.
func assembleIndex(outDir string, lines []string, generated string) (*ModelsIndex, []string) {
	idx := &ModelsIndex{Generated: generated, Units: map[string]ModelEntry{}}
	var failed []string

	for _, ln := range lines {
		ln = strings.TrimSpace(ln)
		if !strings.HasPrefix(ln, "RESULT ") {
			continue
		}
		var res runResult
		if err := json.Unmarshal([]byte(strings.TrimPrefix(ln, "RESULT ")), &res); err != nil {
			continue
		}
		if !res.OK || res.Files["glb"] == "" {
			if res.UnitID != "" {
				failed = append(failed, res.UnitID)
			}
			continue
		}

		entry := ModelEntry{
			Glb:      res.Files["glb"],
			Diffuse:  res.Files["diffuse"],
			Mask:     res.Files["mask"],
			Material: res.Files["material"],
			Sizes:    map[string]int64{},
		}
		for tag, rel := range res.Files {
			if fi, err := os.Stat(filepath.Join(outDir, filepath.FromSlash(rel))); err == nil {
				entry.Sizes[tag] = fi.Size()
			}
		}
		idx.Units[res.UnitID] = entry
	}

	idx.UnitCount = len(idx.Units)
	return idx, failed
}

// writeAddonZip writes the embedded addon to zipPath with a top-level
// "blender-papa-io/" folder, as convert.py's addon_install expects.
func writeAddonZip(zipPath string) error {
	f, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	err = fs_walk(addonFS, addonModule, func(name string, data []byte) error {
		// name already begins with "blender-papa-io/..."
		w, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = w.Write(data)
		return err
	})
	if err != nil {
		zw.Close()
		return err
	}
	return zw.Close()
}

// fs_walk walks an embed.FS subtree, invoking fn with each file's zip-style
// (forward-slash) path and contents.
func fs_walk(efs embed.FS, dir string, fn func(name string, data []byte) error) error {
	entries, err := efs.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		p := dir + "/" + e.Name()
		if e.IsDir() {
			if err := fs_walk(efs, p, fn); err != nil {
				return err
			}
			continue
		}
		data, err := efs.ReadFile(p)
		if err != nil {
			return err
		}
		if err := fn(p, data); err != nil {
			return err
		}
	}
	return nil
}

// runBlender invokes headless Blender and returns its stdout lines. Blender's
// stderr is forwarded (chatty on init); RESULT lines arrive on stdout.
func runBlender(blenderPath, convertPath, addonZip, jobsPath string, texSize int, verbose bool) ([]string, error) {
	args := []string{
		"--background", "--factory-startup",
		"--python", convertPath,
		"--", addonZip, jobsPath, strconv.Itoa(texSize),
	}

	cmd := exec.Command(blenderPath, args...)
	var stdout bytes.Buffer
	if verbose {
		cmd.Stdout = io.MultiWriter(&stdout, os.Stderr)
	} else {
		cmd.Stdout = &stdout
	}
	cmd.Stderr = os.Stderr

	runErr := cmd.Run()
	lines := strings.Split(stdout.String(), "\n")
	return lines, runErr
}

// Generate runs the full pipeline for the given units, writing models/<id>.glb,
// textures/<id>_*.png and models.json under opts.OutDir. It never aborts on a
// single unit's failure; units without a resolvable model are skipped.
func Generate(r Resolver, units []UnitRef, opts Options) (*ModelsIndex, *Stats, error) {
	if opts.TextureSize <= 0 {
		opts.TextureSize = 512
	}
	if opts.BlenderPath == "" {
		opts.BlenderPath = "blender"
	}

	log := func(format string, args ...interface{}) {
		if opts.Verbose {
			fmt.Fprintf(os.Stderr, format+"\n", args...)
		}
	}

	if err := os.MkdirAll(opts.OutDir, 0755); err != nil {
		return nil, nil, fmt.Errorf("failed to create output dir: %w", err)
	}

	workDir, err := os.MkdirTemp("", "pa-pedia-models-")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create work dir: %w", err)
	}
	if opts.KeepWork {
		fmt.Fprintf(os.Stderr, "Keeping work dir: %s\n", workDir)
	} else {
		defer os.RemoveAll(workDir)
	}

	stageRoot := filepath.Join(workDir, "stage")
	jobs, stats := buildJobs(r, units, stageRoot, opts.OutDir, log)

	generated := time.Now().UTC().Format(time.RFC3339)

	if len(jobs) == 0 {
		idx := &ModelsIndex{Generated: generated, UnitCount: 0, Units: map[string]ModelEntry{}}
		if err := writeModelsIndex(opts.OutDir, idx); err != nil {
			return nil, stats, err
		}
		return idx, stats, nil
	}

	// Write jobs.json, convert.py and the addon zip into the work dir.
	jobsPath := filepath.Join(workDir, "jobs.json")
	if err := writeJSONFile(jobsPath, jobs); err != nil {
		return nil, stats, fmt.Errorf("failed to write jobs.json: %w", err)
	}
	convertPath := filepath.Join(workDir, "convert.py")
	if err := os.WriteFile(convertPath, convertPy, 0644); err != nil {
		return nil, stats, fmt.Errorf("failed to write convert.py: %w", err)
	}
	addonZip := filepath.Join(workDir, addonModule+".zip")
	if err := writeAddonZip(addonZip); err != nil {
		return nil, stats, fmt.Errorf("failed to write addon zip: %w", err)
	}

	log("Running Blender on %d unit(s)...", len(jobs))
	lines, runErr := runBlender(opts.BlenderPath, convertPath, addonZip, jobsPath, opts.TextureSize, opts.Verbose)

	idx, failed := assembleIndex(opts.OutDir, lines, generated)
	stats.Converted = len(idx.Units)
	stats.Failed = len(failed)
	for _, id := range failed {
		log("  convert failed: %s", id)
	}

	// A non-zero Blender exit with no results at all is a hard failure; partial
	// results (some units converted) are reported but not fatal.
	if runErr != nil && stats.Converted == 0 {
		return idx, stats, fmt.Errorf("blender produced no models (exit: %w)", runErr)
	}

	if err := writeModelsIndex(opts.OutDir, idx); err != nil {
		return idx, stats, err
	}
	return idx, stats, nil
}

func writeModelsIndex(outDir string, idx *ModelsIndex) error {
	return writeJSONFile(filepath.Join(outDir, "models.json"), idx)
}

func writeJSONFile(pathname string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(pathname, data, 0644)
}
