/* eslint-disable react-hooks/purity */
// Math.random() is used within useMemo to generate stable snowflake data
// This is safe because values are memoized and never re-calculated during re-renders
import { memo, useMemo } from 'react'

/**
 * Pure CSS snowfall effect component
 * Creates falling snowflakes across the viewport with varying speeds and positions
 * Respects prefers-reduced-motion for accessibility
 */
export const ChristmasSnow = memo(() => {
  // Generate 25 snowflakes with random properties
  // Use useMemo to ensure snowflakes remain stable across re-renders
  const snowflakes = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: i,
        // Randomize horizontal position (0-100%)
        left: Math.random() * 100,
        // Randomize animation duration (10-30s) for varied falling speeds
        duration: 10 + Math.random() * 20,
        // Randomize animation delay for staggered start
        delay: Math.random() * 10,
        // Randomize size (0.5-1.5em)
        size: 0.5 + Math.random() * 1,
        // Randomize opacity (0.4-0.8)
        opacity: 0.4 + Math.random() * 0.4,
        // Randomize horizontal drift per snowflake (-50 to 50px)
        drift: Math.random() * 100 - 50,
      })),
    [] // Empty deps array - generate once and never change
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute text-white snowflake"
          style={{
            left: `${flake.left}%`,
            top: '-10%',
            fontSize: `${flake.size}em`,
            opacity: flake.opacity,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            // Use CSS variable for per-flake drift value
            ['--drift' as string]: `${flake.drift}px`,
          }}
        >
          ❄
        </div>
      ))}
    </div>
  )
})

ChristmasSnow.displayName = 'ChristmasSnow'
