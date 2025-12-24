package parser

import (
	"math"
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// TestParseEconomyResetsCalculatedValues verifies that parseEconomy resets
// calculated values before recalculating, preventing double-counting when
// units inherit from base_spec chains.
//
// This tests the fix for a bug where commanders like imperial_able (which
// inherits from imperial_base which inherits from base_commander) would
// show 3x the actual build arm consumption because parseEconomy was called
// at each inheritance level and values accumulated.
func TestParseEconomyResetsCalculatedValues(t *testing.T) {
	// Simulate a unit that has already had economy calculated (as if inherited)
	// with pre-existing calculated values that should be reset
	unit := &models.Unit{
		Specs: models.UnitSpecs{
			Economy: &models.EconomySpecs{
				// Simulate inherited calculated values (as if from parent unit)
				ToolConsumption: models.Resources{
					Metal:  30, // Already calculated from parent
					Energy: 1750,
				},
				WeaponConsumption: models.Resources{
					Energy: 100,
				},
				BuildRate:         30,
				MetalRate:         -10,
				EnergyRate:        -1850,
				BuildInefficiency: 58.33,
				// Inherited raw values
				Production: models.Resources{
					Metal:  20,
					Energy: 2000,
				},
				// Inherited build arms that should be recalculated
				BuildArms: []models.BuildArm{
					{
						Name:              "commander_build_arm",
						MetalConsumption:  30,
						EnergyConsumption: 1750,
						Count:             1,
					},
				},
			},
			Combat: &models.CombatSpecs{
				Weapons: []models.Weapon{
					{
						Name:       "uber_cannon",
						EnergyRate: -2500, // Weapon with energy consumption (stored as negative)
						Count:      1,
					},
				},
			},
		},
	}

	// Empty data map - simulates a child unit that doesn't override economy
	data := make(map[string]interface{})

	// Call parseEconomy - this should reset and recalculate, not accumulate
	parseEconomy(data, unit)

	// Verify tool consumption is calculated once (not doubled)
	if unit.Specs.Economy.ToolConsumption.Metal != 30 {
		t.Errorf("ToolConsumption.Metal = %.2f, want 30 (was doubled to 60 before fix)",
			unit.Specs.Economy.ToolConsumption.Metal)
	}
	if unit.Specs.Economy.ToolConsumption.Energy != 1750 {
		t.Errorf("ToolConsumption.Energy = %.2f, want 1750",
			unit.Specs.Economy.ToolConsumption.Energy)
	}

	// Verify build rate is calculated once
	if unit.Specs.Economy.BuildRate != 30 {
		t.Errorf("BuildRate = %.2f, want 30 (was doubled to 60 before fix)",
			unit.Specs.Economy.BuildRate)
	}

	// Verify weapon consumption is calculated once
	// Note: WeaponConsumption is stored as positive (the -= with negative EnergyRate makes it positive)
	if unit.Specs.Economy.WeaponConsumption.Energy != 2500 {
		t.Errorf("WeaponConsumption.Energy = %.2f, want 2500",
			unit.Specs.Economy.WeaponConsumption.Energy)
	}

	// Verify net rates are correct
	// MetalRate = Production.Metal - Consumption.Metal - ToolConsumption.Metal - WeaponConsumption.Metal
	// = 20 - 0 - 30 - 0 = -10
	if unit.Specs.Economy.MetalRate != -10 {
		t.Errorf("MetalRate = %.2f, want -10", unit.Specs.Economy.MetalRate)
	}

	// EnergyRate = Production.Energy - Consumption.Energy - ToolConsumption.Energy - WeaponConsumption.Energy
	// = 2000 - 0 - 1750 - 2500 = -2250
	if unit.Specs.Economy.EnergyRate != -2250 {
		t.Errorf("EnergyRate = %.2f, want -2250", unit.Specs.Economy.EnergyRate)
	}
}

// TestParseEconomyMultipleBuildArms verifies correct calculation with multiple build arms
func TestParseEconomyMultipleBuildArms(t *testing.T) {
	unit := &models.Unit{
		Specs: models.UnitSpecs{
			Economy: &models.EconomySpecs{
				BuildArms: []models.BuildArm{
					{
						Name:              "build_arm_1",
						MetalConsumption:  30,
						EnergyConsumption: 1000,
						Count:             1,
					},
					{
						Name:              "build_arm_2",
						MetalConsumption:  15,
						EnergyConsumption: 500,
						Count:             1,
					},
				},
			},
			Combat: &models.CombatSpecs{},
		},
	}

	data := make(map[string]interface{})
	parseEconomy(data, unit)

	// Total: 30 + 15 = 45 metal (each arm entry adds its consumption once)
	expectedMetal := 45.0
	if math.Abs(unit.Specs.Economy.ToolConsumption.Metal-expectedMetal) > 0.01 {
		t.Errorf("ToolConsumption.Metal = %.2f, want %.2f",
			unit.Specs.Economy.ToolConsumption.Metal, expectedMetal)
	}

	// Total: 1000 + 500 = 1500 energy
	expectedEnergy := 1500.0
	if math.Abs(unit.Specs.Economy.ToolConsumption.Energy-expectedEnergy) > 0.01 {
		t.Errorf("ToolConsumption.Energy = %.2f, want %.2f",
			unit.Specs.Economy.ToolConsumption.Energy, expectedEnergy)
	}

	// Build rate should equal metal consumption
	if math.Abs(unit.Specs.Economy.BuildRate-expectedMetal) > 0.01 {
		t.Errorf("BuildRate = %.2f, want %.2f",
			unit.Specs.Economy.BuildRate, expectedMetal)
	}
}

// TestParseEconomyBuildInefficiency verifies build inefficiency calculation
func TestParseEconomyBuildInefficiency(t *testing.T) {
	tests := []struct {
		name                   string
		metalConsumption       float64
		energyConsumption      float64
		expectedInefficiency   float64
	}{
		{
			name:                 "Standard commander build arm",
			metalConsumption:     30,
			energyConsumption:    1750,
			expectedInefficiency: 58.33, // 1750/30 ≈ 58.33
		},
		{
			name:                 "Efficient fabricator",
			metalConsumption:     20,
			energyConsumption:    400,
			expectedInefficiency: 20.0, // 400/20 = 20
		},
		{
			name:                 "No build arm",
			metalConsumption:     0,
			energyConsumption:    0,
			expectedInefficiency: 0, // Avoid division by zero
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unit := &models.Unit{
				Specs: models.UnitSpecs{
					Economy: &models.EconomySpecs{},
					Combat:  &models.CombatSpecs{},
				},
			}

			if tt.metalConsumption > 0 {
				unit.Specs.Economy.BuildArms = []models.BuildArm{
					{
						MetalConsumption:  tt.metalConsumption,
						EnergyConsumption: tt.energyConsumption,
						Count:             1,
					},
				}
			}

			data := make(map[string]interface{})
			parseEconomy(data, unit)

			if math.Abs(unit.Specs.Economy.BuildInefficiency-tt.expectedInefficiency) > 0.01 {
				t.Errorf("BuildInefficiency = %.2f, want %.2f",
					unit.Specs.Economy.BuildInefficiency, tt.expectedInefficiency)
			}
		})
	}
}
