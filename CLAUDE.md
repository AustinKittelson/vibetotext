# VibeToText Project Instructions

See global `../CLAUDE.md` for Python environment setup.

## Process Management

### Rule 1: Always Force Kill
Always use `-9` (SIGKILL) when killing processes:
```bash
pkill -9 -f "vibetotext"
```

### Rule 2: Only Kill Specific Processes
**NEVER use broad patterns** like `pkill -f "python"` or `pkill -f "Electron"`.

**ALWAYS use the specific app name:**
```bash
pkill -9 -f "vibetotext"
```

This ensures only vibetotext is killed, not other Python or Electron processes running on the system.
