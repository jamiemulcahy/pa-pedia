package integration_test

import (
	"math"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/loader"
	"github.com/jamiemulcahy/pa-pedia/pkg/models"
	"github.com/jamiemulcahy/pa-pedia/pkg/parser"
)

// approxEqual checks if two floats are approximately equal within an epsilon.
func approxEqual(a, b, epsilon float64) bool {
	return math.Abs(a-b) < epsilon
}

// TestWeaponParsing tests that weapons are parsed correctly with DPS calculations.
func TestWeaponParsing(t *testing.T) {
	paRoot := paRootPath(t)

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestBase", false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	// Test tank weapon: ROF=1.5, damage=50, DPS=75
	tank := db.Units["test_tank"]
	if tank == nil {
		t.Fatal("test_tank not found")
	}

	if len(tank.Specs.Combat.Weapons) == 0 {
		t.Fatal("test_tank should have at least 1 weapon")
	}

	weapon := tank.Specs.Combat.Weapons[0]
	if weapon.ROF != 1.5 {
		t.Errorf("tank weapon ROF = %v, want 1.5", weapon.ROF)
	}
	if weapon.Damage != 50 {
		t.Errorf("tank weapon damage = %v, want 50", weapon.Damage)
	}
	expectedDPS := 1.5 * 50 * 1 // ROF * damage * projectilesPerFire
	if !approxEqual(weapon.DPS, expectedDPS, 0.01) {
		t.Errorf("tank weapon DPS = %v, want %v", weapon.DPS, expectedDPS)
	}
	if weapon.MaxRange != 80 {
		t.Errorf("tank weapon max range = %v, want 80", weapon.MaxRange)
	}

	// Tank unit-level DPS should match
	if !approxEqual(tank.Specs.Combat.DPS, expectedDPS, 0.01) {
		t.Errorf("tank DPS = %v, want %v", tank.Specs.Combat.DPS, expectedDPS)
	}

	// Test commander weapon: ROF=2.0, damage=75, DPS=150
	commander := db.Units["test_commander"]
	if commander == nil {
		t.Fatal("test_commander not found")
	}

	// Commander has weapon + build arm. Find the weapon.
	var cmdWeapon *models.Weapon
	for i := range commander.Specs.Combat.Weapons {
		if !commander.Specs.Combat.Weapons[i].DeathExplosion && !commander.Specs.Combat.Weapons[i].SelfDestruct {
			w := commander.Specs.Combat.Weapons[i]
			cmdWeapon = &w
			break
		}
	}
	if cmdWeapon == nil {
		t.Fatal("commander should have at least 1 non-death weapon")
	}
	expectedCmdDPS := 2.0 * 75 * 1
	if !approxEqual(cmdWeapon.DPS, expectedCmdDPS, 0.01) {
		t.Errorf("commander weapon DPS = %v, want %v", cmdWeapon.DPS, expectedCmdDPS)
	}

	// Test fighter weapon: ROF=5.0, damage=15, DPS=75
	fighter := db.Units["test_fighter"]
	if fighter == nil {
		t.Fatal("test_fighter not found")
	}
	if len(fighter.Specs.Combat.Weapons) == 0 {
		t.Fatal("test_fighter should have at least 1 weapon")
	}
	expectedFighterDPS := 5.0 * 15 * 1
	if !approxEqual(fighter.Specs.Combat.DPS, expectedFighterDPS, 0.01) {
		t.Errorf("fighter DPS = %v, want %v", fighter.Specs.Combat.DPS, expectedFighterDPS)
	}

	// Ammo details should be populated
	if weapon.Ammo == nil {
		t.Error("tank weapon should have ammo details")
	} else {
		if weapon.Ammo.MuzzleVelocity != 120 {
			t.Errorf("tank ammo muzzle velocity = %v, want 120", weapon.Ammo.MuzzleVelocity)
		}
	}
}

