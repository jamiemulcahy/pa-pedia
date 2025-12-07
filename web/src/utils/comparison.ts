/**
 * Utility functions for unit comparison features
 */

/**
 * Check if two values are different (for comparison filtering)
 * Returns true if the values are not strictly equal, accounting for undefined
 */
export function isDifferent<T>(a: T | undefined, b: T | undefined): boolean {
  if (a === undefined && b === undefined) return false;
  if (a === undefined || b === undefined) return true;
  return a !== b;
}
