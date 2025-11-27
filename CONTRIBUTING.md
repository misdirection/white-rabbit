# Contributing to White Rabbit

Thank you for your interest in contributing to the White Rabbit solar system simulator! This guide will help you understand how to contribute effectively.

## Table of Contents

- [Getting Started](#getting-started)
- [Code Style Guidelines](#code-style-guidelines)
- [Project Structure](#project-structure)
- [How to Add New Features](#how-to-add-new-features)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

---

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)
- Git

### Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/white-rabbit.git
   cd white-rabbit
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run the development server**:
   ```bash
   npm run dev
   ```
5. **Open your browser** to `http://localhost:5173`

---

## Code Style Guidelines

### General Principles

- **Clarity over cleverness**: Write code that is easy to understand
- **Document complex logic**: Add inline comments for non-obvious calculations
- **Use meaningful names**: Variables and functions should be self-documenting
- **Follow existing patterns**: Match the style of surrounding code

### JavaScript Conventions

```javascript
// ✅ Good: Descriptive function names with JSDoc
/**
 * Calculates moon orbital distance with compound scaling
 * @param {number} baseDistance - Distance in AU
 * @param {number} planetScale - Planet scaling factor
 * @returns {number} Final distance in scene units
 */
function calculateMoonDistance(baseDistance, planetScale) {
    // Compound scaling: AU → scene units → artistic factor
    return baseDistance * AU_TO_SCENE * planetScale * REAL_PLANET_SCALE_FACTOR;
}

// ❌ Bad: Unclear names, no documentation
function calcDist(d, s) {
    return d * 50 * s * 500;
}
```

### File Organization

- **Imports at the top**: Group by external libraries, then internal modules
- **Constants after imports**: Define constants before functions
- **Export functions explicitly**: Use `export function` or `export const`
- **One responsibility per file**: Each file should have a clear, single purpose

### Documentation Standards

#### JSDoc Comments

All exported functions should have JSDoc comments:

```javascript
/**
 * Brief description of what the function does
 * 
 * Longer explanation if needed, can span multiple lines
 * 
 * @param {Type} paramName - Description of parameter
 * @param {Type} [optionalParam] - Optional parameter (note the brackets)
 * @returns {Type} Description of return value
 */
export function functionName(paramName, optionalParam) {
    // Implementation
}
```

#### Inline Comments

Add inline comments for:
- **Complex calculations**: Explain the math
- **Non-obvious logic**: Why, not just what
- **Performance considerations**: Note any optimizations
- **Coordinate transformations**: Three.js uses different axes

Example:
```javascript
// J2000 epoch: Standard astronomical reference point (Jan 1, 2000, 12:00 UTC)
const J2000 = new Date('2000-01-01T12:00:00Z').getTime();

// Calculate rotation: (elapsed hours / period) × full rotation (2π radians)
const rotationAngle = (hoursSinceJ2000 / rotationPeriod) * 2 * Math.PI;
```

---

## Project Structure

Understanding the architecture will help you contribute effectively:

```
src/
├── config.js              # Global configuration and constants
├── core/                  # Core rendering logic
│   ├── scene.js          # Three.js setup
│   ├── planets.js        # Planet creation and updates
│   └── stars.js          # Starfield generation
├── data/                  # Static data definitions
│   ├── bodies.js         # Planet/moon properties
│   └── moonData.js       # Moon categories
├── physics/               # Pure physics calculations
│   └── orbits.js         # Keplerian orbit math
├── systems/               # Subsystems
│   ├── moons.js          # Moon management
│   ├── orbits.js         # Orbit line visualization
│   ├── rings.js          # Planetary rings
│   └── rabbit.js         # Intro animation
├── features/              # Application features
│   ├── focusMode.js      # Camera tracking
│   └── missions.js       # Mission trajectories
└── ui/                    # User interface
    ├── gui.js            # Main GUI orchestrator
    └── modules/          # UI modules (scale, time, etc.)
```

### Key Design Principles

1. **Separation of Concerns**
   - `physics/`: Pure math, no Three.js dependencies
   - `core/`: Three.js rendering logic
   - `data/`: Static definitions
   - `ui/`: User interface

2. **Single Source of Truth**
   - `config.js`: All global state
   - `config.date`: Current simulation time

3. **Modular UI**
   - Each module in `ui/modules/` is self-contained
   - Imported and orchestrated by `gui.js`

### Coordinate Systems
    
The simulation uses the **Equatorial Coordinate System (J2000 epoch)** as its primary reference frame. This is standard in astronomy and matches the data provided by `astronomy-engine`.

- **X-Axis**: Points towards the Vernal Equinox (First Point of Aries).
- **Y-Axis**: Points towards the North Celestial Pole (parallel to Earth's rotation axis).
- **Z-Axis**: Perpendicular to X and Y (Right-handed system).

**Important Note on the Ecliptic Plane**:
The planets orbit in the **Ecliptic Plane**, which is tilted relative to the Equatorial plane by Earth's axial tilt (obliquity), approximately **23.4 degrees**.
- When adding features that align with planetary orbits (like the Habitable Zone), you must apply this tilt.
- Rotation: `rotation.x = 23.4 * (Math.PI / 180)` (if starting from XZ plane).

---

## How to Add New Features

### Adding a New Planet or Moon

1. **Edit `src/data/bodies.js`** or `src/data/moonData.js`:

```javascript
// In planetData array
{
    name: "NewPlanet",
    body: "Body",                    // Astronomy Engine identifier
    radius: 1.5,                     // Relative to Earth
    period: 687,                     // Orbital period in days
    rotationPeriod: 24.6,           // Rotation in hours
    axialTilt: 25.2,                // Degrees
    texture: `${import.meta.env.BASE_URL}assets/textures/newplanet.jpg`,
    details: {
        mass: "...",
        // ... other details
    }
}
```

2. **Add texture** to `public/assets/textures/`
3. **Test** by running `npm run dev`

### Adding a New UI Control

1. **Create a new module** in `src/ui/modules/`:

```javascript
// src/ui/modules/myfeature.js
export function setupMyFeatureFolder(gui, config) {
    const folder = gui.addFolder('My Feature');
    
    folder.add(config, 'myOption').name('My Option');
    
    folder.close(); // Closed by default
    
    return folder;
}
```

2. **Import and use** in `src/ui/gui.js`:

```javascript
import { setupMyFeatureFolder } from './modules/myfeature.js';

// In setupGUI function:
setupMyFeatureFolder(gui, config);
```

### Adding Physics Calculations

1. **Add to `src/physics/orbits.js`** for pure math
2. **Keep it framework-agnostic** (no Three.js)
3. **Document the math** with comments and JSDoc
4. **Use consistent units**: AU for distances, days for time

Example:
```javascript
/**
 * Calculates orbital velocity using vis-viva equation
 * @param {number} a - Semi-major axis in AU
 * @param {number} r - Current distance in AU
 * @returns {number} Velocity in AU/day
 */
export function calculateOrbitalVelocity(a, r) {
    const GM = 0.0002959122; // Gravitational parameter (AU³/day²)
    return Math.sqrt(GM * ((2 / r) - (1 / a)));
}
```

---

## Testing

### Manual Testing Checklist

Before submitting changes, verify:

- [ ] **Development server runs** without errors (`npm run dev`)
- [ ] **Production build succeeds** (`npm run build`)
- [ ] **No console errors** in browser DevTools
- [ ] **Feature works** as expected across different:
  - Time speeds (paused, real-time, fast-forward)
  - Scale settings (realistic, artistic, custom)
  - Planet/moon visibility toggles
- [ ] **UI remains responsive** (no performance issues)
- [ ] **Tooltips display correctly**
- [ ] **Focus mode works** (double-click objects)

### Testing Your Changes

```bash
# Run development server
npm run dev

# Build for production (tests build process)
npm run build

# Preview production build
npm run preview
```

### Browser Testing

Test in at least:
- **Chrome/Edge** (Chromium)
- **Firefox**
- **Safari** (if on macOS)

---

## Submitting Changes

### Commit Messages

Use clear, descriptive commit messages:

```bash
# ✅ Good
git commit -m "Add Jupiter's Europa moon with tidal locking"
git commit -m "Fix: Correct Mars rotation period to 24.6 hours"
git commit -m "Docs: Add JSDoc to calculateKeplerianPosition"

# ❌ Bad
git commit -m "fixed stuff"
git commit -m "update"
```

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes** following the guidelines above

3. **Test thoroughly** (see [Testing](#testing))

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add: Description of changes"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/my-new-feature
   ```

6. **Create a Pull Request** on GitHub:
   - Provide a clear title
   - Describe what changed and why
   - Include screenshots/videos for UI changes
   - Reference any related issues

### Pull Request Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Changes Made
- Change 1
- Change 2

## Testing
How did you test these changes?

## Screenshots (if applicable)
Add screenshots or GIFs showing the changes
```

---

## Additional Resources

- **README.md**: Project overview and architecture
- **Three.js Docs**: https://threejs.org/docs/
- **Astronomy Engine**: https://github.com/cosinekitty/astronomy
- **lil-gui**: https://lil-gui.georgealways.com/

---

## Questions?

If you have questions about contributing:
- Open an issue on GitHub
- Check existing issues for similar questions
- Review the README.md for architecture details

---

## Code of Conduct

- **Be respectful** and constructive
- **Help others** learn and grow
- **Keep discussions** focused and productive
- **Credit contributors** for their work

Thank you for contributing to White Rabbit! 🐇✨