// TestEconomyCalculations tests production, consumption, and net rate calculations.
func TestEconomyCalculations(t *testing.T) {
	paRoot := paRootPath(t)

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestBase", false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	// Metal extractor: produces 7 metal, consumes 5 energy
	mex := db.Units["test_mex"]
	if mex == nil {
		t.Fatal("test_mex not found")
	}

	if mex.Specs.Economy.Production.Metal != 7 {
		t.Errorf("mex metal production = %v, want 7", mex.Specs.Economy.Production.Metal)
	}
	if mex.Specs.Economy.Consumption.Energy != 5 {
		t.Errorf("mex energy consumption = %v, want 5", mex.Specs.Economy.Consumption.Energy)
	}
	// Net metal rate = 7 (production) - 0 (consumption) - 0 (tools) - 0 (weapons) = 7
	if !approxEqual(mex.Specs.Economy.MetalRate, 7, 0.01) {
		t.Errorf("mex metal rate = %v, want 7", mex.Specs.Economy.MetalRate)
	}
	// Net energy rate = 0 (production) - 5 (consumption) - 0 (tools) - 0 (weapons) = -5
	if !approxEqual(mex.Specs.Economy.EnergyRate, -5, 0.01) {
		t.Errorf("mex energy rate = %v, want -5", mex.Specs.Economy.EnergyRate)
	}

	if mex.Specs.Economy.BuildCost != 200 {
		t.Errorf("mex build cost = %v, want 200", mex.Specs.Economy.BuildCost)
	}
}

// TestBuildArmParsing tests build arm stats and build inefficiency calculations.
func TestBuildArmParsing(t *testing.T) {
	paRoot := paRootPath(t)

	l, err := loader.NewMultiSourceLoader(paRoot, "pa_ex1", nil)
	if err != nil {
		t.Fatalf("failed to create loader: %v", err)
	}
	defer l.Close()

	db := parser.NewDatabase(l)
	if err := db.LoadUnits(false, "TestBase", false); err != nil {
		t.Fatalf("failed to load units: %v", err)
	}

	// Factory build arm: metal=20, energy=30, range=40
	factory := db.Units["test_factory"]
	if factory == nil {
		t.Fatal("test_factory not found")
	}

	if len(factory.Specs.Economy.BuildArms) == 0 {
		t.Fatal("test_factory should have at least 1 build arm")
	}

	arm := factory.Specs.Economy.BuildArms[0]
	if arm.MetalConsumption != 20 {
		t.Errorf("factory build arm metal = %v, want 20", arm.MetalConsumption)
	}
	if arm.EnergyConsumption != 30 {
		t.Errorf("factory build arm energy = %v, want 30", arm.EnergyConsumption)
	}
	if arm.Range != 40 {
		t.Errorf("factory build arm range = %v, want 40", arm.Range)
	}

	// Build rate = sum of metal consumption from build arms
	if !approxEqual(factory.Specs.Economy.BuildRate, 20, 0.01) {
		t.Errorf("factory build rate = %v, want 20", factory.Specs.Economy.BuildRate)
	}

	// Build inefficiency = energy / metal = 30 / 20 = 1.5
	if !approxEqual(factory.Specs.Economy.BuildInefficiency, 1.5, 0.01) {
		t.Errorf("factory build inefficiency = %v, want 1.5", factory.Specs.Economy.BuildInefficiency)
	}

	// Tool consumption
	if !approxEqual(factory.Specs.Economy.ToolConsumption.Metal, 20, 0.01) {
		t.Errorf("factory tool consumption metal = %v, want 20", factory.Specs.Economy.ToolConsumption.Metal)
	}
	if !approxEqual(factory.Specs.Economy.ToolConsumption.Energy, 30, 0.01) {
		t.Errorf("factory tool consumption energy = %v, want 30", factory.Specs.Economy.ToolConsumption.Energy)
	}

	// Commander build arm: metal=15, energy=22.5, range=60
	commander := db.Units["test_commander"]
	if commander == nil {
		t.Fatal("test_commander not found")
	}

	if len(commander.Specs.Economy.BuildArms) == 0 {
		t.Fatal("test_commander should have at least 1 build arm")
	}

	cmdArm := commander.Specs.Economy.BuildArms[0]
	if cmdArm.MetalConsumption != 15 {
		t.Errorf("commander build arm metal = %v, want 15", cmdArm.MetalConsumption)
	}
	if cmdArm.EnergyConsumption != 22.5 {
		t.Errorf("commander build arm energy = %v, want 22.5", cmdArm.EnergyConsumption)
	}

	// Commander build inefficiency = 22.5 / 15 = 1.5
	if !approxEqual(commander.Specs.Economy.BuildInefficiency, 1.5, 0.01) {
		t.Errorf("commander build inefficiency = %v, want 1.5", commander.Specs.Economy.BuildInefficiency)
	}
}
