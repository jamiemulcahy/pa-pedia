package models3d

import (
	"os"
	"path/filepath"
	"testing"
)

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
