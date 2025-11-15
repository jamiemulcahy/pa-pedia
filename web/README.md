# PA-Pedia Web App

React-based web application for browsing Planetary Annihilation Titans faction data.

## Tech Stack

- **React 19** with TypeScript
- **React Router v6** for routing
- **Tailwind CSS v3** for styling
- **Vite** for build tooling
- **Vitest** + React Testing Library for testing (configured)

## Project Structure

```
src/
├── components/       # React components
│   ├── ErrorBoundary.tsx  # Error boundary component
│   ├── ui/          # Reusable UI components (for future Shadcn components)
│   ├── faction/     # Faction-specific components (future)
│   ├── unit/        # Unit-specific components (future)
│   └── layout/      # Layout components (future)
├── pages/           # Page components
│   ├── Home.tsx     # Faction selection page
│   ├── FactionDetail.tsx  # Unit browsing for a faction
│   └── UnitDetail.tsx     # Detailed unit view
├── contexts/        # React Context providers
│   └── FactionContext.tsx  # Global faction state
├── hooks/           # Custom React hooks
│   ├── useFactions.ts  # Access all factions
│   ├── useFaction.ts   # Access specific faction
│   └── useUnit.ts      # Access specific unit
├── services/        # Data loading services
│   └── factionLoader.ts  # Faction data fetching
├── types/           # TypeScript type definitions
│   └── faction.ts   # All data types
└── lib/             # Utility functions
    └── utils.ts     # Tailwind utility helper

public/
└── factions/        # Faction data (metadata, units, icons)
    ├── MLA/         # MLA faction data
    │   ├── metadata.json
    │   ├── units.json
    │   └── units/   # Individual unit folders
    └── Legion/      # Legion faction data
```

## Development

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Running the App

```bash
# Development server (hot reload)
npm run dev

# Open http://localhost:5173 in your browser
```

### Building for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

### Linting

```bash
npm run lint
```

## Features Implemented

### Phase 2.1: Project Setup ✅
- Vite + React + TypeScript initialization
- Tailwind CSS v3 configuration with PA theme colors (MLA blue/cyan, Legion orange/red)
- TypeScript path aliases (`@/*` maps to `src/*`)
- Project directory structure
- Faction data copied to `public/factions/`
- Vitest configuration for testing

### Phase 2.2: Data Layer ✅
- **FactionContext**: React Context for global state management
- **factionLoader service**: Functions to load faction metadata, indexes, and unit data
  - `discoverFactions()`: Get list of available factions
  - `loadFactionMetadata()`: Load faction metadata
  - `loadFactionIndex()`: Load faction unit index
  - `loadUnitResolved()`: Load unit resolved data
  - `getUnitIconPath()`: Helper for icon URLs
- **Custom hooks**:
  - `useFactions()`: Access all faction metadata
  - `useFaction(id)`: Access specific faction + lazy-load unit index
  - `useUnit(factionId, unitId)`: Lazy-load unit resolved data
- **Lazy loading strategy**:
  - Metadata preloaded on app start
  - Unit indexes loaded when viewing faction
  - Individual units loaded when viewing unit details

### Phase 2.3-2.4: UI Components & Pages ✅
- **ErrorBoundary**: Catches and displays React errors gracefully
- **Home page**:
  - Grid of faction cards with metadata
  - Links to faction detail pages
  - Loading and error states
- **FactionDetail page**:
  - Displays all units in a faction (grid layout)
  - Search by unit name (real-time filtering)
  - Filter by unit type (dropdown)
  - Unit icons with fallback handling
  - Unit type badges
  - Link to unit detail pages
- **UnitDetail page**:
  - Full unit specifications across multiple sections
  - Combat stats (health, armor, weapons with DPS/range)
  - Economy (build costs, production/consumption rates)
  - Mobility (speed, turn rate)
  - Build relationships (built by, can build) with clickable links
  - Unit icon display
  - Breadcrumb navigation

## Data Loading Strategy

