# Refactoring Guide

This guide provides best practices and patterns for refactoring and maintaining the White Rabbit codebase.

## When to Refactor

### File Size Guidelines

- ✅ **Under 400 lines**: Ideal file size, easy to navigate and maintain
- ⚠️ **400-600 lines**: Acceptable, but review for potential splitting opportunities
- 🔴 **Over 600 lines**: Consider splitting if file has multiple responsibilities
- ❌ **Over 800 lines**: Strong candidate for refactoring

### Signs a File Needs Splitting

1. **Multiple Responsibilities**: File handles more than one major concern (e.g., both UI and calculation logic)
2. **Long Scroll Distance**: Takes more than 10 seconds to scroll through
3. **Difficult Navigation**: Frequently need to use "Find" to locate functions
4. **Reusable Utilities**: Contains helper functions that multiple files could use
5. **Conceptual Boundaries**: Clear groups of related functions (e.g., "formatting" functions)

## How to Split Files

### Pattern 1: Extract Utilities

**When**: File contains helper functions used in multiple places

**Example**: `tooltips.js` → Extract `formatting.js`

```javascript
// BEFORE: tooltips.js (1000+ lines)
function formatScientific(value, precision) { ... }
function formatDecimal(value) { ... }
function formatGravity(value) { ... }
// ... rest of tooltip logic

// AFTER: utils/formatting.js (NEW)
export function formatScientific(value, precision) { ... }
export function formatDecimal(value) { ... }
export function formatGravity(value) { ... }

// AFTER: tooltips.js (updated)
import { formatScientific, formatDecimal, formatGravity } from '../utils/formatting.js';
```

### Pattern 2: Subdirectory Split

**When**: File has 3+ distinct responsibilities or conceptual groupings

**Example**: `visual.js` (1018 lines) → `visual/` subdirectory

```
Before:
src/ui/modules/visual.js (1018 lines)

After:
src/ui/modules/visual/
├── index.js                    # Main exports, setupVisualFolder
├── referencePlane.js          # Coordinate system & plane logic
├── objectsControls.js         # Object visibility toggles
├── overlaysControls.js        # Asterisms, orbits controls
└── magneticFieldsControls.js  # Magnetic field controls
```

**Key Rules**:
- Always create `index.js` to re-export all public functions
- Preserve existing import paths by exporting from `index.js`
- Group by **responsibility**, not file size
- Each split file should be focused on one task

### Pattern 3: Feature Split

**When**: Large feature file combines calculation, rendering, and interaction logic

**Example**: `missions.js` (1034 lines) → `missions/` subdirectory

```
src/features/missions/
├── index.js                 # Re-exports all public API
├── trajectoryCalculation.js # Pure math: splines, waypoints
├── missionLines.js         # Three.js rendering
└── missionProbes.js        # GLTF model management
```

## Migration Checklist

When splitting a file, follow these steps:

### 1. Plan the Split
- [ ] Identify logical groupings of functions
- [ ] Determine which functions are public vs. internal
- [ ] Map dependencies between function groups
- [ ] Choose split pattern (Utilities, Subdirectory, or Feature)

### 2. Create New Files
- [ ] Create target directory/files
- [ ] Add file-level JSDoc to each new file
- [ ] Copy functions to appropriate files
- [ ] Add necessary imports to each new file
- [ ] Export public functions

### 3. Create Index File (if subdirectory)
```javascript
// index.js - Re-export pattern
export { functionA, functionB } from './moduleA.js';
export { functionC } from './moduleB.js';
```

### 4. Update Original File
- [ ] Replace function definitions with import statements
- [ ] Keep original file if it orchestrates the sub-modules
- [ ] OR delete original file if fully replaced by index.js

### 5. Update Consumers
- [ ] Find all files that import from the split file
- [ ] Update import paths (may be a no-op if using `index.js`)
- [ ] Run lint: `npm run lint:fix`

