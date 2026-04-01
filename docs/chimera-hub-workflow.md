# Chimera Hub Workflow

<div align="center"> en | <a href="chimera-hub-workflow_ja.md">ja</a> </div>

## Overview

Chimera Hub is a lossless conversion hub. It preserves all agent-specific settings (e.g., `model`, `allowed-tools`) in `_chimera.{agent}` frontmatter sections, enabling round-trip fidelity across agents.

## Architecture

```
                        ┌──────────────────┐
                        │  Chimera (Hub)   │
                        │ ~/.config/agent-skill-porter │
                        └────────┬─────────┘
                  ┌──────────────┴───────────────┐
                ▲ │                              │ ▲
   import/drift │ │ │                          │ │ │ import/drift
                │ │ │ apply/plan    apply/plan │ │ │
                  │ ▼                          ▼ │
         ┌────────┘                              └────────┐
         │                                                │
  ┌──────┴─────────┐                           ┌──────────┴───┐
  │  Claude Code   │   ◄────── sync ──────►    │  Codex CLI   │  ┌───┐  ┌───┐  ┌───┐
  │   ~/.claude    │                           │  ~/.codex    │  │   │  │   │  │   │  ...
  └────────────────┘                           └──────────────┘  └───┘  └───┘  └───┘

    ▲  sk import <agent>     agent → chimera            (shorthand for: sk sync <agent> chimera)
    ▲  sk drift  <agent>     agent → chimera, dry run   (shorthand for: sk sync <agent> chimera -n)
    ▼  sk apply  <agent>     chimera → agent            (shorthand for: sk sync chimera <agent>)
    ▼  sk plan   <agent>     chimera → agent, dry run   (shorthand for: sk sync chimera <agent> -n)
    ◄► sk sync X Y           direct conversion between agents
```

## Commands

| Command | Direction | Description |
|---------|-----------|-------------|
| `sk import <agent>` | agent → chimera | Import commands/skills into the hub |
| `sk drift <agent>` | agent → chimera | Preview import changes (dry run) |
| `sk apply <agent>` | chimera → agent | Apply hub commands/skills to an agent |
| `sk plan <agent>` | chimera → agent | Preview apply changes (dry run) |
| `sk sync X Y` | agent → agent | Direct conversion (bypasses hub) |

## Typical Workflow

```bash
# 1. Import from multiple agents into Chimera hub
sk import claude
sk import gemini

# 2. Preview what would change before applying
sk plan codex

# 3. Apply to target agents
sk apply codex
sk apply claude
```

## How Chimera Preserves Extras

When importing from Claude, agent-specific fields are stored under `_chimera.claude`:

```yaml
---
description: "Review code"
_chimera:
  claude:
    allowed-tools: "Read,Write,Bash"
    model: "opus-4"
    argument-hint: "file path"
  gemini:
    some-gemini-field: value
---
Review $ARGUMENTS and suggest improvements.
```

When applying to a specific agent, only that agent's extras are restored:

- `sk apply claude` → restores `allowed-tools`, `model`, `argument-hint`
- `sk apply gemini` → restores `some-gemini-field`
- `sk apply codex` → no extras (semantic fields only)