The app uses a three-tier lazy loading strategy to optimize performance:

1. **App Load** (immediate): All faction metadata loaded from `metadata.json` files
2. **Faction View** (on-demand): Unit index loaded from `units.json` when viewing a faction
3. **Unit View** (on-demand): Full unit data loaded from `{unit}_resolved.json` when viewing a unit

All data is cached in React Context to avoid redundant network requests. This keeps initial load fast while providing instant navigation once data is cached.

## Type Safety

TypeScript types are manually defined in `src/types/faction.ts` based on the JSON schemas in `../schema/`.

Key interfaces:
- `FactionMetadata`: Faction info (name, version, author, etc.)
- `FactionIndex`: Lightweight unit index with file provenance
- `UnitIndexEntry`: Unit summary in index
- `Unit`: Complete unit specifications (from resolved files)
- `Weapon`, `BuildArm`, `BuildRelationships`: Unit component specs
- `CombatSpecs`, `EconomySpecs`, `MobilitySpecs`: Nested specifications

## Styling

The app uses Tailwind CSS v3 with a custom theme:
- **MLA colors**: Blue/cyan palette (`mla-*` classes)
- **Legion colors**: Orange/red palette (`legion-*` classes)
- **Dark mode support**: CSS variables configured for light/dark themes
- **Responsive design**: Mobile-first approach with responsive breakpoints

## Accessibility

- Semantic HTML elements used throughout
- Keyboard navigation supported on all interactive elements
- Links have hover states for visual feedback
- Error states clearly communicated with color and text
- Loading states prevent user confusion
- Images have alt text (unit names)

## Known Limitations

This is a Minimum Viable Product (MVP) implementation focusing on core functionality:

- **No dark mode toggle UI** - CSS variables exist but no toggle button yet
- **No Shadcn/ui components installed** - Using native HTML elements with Tailwind
- **Basic filtering only** - Single search + single type filter
- **No unit comparison feature**
- **No virtualization** - May slow with thousands of units
- **No tests written yet** - Setup exists but no test suite
- **No layout component** - Navigation is inline on each page
- **No tabs on unit detail** - All specs shown in single scroll view
- **Hard-coded faction discovery** - MLA and Legion only

## Future Enhancements (Phase 2.5+)

### High Priority
- Dark mode toggle with theme persistence
- Install Shadcn/ui components (button, card, badge, tabs, etc.)
- Layout component with persistent header/nav
- Advanced filtering (tier, mobility type, cost range)
- Unit detail tabs (Overview, Combat, Economy, Mobility, Build)

### Medium Priority
- Unit comparison side-by-side view
- Responsive mobile layout improvements
- Virtual scrolling for large unit lists
- Unit search across all factions
- Faction stats dashboard

### Low Priority
- Comprehensive test suite
- Performance optimizations (React.memo, code splitting)
- PWA support for offline browsing
- Export unit data as CSV/JSON
- Custom faction themes

## Troubleshooting

### Build fails with Rollup error

If you see `Cannot find module @rollup/rollup-win32-x64-msvc`:

```bash
npm install @rollup/rollup-win32-x64-msvc
```

### Icons not loading

Ensure faction data was copied to `public/factions/` correctly:

```bash
# From project root (pa-pedia/)
cp -r factions/MLA web/public/factions/MLA
cp -r factions/Legion web/public/factions/Legion
```

### Tailwind styles not working

Make sure Tailwind v3 is installed (not v4):

```bash
npm install -D tailwindcss@3 postcss@8 autoprefixer@10
```

### TypeScript errors with @ imports

Ensure `tsconfig.app.json` has path aliases configured:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Performance

Current build stats:
- Bundle size: ~241 KB (gzipped: ~76 KB)
- CSS size: ~10 KB (gzipped: ~3 KB)
- Build time: ~4 seconds
- Dev server startup: ~300ms

## Browser Support

- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions

## Contributing

See main project README for contribution guidelines.

## License

Same as parent PA-Pedia project.
