package integration_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestFixturesExist verifies all expected testdata fixture files are present.
// This catches accidental deletions or missing files early.
func TestFixturesExist(t *testing.T) {
	td := testdataDir(t)

	// Base game fixtures
	baseGameFiles := []string{
		"pa_root/pa/units/unit_list.json",
		"pa_root/pa/units/commanders/test_commander/test_commander.json",
		"pa_root/pa/units/commanders/test_commander/test_commander_tool_weapon.json",
		"pa_root/pa/units/commanders/test_commander/test_commander_ammo.json",
		"pa_root/pa/units/commanders/test_commander/test_commander_build_arm.json",
		"pa_root/pa/units/land/base_bot/base_bot.json",
		"pa_root/pa/units/land/test_tank/test_tank.json",
		"pa_root/pa/units/land/test_tank/test_tank_tool_weapon.json",
		"pa_root/pa/units/land/test_tank/test_tank_ammo.json",
		"pa_root/pa/units/land/test_factory/test_factory.json",
		"pa_root/pa/units/land/test_factory/test_factory_build_arm.json",
		"pa_root/pa/units/land/test_mex/test_mex.json",
		"pa_root/pa/units/air/test_fighter/test_fighter.json",
		"pa_root/pa/units/air/test_fighter/test_fighter_tool_weapon.json",
		"pa_root/pa/units/air/test_fighter/test_fighter_ammo.json",
	}

	// Expansion fixtures
	expansionFiles := []string{
		"pa_root/pa_ex1/units/unit_list.json",
		"pa_root/pa_ex1/units/land/test_tank/test_tank.json",
	}

	// Mod faction fixtures
	modFiles := []string{
		"data_root/server_mods/com.test.mod/modinfo.json",
		"data_root/server_mods/com.test.mod/pa/units/unit_list.json",
		"data_root/server_mods/com.test.mod/pa/units/commanders/mod_commander/mod_commander.json",
		"data_root/server_mods/com.test.mod/pa/units/commanders/mod_commander/mod_commander_tool_weapon.json",
		"data_root/server_mods/com.test.mod/pa/units/commanders/mod_commander/mod_commander_ammo.json",
		"data_root/server_mods/com.test.mod/pa/units/commanders/mod_commander/mod_commander_build_arm.json",
		"data_root/server_mods/com.test.mod/pa/units/land/mod_tank/mod_tank.json",
		"data_root/server_mods/com.test.mod/pa/units/land/mod_tank/mod_tank_tool_weapon.json",
		"data_root/server_mods/com.test.mod/pa/units/land/mod_tank/mod_tank_ammo.json",
		"data_root/server_mods/com.test.mod/pa/units/land/mod_factory/mod_factory.json",
		"data_root/server_mods/com.test.mod/pa/units/land/mod_factory/mod_factory_build_arm.json",
		"data_root/server_mods/com.test.mod/pa/units/land/test_tank/test_tank.json",
	}

	// Addon mod fixtures
	addonFiles := []string{
		"data_root/server_mods/com.test.addon/modinfo.json",
		"data_root/server_mods/com.test.addon/pa/units/unit_list.json",
		"data_root/server_mods/com.test.addon/pa/units/commanders/test_commander/test_commander.json",
		"data_root/server_mods/com.test.addon/pa/units/land/test_tank/test_tank.json",
		"data_root/server_mods/com.test.addon/pa/units/land/addon_artillery/addon_artillery.json",
		"data_root/server_mods/com.test.addon/pa/units/land/addon_artillery/addon_artillery_tool_weapon.json",
		"data_root/server_mods/com.test.addon/pa/units/land/addon_artillery/addon_artillery_ammo.json",
		"data_root/server_mods/com.test.addon/pa/units/land/addon_turret/addon_turret.json",
	}

	// Profile fixtures
	profileFiles := []string{
		"profiles/test-base.json",
		"profiles/test-mod.json",
		"profiles/test-addon.json",
		"profiles-invalid/invalid-no-name.json",
	}

	allFiles := make([]string, 0)
	allFiles = append(allFiles, baseGameFiles...)
	allFiles = append(allFiles, expansionFiles...)
	allFiles = append(allFiles, modFiles...)
	allFiles = append(allFiles, addonFiles...)
	allFiles = append(allFiles, profileFiles...)

	for _, file := range allFiles {
		path := filepath.Join(td, file)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Errorf("missing fixture file: %s", file)
		}
	}
}

// TestFixturesValidJSON verifies all JSON fixture files are valid JSON.
func TestFixturesValidJSON(t *testing.T) {
	td := testdataDir(t)

	jsonFiles := []string{
		"pa_root/pa/units/unit_list.json",
		"pa_root/pa/units/commanders/test_commander/test_commander.json",
		"pa_root/pa/units/commanders/test_commander/test_commander_tool_weapon.json",
		"pa_root/pa/units/commanders/test_commander/test_commander_ammo.json",
		"pa_root/pa/units/commanders/test_commander/test_commander_build_arm.json",
		"pa_root/pa/units/land/base_bot/base_bot.json",
		"pa_root/pa/units/land/test_tank/test_tank.json",
		"pa_root/pa/units/land/test_tank/test_tank_tool_weapon.json",
		"pa_root/pa/units/land/test_tank/test_tank_ammo.json",
		"pa_root/pa/units/land/test_factory/test_factory.json",
		"pa_root/pa/units/land/test_factory/test_factory_build_arm.json",
		"pa_root/pa/units/land/test_mex/test_mex.json",
		"pa_root/pa/units/air/test_fighter/test_fighter.json",
		"pa_root/pa/units/air/test_fighter/test_fighter_tool_weapon.json",
		"pa_root/pa/units/air/test_fighter/test_fighter_ammo.json",
		"pa_root/pa_ex1/units/unit_list.json",
		"pa_root/pa_ex1/units/land/test_tank/test_tank.json",
		"data_root/server_mods/com.test.mod/modinfo.json",
		"data_root/server_mods/com.test.mod/pa/units/unit_list.json",
		"data_root/server_mods/com.test.addon/modinfo.json",
		"data_root/server_mods/com.test.addon/pa/units/unit_list.json",
		"profiles/test-base.json",
		"profiles/test-mod.json",
		"profiles/test-addon.json",
		"profiles-invalid/invalid-no-name.json",
	}

	for _, file := range jsonFiles {
		path := filepath.Join(td, file)
		data, err := os.ReadFile(path)
		if err != nil {
			t.Errorf("failed to read %s: %v", file, err)
			continue
		}
		var v interface{}
		if err := json.Unmarshal(data, &v); err != nil {
			t.Errorf("invalid JSON in %s: %v", file, err)
		}
	}
}

// TestIconFixtureGeneration verifies that icon PNG files can be generated.
func TestIconFixtureGeneration(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test_icon.png")
	createMinimalPNG(t, path)
	assertFileExists(t, path)

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("failed to stat icon: %v", err)
	}
	if info.Size() == 0 {
		t.Error("icon PNG file is empty")
	}
}
