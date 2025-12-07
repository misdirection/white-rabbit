---
description: Standard commit workflow
---

# Commit and Push Changes

Standard workflow for committing and pushing changes to the repository.

## Steps

1. Stage changes:
```bash
git add .
```

2. Commit with a descriptive message:
```bash
git commit -m "feat: Description of changes"
```

3. Push to remote:
```bash
git push
```

## Commit Message Format

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style/formatting
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `chore:` - Maintenance tasks

## Notes

- Use clear, descriptive commit messages
- Reference issue numbers when applicable: `fix: Resolve #123`
