# Migration Guide: v3 → v4

## Overview

v4 is a major release that changes the **default directory scope** from user-level to project-level inside Git repositories. It also adds the `acs download` subcommand and `_from` provenance tracking.

### What's New in v4

- **Project-level by default** — Inside a Git repo, `acs` now uses `<repo>/.claude/` instead of `~/.claude/`
- **`-g` / `--global` option** — Force user-level (global) directories, like v3 behavior
- **`acs download`** — Download skills directly from GitHub
- **`_from` provenance** — Track where commands and skills originated
- **`acs status` improvements** — User/Project level stats with agent counts

---

## Breaking Change: Project-Level Directories

### Before (v3)

All commands defaulted to user-level directories:

```bash
acs sync -s claude -d gemini    # Always used ~/.claude/ → ~/.gemini/
```

### After (v4)

Inside a Git repository, project-level directories are used by default:

```bash
acs sync -s claude -d gemini    # Uses <repo>/.claude/ → <repo>/.gemini/
acs sync -s claude -d gemini -g # Uses ~/.claude/ → ~/.gemini/ (v3 behavior)
```

Outside a Git repository, behavior is unchanged (user-level).

### Directory Resolution Priority

```
1. --{agent}-dir (custom directory, highest priority)
2. Project-level (Git repo root, default when inside a repo)
3. User-level (global, default outside a repo or with -g)
```

### Project-Level Directories by Agent

| Agent | Project-level | User-level (`-g`) |
|-------|--------------|-------------------|
| Claude | `<repo>/.claude/` | `~/.claude/` |
| Gemini | `<repo>/.gemini/` | `~/.gemini/` |
| Codex | `<repo>/.codex/` | `~/.codex/` |
| OpenCode | `<repo>/.opencode/` | `~/.config/opencode/` |
| Copilot | `<repo>/.github/` | `~/.copilot/` |
| Cursor | `<repo>/.cursor/` | `~/.cursor/` |
| Chimera | `<repo>/.acs/` | `~/.config/acs/` |

### Mode Display

The output now shows the active mode:

```
Starting claude → gemini conversion... [project: /path/to/repo]
Starting claude → gemini conversion... [global]
```

---

## `-g` / `--global` Option

The `-g` (or `--global`) option forces user-level directory resolution, restoring v3 default behavior. Available on all subcommands:

```bash
acs sync -s claude -d gemini -g
acs import claude -g
acs apply gemini -g
acs drift claude -g
acs plan gemini -g
acs status -g
acs download <url> -d claude -g
```

---

## `acs download` Subcommand

Download skills directly from GitHub repositories:

```bash
# Download to project-level directory (inferred from URL path)
acs download https://github.com/owner/repo/tree/main/.claude/skills/my-skill

# Download to a specific agent's skill directory
acs download <url> -d gemini

# Download to global (user-level) directory (requires -d)
acs download <url> -d claude -g

# Dry run
acs download <url> -n
```

### Supported URL formats

- **Directory**: `https://github.com/owner/repo/tree/branch/path/to/skill`
- **File**: `https://github.com/owner/repo/blob/branch/path/to/file` (parent directory auto-detected)

### Authentication

Set `GITHUB_TOKEN` environment variable to avoid GitHub API rate limits (optional).

---

## `_from` Provenance Tracking

Commands and skills now track their origin via the `_from` frontmatter property:

- **During sync**: The GitHub remote URL of the source repository is appended (if available)
- **During download**: The download URL is injected into `SKILL.md`

```yaml
---
description: My command
_from:
  - https://github.com/owner/repo
---
```

- Stored as an array of URLs (duplicates are not added)
- Preserved across conversions via `SemanticIR`
- Not removed by `--remove-unsupported`
- Note: Lost when converting to Cursor commands (no frontmatter support)

---

## `acs status` Improvements

### v3

```
        .──────────────────────.
       (  3 commands, 2 skills  )
        '-.────────────────────'
```

### v4

Shows User/Project level stats with agent counts:

**Inside a Git repo (2 lines):**
```
        .───────────────────────────────────────────.
       (  User:    3 commands, 2 skills (2 agents)   )
       (  Project: 8 commands, 5 skills (4 agents)   )
        '-.─────────────────────────────────────────'
```

**Outside a Git repo (1 line):**
```
        .──────────────────────────────────────.
       (  User: 3 commands, 2 skills (2 agents) )
        '-.────────────────────────────────────'
```

Chimera level is now based on actual detected agents across directories.

---

## API Breaking Changes

If you use `agent-command-sync` as a library:

| v3 | v4 |
|----|-----|
| `resolveCommandDir()` returns `{ project, user }` | Returns a single resolved `string` |
| `resolveSkillDir()` returns `{ project, user }` | Returns a single resolved `string` |

The `DirResolutionContext` type is used to control which directory is resolved.

---

## Quick Migration Checklist

1. **If you relied on user-level directories inside Git repos**: Add `-g` to your commands
2. **Scripts or aliases**: Update any automation that assumed user-level directories
3. Explore `acs download` for easy skill sharing
4. Run `acs status` to see User/Project level overview
