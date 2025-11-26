package parser

import (
	"strings"

	"github.com/jamiemulcahy/pa-pedia/pkg/models"
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

// Token represents either a simple string token or a nested group from parentheses
type Token struct {
	Value    string  // For simple tokens (operators or category names)
	Children []Token // For parenthesized groups (nil if simple token)
}

// IsGroup returns true if this token represents a parenthesized group
func (t Token) IsGroup() bool {
	return t.Children != nil
}

// ParseRestriction parses a buildable_types string into a Restriction
// Example: "(Mobile | Air) & Basic" means mobile or air units that are also basic tier
func ParseRestriction(text string) Restriction {
	tokens := tokenize(text)
	return parseTokens(tokens)
}

// tokenize converts a restriction string into a slice of tokens with nested structure for parentheses
func tokenize(text string) []Token {
	special := map[rune]bool{
		'|': true, '&': true, '-': true, '(': true, ')': true, ' ': true,
	}

	// First pass: create flat string tokens
	var rawTokens []string
	var word strings.Builder

	for _, c := range text + " " {
		if special[c] {
			if word.Len() > 0 {
				rawTokens = append(rawTokens, word.String())
				word.Reset()
			}
			if c != ' ' {
				rawTokens = append(rawTokens, string(c))
			}
		} else {
			word.WriteRune(c)
		}
	}

	// Second pass: build nested structure from parentheses using a stack
	var stack [][]Token
	current := []Token{}

	for _, tok := range rawTokens {
		switch tok {
		case "(":
			// Push current onto stack and start a new group
			stack = append(stack, current)
			current = []Token{}
		case ")":
			// Pop from stack and add current as a nested group
			if len(stack) > 0 {
				parent := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				parent = append(parent, Token{Children: current})
				current = parent
			}
		default:
			// Regular token (operator or category name)
			current = append(current, Token{Value: tok})
		}
	}

	return current
}

// parseTokens recursively parses tokens into a Restriction tree
func parseTokens(tokens []Token) Restriction {
	// Handle empty input
	if len(tokens) == 0 {
		return &SimpleRestriction{Category: ""}
	}

	// Handle OR (lowest precedence) - find first OR not inside a group
	for i, token := range tokens {
		if !token.IsGroup() && token.Value == "|" {
			left := parseTokens(tokens[:i])
			right := parseTokens(tokens[i+1:])
			return &CompoundOr{Left: left, Right: right}
		}
	}

	// Handle AND (medium precedence)
	for i, token := range tokens {
		if !token.IsGroup() && token.Value == "&" {
			left := parseTokens(tokens[:i])
			right := parseTokens(tokens[i+1:])
			return &CompoundAnd{Left: left, Right: right}
		}
	}

	// Handle MINUS (highest precedence, right-associative)
	for i := len(tokens) - 1; i >= 0; i-- {
		if !tokens[i].IsGroup() && tokens[i].Value == "-" {
			left := parseTokens(tokens[:i])
			right := parseTokens(tokens[i+1:])
			return &CompoundMinus{Left: left, Right: right}
		}
	}

	// Base case: single token (either simple or group)
	if len(tokens) == 1 {
		if tokens[0].IsGroup() {
			// Recursively parse the contents of the parenthesized group
			return parseTokens(tokens[0].Children)
		}
		return &SimpleRestriction{Category: tokens[0].Value}
	}

	// Fallback for unexpected cases
	if len(tokens) > 0 && !tokens[0].IsGroup() {
		return &SimpleRestriction{Category: tokens[0].Value}
	}
	return &SimpleRestriction{Category: ""}
}