### 6. Test
- [ ] Run dev server: `npm run dev`
- [ ] Test affected features manually
- [ ] Run build: `npm run build`
- [ ] Verify no import errors in console

### 7. Commit
```bash
git add .
git commit -m "refactor: Split visual.js into subdirectory for better organization"
```

## Best Practices

### Import/Export Patterns

**✅ Preferred**: Named exports for utilities
```javascript
// formatting.js
export function formatDecimal(value) { ... }
export function formatScientific(value, precision) { ... }

// consumer.js
import { formatDecimal, formatScientific } from '../utils/formatting.js';
```

**✅ Acceptable**: Default export for single-purpose modules
```javascript
// StarManager.js
export default class StarManager { ... }

// consumer.js
import StarManager from './StarManager.js';
```

**❌ Avoid**: Mixing default and named exports in the same file

### File Naming

- **Utilities**: Lowercase, descriptive (`formatting.js`, `screenSpace.js`)
- **Classes**: PascalCase matching class name (`StarManager.js`, `Octree.js`)
- **UI Modules**: camelCase matching feature (`visual.js`, `missions.js`)
- **Subdirectories**: Match parent file name (`visual/`, `missions/`)

### Documentation

Every split file should have:

```javascript
/**
 * @file filename.js
 * @description Brief description of the module's purpose.
 *
 * More detailed explanation if needed, including:
 * - Key responsibilities
 * - Usage patterns
 * - Dependencies
 * - Performance considerations
 */
```

### Testing Strategy

After refactoring, test in this order:

1. **Linting**: `npm run lint` (should pass with zero errors)
2. **Build**: `npm run build` (verifies imports are correct)
3. **Dev Server**: `npm run dev` (UI should load without errors)
4. **Smoke Test**: Test the affected feature end-to-end
5. **Full Test**: Navigate through all UI controls

## Common Pitfalls

### ❌ Circular Dependencies
```javascript
// BAD: moduleA.js imports moduleB, moduleB imports moduleA
// moduleA.js
import { funcB } from './moduleB.js';
export function funcA() { funcB(); }

// moduleB.js
import { funcA } from './moduleA.js'; // CIRCULAR!
export function funcB() { funcA(); }
```

**Solution**: Extract shared logic to a third module

### ❌ Breaking Public API
```javascript
// BAD: Changing import paths for consumers
// Before:
import { setupVisualFolder } from './modules/visual.js';

// After (BREAKS IMPORTS):
import { setupVisualFolder } from './modules/visual/index.js`;
```

**Solution**: Use `index.js` to maintain original path:
```javascript
// visual/index.js
export { setupVisualFolder } from './referencePlane.js';
// Now consumers can still use:
import { setup VisualFolder } from './modules/visual.js';
```

### ❌ Incomplete Imports
```javascript
// BAD: Forgetting to import dependencies in split files
// formatting.js
export function formatDecimal(value) {
	return value.toLocaleString('en-US', ...); // Works!
}

export function formatGravity(value) {
	return `${formatDecimal(value / 9.807)} g`; // ERROR: formatDecimal not in scope!
}
```

**Solution**: Import sibling functions or keep related functions together

## Directory Organization

### When to Create a Subdirectory

- **3+ related files**: Worth grouping (e.g., `missions/` with 4 files)
- **Shared responsibility**: Files work together on one feature
- **Clear namespace**: Directory name clearly describes contents

### When to Keep Files Flat

- **1-2 files**: Not worth the nesting overhead
- **Unrelated utilities**: Keep in `utils/` directly
- **Simple modules**: Single-file features (e.g., `rabbit.js`)

## Summary

- **Refactor when file size > 600 lines** or has multiple responsibilities
- **Use subdirectories for 3+ related files**, flat structure otherwise
- **Always create `index.js`** to preserve import paths
- **Test thoroughly** after refactoring (lint, build, manual test)
- **Document every file** with file-level JSDoc

Refactoring improves maintainability incrementally. Don't try to refactor everything at once - focus on files that are actively being modified or causing pain.
