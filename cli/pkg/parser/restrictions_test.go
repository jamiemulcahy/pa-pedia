package parser

import (
	"testing"

	"github.com/jamiemulcahy/pa-pedia/pkg/models"
)

// TestParseRestriction tests the build restriction grammar parser
func TestParseRestriction(t *testing.T) {
	tests := []struct {
		name        string
		restriction string
		unitTypes   []string
		expected    bool
	}{
		{
			name:        "Simple type match",
			restriction: "Mobile",
			unitTypes:   []string{"Mobile", "Tank"},
			expected:    true,
		},
		{
			name:        "Simple type no match",
			restriction: "Air",
			unitTypes:   []string{"Mobile", "Tank"},
			expected:    false,
		},
		{
			name:        "AND operator both present",
			restriction: "Mobile & Basic",
			unitTypes:   []string{"Mobile", "Basic", "Tank"},
			expected:    true,
		},
		{
			name:        "AND operator one missing",
			restriction: "Mobile & Basic",
			unitTypes:   []string{"Mobile", "Tank"},
			expected:    false,
		},
		{
			name:        "OR operator both present",
			restriction: "Mobile | Air",
			unitTypes:   []string{"Mobile", "Basic"},
			expected:    true,
		},
		{
			name:        "OR operator one present",
			restriction: "Mobile | Air",
			unitTypes:   []string{"Air", "Basic"},
			expected:    true,
		},
		{
			name:        "OR operator none present",
			restriction: "Mobile | Air",
			unitTypes:   []string{"Naval", "Basic"},
			expected:    false,
		},
		{
			name:        "MINUS operator has type but not excluded",
			restriction: "Mobile - Construction",
			unitTypes:   []string{"Mobile", "Tank"},
			expected:    true,
		},
		{
			name:        "MINUS operator has both types",
			restriction: "Mobile - Construction",
			unitTypes:   []string{"Mobile", "Construction"},
			expected:    false,
		},
		{
			name:        "Complex expression with parentheses - mobile basic",
			restriction: "(Mobile | Air) & Basic",
			unitTypes:   []string{"Mobile", "Basic", "Tank"},
			expected:    true,
		},
		{
			name:        "Complex expression with parentheses - air basic",
			restriction: "(Mobile | Air) & Basic",
			unitTypes:   []string{"Air", "Basic"},
			expected:    true,
		},
		{
			name:        "Complex expression with parentheses - mobile advanced",
			restriction: "(Mobile | Air) & Basic",
			unitTypes:   []string{"Mobile", "Advanced"},
			expected:    false,
		},
		{
			name:        "Complex expression with parentheses - naval basic",
			restriction: "(Mobile | Air) & Basic",
			unitTypes:   []string{"Naval", "Basic"},
			expected:    false,
		},
		{
			name:        "Complex with AND and MINUS",
			restriction: "Mobile & Basic - Construction",
			unitTypes:   []string{"Mobile", "Basic", "Tank"},
			expected:    true,
		},
		{
			name:        "Complex with AND and MINUS - excluded",
			restriction: "Mobile & Basic - Construction",
			unitTypes:   []string{"Mobile", "Basic", "Construction"},
			expected:    false,
		},
		{
			name:        "Factory restriction",
			restriction: "Factory",
			unitTypes:   []string{"Structure", "Factory", "Basic"},
			expected:    true,
		},
		{
			name:        "Right-side parentheses",
			restriction: "Mobile & (Basic | Advanced)",
			unitTypes:   []string{"Mobile", "Basic"},
			expected:    true,
		},
		{
			name:        "Right-side parentheses - advanced",
			restriction: "Mobile & (Basic | Advanced)",
			unitTypes:   []string{"Mobile", "Advanced"},
			expected:    true,
		},
		{
			name:        "Right-side parentheses - titan",
			restriction: "Mobile & (Basic | Advanced)",
			unitTypes:   []string{"Mobile", "Titan"},
			expected:    false,
		},
		{
			name:        "Multiple groups",
			restriction: "(Mobile | Air) & (Basic | Advanced)",
			unitTypes:   []string{"Mobile", "Advanced"},
			expected:    true,
		},
		{
			name:        "Multiple groups - air basic",
			restriction: "(Mobile | Air) & (Basic | Advanced)",
			unitTypes:   []string{"Air", "Basic"},
			expected:    true,
		},
		{
			name:        "Multiple groups - naval basic",
			restriction: "(Mobile | Air) & (Basic | Advanced)",
			unitTypes:   []string{"Naval", "Basic"},
			expected:    false,
		},
		{
			name:        "Nested parentheses",
			restriction: "((A | B) & C) | D",
			unitTypes:   []string{"D"},
			expected:    true,
		},
		{
			name:        "Nested parentheses - A and C",
			restriction: "((A | B) & C) | D",
			unitTypes:   []string{"A", "C"},
			expected:    true,
		},
		{
			name:        "Nested parentheses - B and C",
			restriction: "((A | B) & C) | D",
			unitTypes:   []string{"B", "C"},
			expected:    true,
		},
		{
			name:        "Nested parentheses - A only",
			restriction: "((A | B) & C) | D",
			unitTypes:   []string{"A"},
			expected:    false,
		},
		{
			name:        "Parentheses with minus",
			restriction: "(Mobile | Air) - Construction",
			unitTypes:   []string{"Mobile"},
			expected:    true,
		},
		{
			name:        "Parentheses with minus - excluded",
			restriction: "(Mobile | Air) - Construction",
			unitTypes:   []string{"Mobile", "Construction"},
			expected:    false,
		},
		{
			name:        "Real PA expression - Air factory",
			restriction: "(Air & Mobile & Basic | Air & Fabber & Basic & Mobile) & FactoryBuild",
			unitTypes:   []string{"Air", "Mobile", "Basic", "FactoryBuild", "Fighter"},
			expected:    true,
		},
		{
			name:        "Real PA expression - Air factory fabber",
			restriction: "(Air & Mobile & Basic | Air & Fabber & Basic & Mobile) & FactoryBuild",
			unitTypes:   []string{"Air", "Fabber", "Basic", "Mobile", "FactoryBuild"},
			expected:    true,
		},
		{
			name:        "Real PA expression - Air factory no FactoryBuild",
			restriction: "(Air & Mobile & Basic | Air & Fabber & Basic & Mobile) & FactoryBuild",
			unitTypes:   []string{"Air", "Mobile", "Basic", "Fighter"},
			expected:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test unit
			unit := &models.Unit{
				UnitTypes: tt.unitTypes,
			}

			// Parse restriction
			restriction := ParseRestriction(tt.restriction)

			// Test if unit satisfies restriction
			result := restriction.Satisfies(unit)

			if result != tt.expected {
				t.Errorf("ParseRestriction(%q).Satisfies(%v) = %v, want %v",
					tt.restriction, tt.unitTypes, result, tt.expected)
			}
		})
	}
}

