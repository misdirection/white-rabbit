---
description: Fix linting and formatting issues
---

# Lint and Fix Code

This workflow checks and fixes code style issues using Biome.

## Steps

// turbo
1. Run the combined check (lint + format with auto-fix):
```bash
npm run check
```

This runs `biome check --write .` which:
- Checks for linting issues
- Checks for formatting issues
- Auto-fixes what it can

## Alternative Commands

// turbo
- Check for issues without fixing:
```bash
npm run lint
```

// turbo
- Format code only:
```bash
npm run format
```

// turbo
- Fix linting issues only:
```bash
npm run lint:fix
```

## Notes

- Always run `npm run check` before committing
- Biome is configured in `biome.json`
- Uses 2-space indentation and single quotes
