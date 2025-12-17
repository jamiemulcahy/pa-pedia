package parser

import (
	"math"
	"testing"
)

// TestCalculateDPS tests DPS calculation logic
func TestCalculateDPS(t *testing.T) {
	tests := []struct {
		name               string
		rateOfFire         float64
		damage             float64
		projectilesPerFire int
		count              int
		expectedDPS        float64
	}{
		{
			name:               "Single weapon, single projectile",
			rateOfFire:         1.0, // 1 shot per second
			damage:             10.0,
			projectilesPerFire: 1,
			count:              1,
			expectedDPS:        10.0, // 1 * 10 * 1 * 1 = 10
		},
		{
			name:               "High ROF weapon",
			rateOfFire:         10.0, // 10 shots per second
			damage:             5.0,
			projectilesPerFire: 1,
			count:              1,
			expectedDPS:        50.0, // 10 * 5 * 1 * 1 = 50
		},
		{
			name:               "Shotgun (multiple projectiles)",
			rateOfFire:         1.0,
			damage:             10.0,
			projectilesPerFire: 5, // 5 pellets per shot
			count:              1,
			expectedDPS:        50.0, // 1 * 10 * 5 * 1 = 50
		},
		{
			name:               "Dual weapons",
			rateOfFire:         2.0,
			damage:             20.0,
			projectilesPerFire: 1,
			count:              2, // 2 identical weapons
			expectedDPS:        80.0, // 2 * 20 * 1 * 2 = 80
		},
		{
			name:               "Complex: dual shotguns with high ROF",
			rateOfFire:         5.0,  // 5 shots per second
			damage:             8.0,   // 8 damage per pellet
			projectilesPerFire: 3,    // 3 pellets per shot
			count:              2,    // 2 weapons
			expectedDPS:        240.0, // 5 * 8 * 3 * 2 = 240
		},
		{
			name:               "Zero damage weapon",
			rateOfFire:         1.0,
			damage:             0.0,
			projectilesPerFire: 1,
			count:              1,
			expectedDPS:        0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// DPS = ROF × Damage × ProjectilesPerFire × Count
			calculatedDPS := tt.rateOfFire * tt.damage * float64(tt.projectilesPerFire) * float64(tt.count)

			if math.Abs(calculatedDPS-tt.expectedDPS) > 0.001 {
				t.Errorf("DPS calculation = %.2f, want %.2f", calculatedDPS, tt.expectedDPS)
			}
		})
	}
}

// TestWeaponResourceConsumption tests resource consumption calculations
func TestWeaponResourceConsumption(t *testing.T) {
	tests := []struct {
		name               string
		rateOfFire         float64
		energyPerShot      float64
		metalPerShot       float64
		count              int
		expectedEnergyRate float64
		expectedMetalRate  float64
	}{
		{
			name:               "Energy weapon",
			rateOfFire:         2.0, // 2 shots per second
			energyPerShot:      50.0,
			metalPerShot:       0.0,
			count:              1,
			expectedEnergyRate: 100.0, // 2 * 50 = 100 energy/sec
			expectedMetalRate:  0.0,
		},
		{
			name:               "Metal consuming weapon",
			rateOfFire:         1.0,
			energyPerShot:      0.0,
			metalPerShot:       10.0,
			count:              1,
			expectedEnergyRate: 0.0,
			expectedMetalRate:  10.0, // 1 * 10 = 10 metal/sec
		},
		{
			name:               "Hybrid consumption",
			rateOfFire:         5.0,
			energyPerShot:      20.0,
			metalPerShot:       5.0,
			count:              1,
			expectedEnergyRate: 100.0, // 5 * 20 = 100
			expectedMetalRate:  25.0,  // 5 * 5 = 25
		},
		{
			name:               "Dual weapons consuming resources",
			rateOfFire:         3.0,
			energyPerShot:      30.0,
			metalPerShot:       0.0,
			count:              2,
			expectedEnergyRate: 180.0, // 3 * 30 * 2 = 180
			expectedMetalRate:  0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Resource rate = ROF × ResourcePerShot × Count
			energyRate := tt.rateOfFire * tt.energyPerShot * float64(tt.count)
			metalRate := tt.rateOfFire * tt.metalPerShot * float64(tt.count)

			if math.Abs(energyRate-tt.expectedEnergyRate) > 0.001 {
				t.Errorf("Energy rate = %.2f, want %.2f", energyRate, tt.expectedEnergyRate)
			}
			if math.Abs(metalRate-tt.expectedMetalRate) > 0.001 {
				t.Errorf("Metal rate = %.2f, want %.2f", metalRate, tt.expectedMetalRate)
			}
		})
	}
}

