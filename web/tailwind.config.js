/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'display': ['Orbitron', 'sans-serif'],    // Futuristic headings
        'sans': ['Rajdhani', 'sans-serif'],       // Clean, military-style body text
        'mono': ['JetBrains Mono', 'monospace'],  // Stats and technical data
      },
      colors: {
        // MLA theme colors (blue/cyan)
        mla: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Legion theme colors (orange/red)
        legion: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'border-glow': {
          '0%, 100%': {
            borderColor: 'hsl(var(--primary) / 0.2)',
            boxShadow: '0 0 0 0 hsl(var(--primary) / 0)'
          },
          '50%': {
            borderColor: 'hsl(var(--primary) / 0.5)',
            boxShadow: '0 0 8px 2px hsl(var(--primary) / 0.3)'
          },
        },
      },
      animation: {
        shimmer: 'shimmer 6s infinite',
        'border-glow': 'border-glow 6s infinite',
        'shimmer-delay': 'shimmer 6s infinite 1s',
        'border-glow-delay': 'border-glow 6s infinite 1s',
      },
    },
  },
  plugins: [],
}
