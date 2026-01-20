# VibeToText Project Instructions

See global `../CLAUDE.md` for Python environment setup.

## Process Management

### Rule 1: Always Force Kill
Always use `-9` (SIGKILL) when killing processes.

### Rule 2: Kill by Specific Pattern
| Service | Kill Command |
|---------|--------------|
| VibeToText (main) | `pkill -9 -f "vibetotext"` (but NOT if it matches history-app) |
| VibeToText History App | `pkill -9 -f "vibetotext/history-app"` |

To kill only the main vibetotext process without the history app:
```bash
pkill -9 -f "python.*vibetotext"
```

To kill only the history Electron app:
```bash
pkill -9 -f "vibetotext/history-app"
```

### Rule 3: NEVER Use Broad Patterns
**NEVER use patterns** like `pkill -f "python"` or `pkill -f "Electron"` - these kill unrelated processes.