// TestAmmoSystemCalculations tests ammo capacity and drain time calculations
func TestAmmoSystemCalculations(t *testing.T) {
	tests := []struct {
		name             string
		ammoCapacity     float64
		ammoPerShot      float64
		rateOfFire       float64
		expectedShots    int
		expectedDrainSec float64
	}{
		{
			name:             "100 ammo, 10 per shot, 1 shot/sec",
			ammoCapacity:     100.0,
			ammoPerShot:      10.0,
			rateOfFire:       1.0,
			expectedShots:    10,     // 100 / 10 = 10 shots
			expectedDrainSec: 10.0,   // 10 shots / 1 shot/sec = 10 sec
		},
		{
			name:             "Energy weapon: 1000 energy, 50 per shot, 2 shots/sec",
			ammoCapacity:     1000.0,
			ammoPerShot:      50.0,
			rateOfFire:       2.0,
			expectedShots:    20,    // 1000 / 50 = 20 shots
			expectedDrainSec: 10.0,  // 20 shots / 2 shots/sec = 10 sec
		},
		{
			name:             "Rapid fire: 500 ammo, 5 per shot, 10 shots/sec",
			ammoCapacity:     500.0,
			ammoPerShot:      5.0,
			rateOfFire:       10.0,
			expectedShots:    100,   // 500 / 5 = 100 shots
			expectedDrainSec: 10.0,  // 100 shots / 10 shots/sec = 10 sec
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Calculate shots to drain
			shots := int(tt.ammoCapacity / tt.ammoPerShot)
			if shots != tt.expectedShots {
				t.Errorf("Shots to drain = %d, want %d", shots, tt.expectedShots)
			}

			// Calculate drain time
			drainTime := float64(shots) / tt.rateOfFire
			if math.Abs(drainTime-tt.expectedDrainSec) > 0.001 {
				t.Errorf("Drain time = %.2f sec, want %.2f sec", drainTime, tt.expectedDrainSec)
			}
		})
	}
}

