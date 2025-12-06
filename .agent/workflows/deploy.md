---
description: Deploy to GitHub Pages
---

# Deploy to GitHub Pages

This workflow builds the production bundle and deploys it to GitHub Pages.

## Steps

// turbo
1. Build the production bundle:
```bash
npm run build
```

2. Deploy to GitHub Pages:
```bash
npm run deploy
```

The `deploy` script runs `vite build && gh-pages -d dist`, which:
- Builds the optimized production bundle to `dist/`
- Pushes the `dist/` folder to the `gh-pages` branch
- GitHub Pages serves the content from that branch

## Notes

- Ensure you have push access to the repository
- The first deploy may take a few minutes to propagate
- Check deployment status at: https://github.com/IraGraves/white-rabbit/deployments
