package models3d

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

// fakeBlender simulates Blender: it reads the jobs.json written by
// runBlenderResilient, emits a RESULT line for each unit in order until it hits
// one in crashOn, and returns a non-nil error if it "crashed". Units listed in
// crashOn crash Blender natively (no RESULT for them, batch aborts there).
func fakeBlender(t *testing.T, crashOn map[string]bool) (blenderRunner, *int) {
	calls := 0
	runner := func(jobsPath string) ([]string, error) {
		calls++
		data, err := os.ReadFile(jobsPath)
		if err != nil {
			t.Fatalf("fakeBlender: read jobs: %v", err)
		}
		var jobs []job
		if err := json.Unmarshal(data, &jobs); err != nil {
			t.Fatalf("fakeBlender: parse jobs: %v", err)
		}
		var lines []string
		for _, j := range jobs {
			if crashOn[j.UnitID] {
				return lines, fmt.Errorf("simulated crash on %s", j.UnitID)
			}
			lines = append(lines, fmt.Sprintf(`RESULT {"unitId":%q,"ok":true,"files":{"glb":"models/%s.glb"}}`, j.UnitID, j.UnitID))
		}
		return lines, nil
	}
	return runner, &calls
}

// alwaysCrash simulates a global failure: every invocation errors with no output.
func alwaysCrash() (blenderRunner, *int) {
	calls := 0
	return func(string) ([]string, error) {
		calls++
		return nil, fmt.Errorf("simulated global blender failure")
	}, &calls
}

func jobsFor(ids ...string) []job {
	js := make([]job, len(ids))
	for i, id := range ids {
		js[i] = job{UnitID: id, Papa: id + ".papa", OutDir: "/out"}
	}
	return js
}