// TestAmmoSystemWithRecovery tests the discrete simulation of ammo drain with recovery
func TestAmmoSystemWithRecovery(t *testing.T) {
	tests := []struct {
		name               string
		ammoCapacity       float64
		ammoPerShot        float64
		ammoDemand         float64 // recovery rate
		rateOfFire         float64
		damage             float64
		expectedShots      int
		expectedDrainTime  float64
		expectedSustDPS    float64
	}{
		{
			name:              "Icarus (Solar Drone) - Issue #132/#133 example",
			ammoCapacity:      1500.0,
			ammoPerShot:       300.0,
			ammoDemand:        100.0, // 100/s recovery
			rateOfFire:        1.0,
			damage:            25.0,
			expectedShots:     7,    // Discrete simulation gives 7 shots
			expectedDrainTime: 6.0,  // Fires at t=0,1,2,3,4,5,6 = 6 seconds elapsed
			expectedSustDPS:   8.33, // (100/300) * 25 = 8.33
		},
		{
			name:              "Fast recovery - no drain (sustain indefinitely)",
			ammoCapacity:      100.0,
			ammoPerShot:       10.0,
			ammoDemand:        20.0, // Recovery faster than consumption
			rateOfFire:        1.0,  // 10/s consumption < 20/s recovery
			damage:            50.0,
			expectedShots:     0,    // No drain (can sustain)
			expectedDrainTime: 0.0,
			expectedSustDPS:   100.0, // (20/10) * 50 = 100
		},
		{
			name:              "High ROF with slow recovery",
			ammoCapacity:      200.0,
			ammoPerShot:       20.0,
			ammoDemand:        10.0, // 10/s recovery
			rateOfFire:        5.0,  // 100/s consumption >> 10/s recovery
			damage:            30.0,
			expectedShots:     11,   // Discrete simulation
			expectedDrainTime: 2.0,  // 11 shots, 10 intervals at 0.2s = 2 seconds elapsed
			expectedSustDPS:   15.0, // (10/20) * 30 = 15
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the discrete drain calculation
			consumptionRate := tt.ammoPerShot * tt.rateOfFire
			var shots int
			var drainTime float64

			if consumptionRate > tt.ammoDemand {
				// Weapon drains faster than it recovers - simulate discrete shots
				ammo := tt.ammoCapacity
				shotInterval := 1.0 / tt.rateOfFire
				recoveryPerInterval := tt.ammoDemand * shotInterval

				for ammo >= tt.ammoPerShot {
					ammo -= tt.ammoPerShot // Fire shot
					shots++
					ammo += recoveryPerInterval // Recovery before next shot
				}

				if shots > 1 {
					// Drain time = (shots - 1) / ROF (elapsed time from first to last shot)
					drainTime = math.Round(float64(shots-1)/tt.rateOfFire*100) / 100
				}
			}

			if shots != tt.expectedShots {
				t.Errorf("Shots to drain = %d, want %d", shots, tt.expectedShots)
			}
			if math.Abs(drainTime-tt.expectedDrainTime) > 0.01 {
				t.Errorf("Drain time = %.2f sec, want %.2f sec", drainTime, tt.expectedDrainTime)
			}

			// Test sustained DPS calculation
			if tt.ammoDemand > 0 && tt.ammoPerShot > 0 {
				sustainedROF := tt.ammoDemand / tt.ammoPerShot
				sustainedDPS := math.Round(sustainedROF*tt.damage*100) / 100
				if math.Abs(sustainedDPS-tt.expectedSustDPS) > 0.01 {
					t.Errorf("Sustained DPS = %.2f, want %.2f", sustainedDPS, tt.expectedSustDPS)
				}
			}
		})
	}
}

// TestSplashDamageCalculations tests splash/AoE damage calculations
func TestSplashDamageCalculations(t *testing.T) {
	// This is more of a documentation test for splash damage mechanics
	tests := []struct {
		name             string
		directDamage     float64
		splashDamage     float64
		splashRadius     float64
		fullDamageRadius float64
	}{
		{
			name:             "Artillery with splash",
			directDamage:     100.0, // Direct hit
			splashDamage:     50.0,  // Splash damage
			splashRadius:     20.0,  // 20 unit radius
			fullDamageRadius: 5.0,   // Full damage within 5 units
		},
		{
			name:             "Bomb with large splash",
			directDamage:     500.0,
			splashDamage:     300.0,
			splashRadius:     50.0,
			fullDamageRadius: 15.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Maximum possible damage (direct hit + full splash)
			maxDamage := tt.directDamage + tt.splashDamage

			// Verify splash radius is larger than full damage radius
			if tt.splashRadius < tt.fullDamageRadius {
				t.Errorf("Splash radius (%.2f) should be >= full damage radius (%.2f)",
					tt.splashRadius, tt.fullDamageRadius)
			}

			// Log the damage profile
			t.Logf("Damage profile: %.0f direct, %.0f splash (%.0f radius, %.0f full damage radius), max %.0f total",
				tt.directDamage, tt.splashDamage, tt.splashRadius, tt.fullDamageRadius, maxDamage)
		})
	}
}
