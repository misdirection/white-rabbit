# AGENTS.md

## Build & Dev Commands
- `npm run dev` - Start development server (Vite)
- `npm run build` - Production build
- `npm run lint` - Run Biome linter
- `npm run lint:fix` - Auto-fix lint issues
- `npm run check` - Lint + format (run before commits)
- No test framework configured

## Code Style (Biome enforced)
- 2-space indentation, single quotes, semicolons required
- Trailing commas (ES5 style), arrow parens always
- Line width: 100 characters
- Imports: external libraries first, then internal modules

## Conventions
- JSDoc comments on all exported functions
- Descriptive names over brevity (`calculateMoonDistance` not `calcDist`)
- One responsibility per file; pure physics in `src/physics/`, rendering in `src/core/`
- Use `config.js` for global state; `config.date` for simulation time
- Coordinate system: Equatorial J2000 epoch; ecliptic plane tilted 23.4 degrees
- Units: AU for distances, days for time periods, hours for rotation periods
