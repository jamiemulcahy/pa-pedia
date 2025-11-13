package parser

import (
	"strings"

	"github.com/planetaryannihilation/pa-pedia/pkg/models"
)

// Restriction represents a buildable type restriction
type Restriction interface {
	Satisfies(unit *models.Unit) bool
}

// SimpleRestriction checks for a single unit type
type SimpleRestriction struct {
	Category string
}

func (r *SimpleRestriction) Satisfies(unit *models.Unit) bool {
	for _, ut := range unit.UnitTypes {
		if ut == r.Category {
			return true
		}
	}
	return false
}

// CompoundAnd checks that both restrictions are satisfied
type CompoundAnd struct {
	Left  Restriction
	Right Restriction
}

func (r *CompoundAnd) Satisfies(unit *models.Unit) bool {
	return r.Left.Satisfies(unit) && r.Right.Satisfies(unit)
}

// CompoundOr checks that at least one restriction is satisfied
type CompoundOr struct {
	Left  Restriction
	Right Restriction
}

func (r *CompoundOr) Satisfies(unit *models.Unit) bool {
	return r.Left.Satisfies(unit) || r.Right.Satisfies(unit)
}

// CompoundMinus checks that left is satisfied but right is not
type CompoundMinus struct {
	Left  Restriction
	Right Restriction
}

func (r *CompoundMinus) Satisfies(unit *models.Unit) bool {
	return r.Left.Satisfies(unit) && !r.Right.Satisfies(unit)
}

// ParseRestriction parses a buildable_types string into a Restriction
// Example: "Mobile & Tank - Construction" means mobile tanks that aren't construction
func ParseRestriction(text string) Restriction {
	tokens := tokenize(text)
	return parseTokens(tokens)
}

// tokenize breaks down the restriction string into tokens
func tokenize(text string) []string {
	special := map[rune]bool{
		'|': true, '&': true, '-': true, '(': true, ')': true, ' ': true,
	}

	var tokens []string
	var word strings.Builder

	for _, c := range text + " " {
		if special[c] {
			if word.Len() > 0 {
				tokens = append(tokens, word.String())
				word.Reset()
			}
			if c != ' ' {
				tokens = append(tokens, string(c))
			}
		} else {
			word.WriteRune(c)
		}
	}

	return tokens
}

// parseTokens recursively parses tokens into a Restriction tree
func parseTokens(tokens []string) Restriction {
	// Handle parentheses
	tokens = parseParentheses(tokens)

	// Handle OR (lowest precedence)
	for i, token := range tokens {
		if token == "|" {
			left := parseTokens(tokens[:i])
			right := parseTokens(tokens[i+1:])
			return &CompoundOr{Left: left, Right: right}
		}
	}

	// Handle AND (medium precedence)
	for i, token := range tokens {
		if token == "&" {
			left := parseTokens(tokens[:i])
			right := parseTokens(tokens[i+1:])
			return &CompoundAnd{Left: left, Right: right}
		}
	}

	// Handle MINUS (highest precedence, right-associative)
	for i := len(tokens) - 1; i >= 0; i-- {
		if tokens[i] == "-" {
			left := parseTokens(tokens[:i])
			right := parseTokens(tokens[i+1:])
			return &CompoundMinus{Left: left, Right: right}
		}
	}

	// Base case: single category
	if len(tokens) == 1 {
		return &SimpleRestriction{Category: tokens[0]}
	}

	// Shouldn't reach here with valid input
	if len(tokens) > 0 {
		return &SimpleRestriction{Category: tokens[0]}
	}

	return &SimpleRestriction{Category: ""}
}

// parseParentheses converts nested token lists from parentheses into Restrictions
func parseParentheses(tokens []string) []string {
	for {
		openIdx := -1
		foundPair := false

		for i, token := range tokens {
			if token == "(" {
				openIdx = i
			} else if token == ")" {
				if openIdx == -1 {
					// Unmatched close paren, ignore
					continue
				}

				// Parse the content between parentheses
				inner := tokens[openIdx+1 : i]
				_ = parseTokens(inner)

				// Replace the parenthesized section with a placeholder
				placeholder := "\x00RESTRICTION\x00"
				newTokens := make([]string, 0, len(tokens)-i+openIdx)
				newTokens = append(newTokens, tokens[:openIdx]...)
				newTokens = append(newTokens, placeholder)
				newTokens = append(newTokens, tokens[i+1:]...)

				tokens = newTokens
				foundPair = true
				break
			}
		}

		// No matching parentheses pair found, stop processing
		if !foundPair {
			break
		}
	}

	return tokens
}
