import { memo } from 'react'

/**
 * Pure CSS snowfall effect component
 * Creates falling snowflakes across the viewport with varying speeds and positions
 */
export const ChristmasSnow = memo(() => {
  // Generate 25 snowflakes with random properties
  const snowflakes = Array.from({ length: 25 }, (_, i) => ({
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
  }))

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute text-white"
          style={{
            left: `${flake.left}%`,
            top: '-10%',
            fontSize: `${flake.size}em`,
            opacity: flake.opacity,
            animation: `snowfall ${flake.duration}s linear ${flake.delay}s infinite`,
            // Add subtle horizontal drift
            transform: `translateX(${Math.sin(flake.id) * 20}px)`,
          }}
        >
          ❄
        </div>
      ))}
      <style>
        {`
          @keyframes snowfall {
            0% {
              transform: translateY(0) translateX(0) rotate(0deg);
            }
            100% {
              transform: translateY(100vh) translateX(${Math.random() * 100 - 50}px) rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  )
})

ChristmasSnow.displayName = 'ChristmasSnow'