// TestRestrictionOperatorPrecedence tests that operators have correct precedence
func TestRestrictionOperatorPrecedence(t *testing.T) {
	// Test: OR has lowest precedence, AND higher, MINUS highest
	// "Mobile | Air & Basic" should parse as "Mobile | (Air & Basic)"
	tests := []struct {
		name        string
		restriction string
		unitTypes   []string
		expected    bool
	}{
		{
			name:        "OR with AND - mobile only",
			restriction: "Mobile | Air & Basic",
			unitTypes:   []string{"Mobile"},
			expected:    true, // Mobile matches left side of OR
		},
		{
			name:        "OR with AND - air basic",
			restriction: "Mobile | Air & Basic",
			unitTypes:   []string{"Air", "Basic"},
			expected:    true, // Air & Basic matches right side of OR
		},
		{
			name:        "OR with AND - air only",
			restriction: "Mobile | Air & Basic",
			unitTypes:   []string{"Air"},
			expected:    false, // Air alone doesn't satisfy Air & Basic
		},
		{
			name:        "MINUS has higher precedence than AND",
			restriction: "Mobile & Tank - Scout",
			unitTypes:   []string{"Mobile", "Tank"},
			expected:    true, // Mobile & (Tank - Scout) -> Mobile & Tank (no Scout)
		},
		{
			name:        "MINUS has higher precedence than AND - excluded",
			restriction: "Mobile & Tank - Scout",
			unitTypes:   []string{"Mobile", "Tank", "Scout"},
			expected:    false, // Mobile & (Tank - Scout) -> Tank is Scout so fails
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unit := &models.Unit{
				UnitTypes: tt.unitTypes,
			}

			restriction := ParseRestriction(tt.restriction)
			result := restriction.Satisfies(unit)

			if result != tt.expected {
				t.Errorf("ParseRestriction(%q).Satisfies(%v) = %v, want %v",
					tt.restriction, tt.unitTypes, result, tt.expected)
			}
		})
	}
}

// TestEmptyRestriction tests handling of empty restriction strings
func TestEmptyRestriction(t *testing.T) {
	unit := &models.Unit{
		UnitTypes: []string{"Mobile", "Tank"},
	}

	restriction := ParseRestriction("")
	// Empty restriction should not match anything
	result := restriction.Satisfies(unit)

	if result != false {
		t.Errorf("Empty restriction should not satisfy any unit, got %v", result)
	}
}

// TestTokenize tests the tokenizer creates correct nested structure
func TestTokenize(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int // Number of top-level tokens
	}{
		{
			name:     "Simple expression",
			input:    "Mobile",
			expected: 1,
		},
		{
			name:     "AND expression",
			input:    "Mobile & Basic",
			expected: 3, // Mobile, &, Basic
		},
		{
			name:     "Parenthesized expression",
			input:    "(Mobile | Air) & Basic",
			expected: 3, // (group), &, Basic
		},
		{
			name:     "Multiple groups",
			input:    "(A | B) & (C | D)",
			expected: 3, // (group), &, (group)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tokens := tokenize(tt.input)
			if len(tokens) != tt.expected {
				t.Errorf("tokenize(%q) produced %d tokens, want %d", tt.input, len(tokens), tt.expected)
			}
		})
	}
}