func resultIDs(lines []string) []string {
	ids := make([]string, 0)
	for id := range resultUnitIDs(lines) {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func TestRunBlenderResilient(t *testing.T) {
	noop := func(string, ...interface{}) {}

	t.Run("clean run converts all, no crashes, nil err", func(t *testing.T) {
		run, calls := fakeBlender(t, nil)
		lines, crashed, err := runBlenderResilient(t.TempDir(), jobsFor("a", "b", "c"), run, noop)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if len(crashed) != 0 {
			t.Fatalf("crashed = %v, want none", crashed)
		}
		if got := resultIDs(lines); len(got) != 3 {
			t.Fatalf("converted = %v, want a,b,c", got)
		}
		if *calls != 1 {
			t.Fatalf("blender calls = %d, want 1", *calls)
		}
	})

	t.Run("mid-batch crash is isolated, rest converts", func(t *testing.T) {
		run, calls := fakeBlender(t, map[string]bool{"c": true})
		lines, crashed, err := runBlenderResilient(t.TempDir(), jobsFor("a", "b", "c", "d", "e"), run, noop)
		if err != nil {
			t.Fatalf("err = %v, want nil (crasher isolated, rest ok)", err)
		}
		if len(crashed) != 1 || crashed[0] != "c" {
			t.Fatalf("crashed = %v, want [c]", crashed)
		}
		want := []string{"a", "b", "d", "e"}
		got := resultIDs(lines)
		if fmt.Sprint(got) != fmt.Sprint(want) {
			t.Fatalf("converted = %v, want %v", got, want)
		}
		if *calls != 2 { // first run crashes on c, second run does the rest
			t.Fatalf("blender calls = %d, want 2", *calls)
		}
	})

	t.Run("first-unit crash is isolated", func(t *testing.T) {
		run, _ := fakeBlender(t, map[string]bool{"a": true})
		lines, crashed, err := runBlenderResilient(t.TempDir(), jobsFor("a", "b", "c"), run, noop)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if len(crashed) != 1 || crashed[0] != "a" {
			t.Fatalf("crashed = %v, want [a]", crashed)
		}
		if got := resultIDs(lines); fmt.Sprint(got) != fmt.Sprint([]string{"b", "c"}) {
			t.Fatalf("converted = %v, want [b c]", got)
		}
	})

	t.Run("two adjacent crashers both isolated", func(t *testing.T) {
		run, _ := fakeBlender(t, map[string]bool{"b": true, "c": true})
		lines, crashed, err := runBlenderResilient(t.TempDir(), jobsFor("a", "b", "c", "d"), run, noop)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		sort.Strings(crashed)
		if fmt.Sprint(crashed) != fmt.Sprint([]string{"b", "c"}) {
			t.Fatalf("crashed = %v, want [b c]", crashed)
		}
		if got := resultIDs(lines); fmt.Sprint(got) != fmt.Sprint([]string{"a", "d"}) {
			t.Fatalf("converted = %v, want [a d]", got)
		}
	})

	t.Run("global failure surfaces error, does not walk whole batch", func(t *testing.T) {
		run, calls := alwaysCrash()
		_, crashed, err := runBlenderResilient(t.TempDir(), jobsFor("a", "b", "c", "d", "e", "f"), run, noop)
		if err == nil {
			t.Fatal("err = nil, want a surfaced global failure")
		}
		// Aborts after the 2nd consecutive no-progress crash rather than
		// isolating all 6 units one at a time.
		if *calls > 2 {
			t.Fatalf("blender calls = %d, want <= 2 (abort on global failure)", *calls)
		}
		if len(crashed) >= 6 {
			t.Fatalf("crashed = %d units, should not have walked the whole batch", len(crashed))
		}
	})
}

func TestModelPapaPath(t *testing.T) {
	tests := []struct {
		name   string
		unit   map[string]interface{}
		want   string
		wantOK bool
	}{
		{
			name: "model array with a papa filename",
			unit: map[string]interface{}{
				"model": []interface{}{
					map[string]interface{}{"filename": "/pa/units/land/radar/radar.papa"},
				},
			},
			want:   "/pa/units/land/radar/radar.papa",
			wantOK: true,
		},
		{
			name: "model as a single object",
			unit: map[string]interface{}{
				"model": map[string]interface{}{"filename": "/pa/units/land/tank/tank.papa"},
			},
			want:   "/pa/units/land/tank/tank.papa",
			wantOK: true,
		},
		{
			name: "first papa wins across multiple entries",
			unit: map[string]interface{}{
				"model": []interface{}{
					map[string]interface{}{"layer": "WL_LandHorizontal"},
					map[string]interface{}{"filename": "/pa/units/land/x/x.papa"},
					map[string]interface{}{"filename": "/pa/units/land/y/y.papa"},
				},
			},
			want:   "/pa/units/land/x/x.papa",
			wantOK: true,
		},
		{
			name:   "no model field",
			unit:   map[string]interface{}{"display_name": "Radar"},
			wantOK: false,
		},
		{
			name: "model without a papa filename",
			unit: map[string]interface{}{
				"model": []interface{}{
					map[string]interface{}{"filename": "/pa/units/land/radar/radar_anim.json"},
				},
			},
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := modelPapaPath(tt.unit)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Fatalf("path = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTexturePapaPaths(t *testing.T) {
	got := texturePapaPaths("/pa/units/land/radar/radar.papa")
	want := map[string]string{
		"diffuse":  "/pa/units/land/radar/radar_diffuse.papa",
		"mask":     "/pa/units/land/radar/radar_mask.papa",
		"material": "/pa/units/land/radar/radar_material.papa",
	}
	for tag, w := range want {
		if got[tag] != w {
			t.Errorf("tag %q = %q, want %q", tag, got[tag], w)
		}
	}
}

func TestBaseNoExt(t *testing.T) {
	cases := map[string]string{
		"/pa/units/land/radar/radar.papa": "radar",
		"tank.papa":                       "tank",
		"/a/b/no_ext":                     "no_ext",
	}
	for in, want := range cases {
		if got := baseNoExt(in); got != want {
			t.Errorf("baseNoExt(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAssembleIndex(t *testing.T) {
	outDir := t.TempDir()
	// Create a real glb file so its size is recorded.
	glbRel := "models/radar.glb"
	if err := os.MkdirAll(filepath.Join(outDir, "models"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outDir, filepath.FromSlash(glbRel)), []byte("GLB!"), 0o644); err != nil {
		t.Fatal(err)
	}

	lines := []string{
		"some unrelated blender log line",
		`RESULT {"unitId":"radar","ok":true,"files":{"glb":"models/radar.glb","diffuse":"textures/radar_diffuse.png","mask":"textures/radar_mask.png"}}`,
		// Failed unit: must be reported and excluded.
		`RESULT {"unitId":"broken","ok":false,"error":"import failed"}`,
		// OK but no glb: treated as failed (skip-on-missing).
		`RESULT {"unitId":"noglb","ok":true,"files":{"diffuse":"textures/x.png"}}`,
		"RESULT not-json-should-be-ignored",
	}

	idx, failed := assembleIndex(outDir, lines, "2026-07-11T00:00:00Z")

	if idx.UnitCount != 1 {
		t.Fatalf("UnitCount = %d, want 1", idx.UnitCount)
	}
	entry, ok := idx.Units["radar"]
	if !ok {
		t.Fatal("expected radar in index")
	}
	if entry.Glb != glbRel {
		t.Errorf("glb = %q, want %q", entry.Glb, glbRel)
	}
	if entry.Sizes["glb"] != int64(len("GLB!")) {
		t.Errorf("glb size = %d, want %d", entry.Sizes["glb"], len("GLB!"))
	}
	if _, present := idx.Units["broken"]; present {
		t.Error("failed unit 'broken' should not be in index")
	}
	if _, present := idx.Units["noglb"]; present {
		t.Error("unit without glb should not be in index")
	}

	// Both broken and noglb should be reported as failed.
	wantFailed := map[string]bool{"broken": true, "noglb": true}
	if len(failed) != len(wantFailed) {
		t.Fatalf("failed = %v, want keys %v", failed, wantFailed)
	}
	for _, f := range failed {
		if !wantFailed[f] {
			t.Errorf("unexpected failed unit %q", f)
		}
	}
}
