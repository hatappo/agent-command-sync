# Migration Guide: v2 → v3

## Overview

v3 is a major release that introduces a subcommand-based CLI, the Chimera lossless conversion hub, and support for GitHub Copilot and Cursor. If you are upgrading from v2, the most important change is that **the CLI now uses subcommands**.

### What's New in v3

- **Subcommand CLI** — `acs sync`, `acs import`, `acs apply`, `acs drift`, `acs plan`, `acs status`, `acs version`
- **Chimera Hub** — A virtual agent for lossless round-trip conversion ([details](chimera-hub-workflow.md))
- **GitHub Copilot support** — `.prompt.md` with YAML frontmatter
- **Cursor support** — Plain Markdown (no frontmatter)
- **`acs status`** — Show Chimera hub status with ASCII art
- **`acs version`** — Display the current version

---

## CLI Command Changes

### Direct conversion

| v2 | v3 |
|----|-----|
| `acs -s claude -d gemini` | `acs sync -s claude -d gemini` |
| `acs -s claude -d gemini -t commands` | `acs sync -s claude -d gemini -t commands` |
| `acs -s claude -d gemini -n` | `acs sync -s claude -d gemini -n` |
| `acs -s claude -d gemini --remove-unsupported` | `acs sync -s claude -d gemini --remove-unsupported` |
| `acs -s claude -d gemini --no-overwrite` | `acs sync -s claude -d gemini --no-overwrite` |
| `acs -s claude -d gemini --sync-delete` | `acs sync -s claude -d gemini --sync-delete` |
| `acs -s claude -d gemini -f my-cmd` | `acs sync -s claude -d gemini -f my-cmd` |

In short: prepend `sync` after `acs`. All existing options continue to work under `acs sync`.

### New subcommands (Chimera hub workflow)

These are shorthand subcommands for working with the Chimera hub:

| Subcommand | Equivalent | Description |
|------------|------------|-------------|
| `acs import claude` | `acs sync -s claude -d chimera` | Import into Chimera hub |
| `acs drift claude` | `acs sync -s claude -d chimera -n` | Preview import (dry run) |
| `acs apply gemini` | `acs sync -s chimera -d gemini` | Apply Chimera hub to agent |
| `acs plan gemini` | `acs sync -s chimera -d gemini -n` | Preview apply (dry run) |

### New utility subcommands

| Subcommand | Description |
|------------|-------------|
| `acs status` | Show Chimera hub status, detected agents, and ASCII art |
| `acs version` | Display version number |

---

## Option Availability by Subcommand

| Option | `sync` | `import` | `drift` | `apply` | `plan` |
|--------|--------|----------|---------|---------|--------|
| `-t, --type` | Yes | Yes | Yes | Yes | Yes |
| `-f, --file` | Yes | Yes | Yes | Yes | Yes |
| `-v, --verbose` | Yes | Yes | Yes | Yes | Yes |
| `--remove-unsupported` | Yes | - | - | Yes | Yes |
| `--no-overwrite` | Yes | - | - | Yes | - |
| `--sync-delete` | Yes | - | - | Yes | - |
| `-n, --noop` | Yes | - | - | - | - |
| `--<agent>-dir` | Yes | Yes | Yes | Yes | Yes |

> `drift` and `plan` are inherently dry-run modes, so `-n` is not needed.
> `import` always targets Chimera, so `--remove-unsupported` and `--sync-delete` are not applicable.

---

## Chimera Hub

The Chimera hub is a virtual agent introduced in v3 that stores converted files at `~/.config/chimera-agent/`. It preserves **all** agent-specific settings losslessly in `_chimera.{agent}` frontmatter sections.

### Recommended workflow

```bash
# 1. Import from each agent into the hub
acs import claude
acs import gemini

# 2. Apply from the hub to each agent
acs apply claude    # Restores Claude-specific settings
acs apply gemini    # Restores Gemini-specific settings
```

For more details, see [Chimera Hub Workflow](chimera-hub-workflow.md).

---

## New Agent Support

### GitHub Copilot

- File format: `.prompt.md` with YAML frontmatter
- Location: `~/.copilot/prompts/`
- Skills: `~/.copilot/skills/<name>/SKILL.md`
- Note: Uses `user-invokable` (with **k**) instead of Claude's `user-invocable` (with **c**); automatically normalized during conversion

### Cursor

- File format: Plain Markdown (no frontmatter)
- Location: `~/.cursor/commands/`
- Skills: `~/.cursor/skills/<name>/SKILL.md`
- Note: All command metadata is lost when converting to Cursor (no frontmatter support)

---

## Dry-Run Message Changes

In v2, the `--noop` flag always displayed:

> This was a dry run. Use without --noop to apply changes.

In v3, the message is context-aware:

| Subcommand | Message |
|------------|---------|
| `acs drift` | "This was a dry run. Use `acs import` to apply changes." |
| `acs plan` | "This was a dry run. Use `acs apply` to apply changes." |
| `acs sync -n` | "This was a dry run. Use without --noop to apply changes." |

---

## Quick Migration Checklist

1. Replace `acs -s <src> -d <dest>` with `acs sync -s <src> -d <dest>`
2. Consider adopting the Chimera hub workflow (`import` / `apply`) for multi-agent setups
3. Explore `acs status` to see your hub state
