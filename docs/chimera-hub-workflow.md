# Chimera Hub Workflow

## Overview

Chimera Hub is a lossless conversion hub. It preserves all agent-specific settings (e.g., `model`, `allowed-tools`) in `_chimera.{agent}` frontmatter sections, enabling round-trip fidelity across agents.

## Architecture

```
                        ┌──────────────────┐
                        │  Chimera (Hub)   │
                        │    ~/.config/asp       │
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

    ▲  asp import <agent>    agent → chimera            (shorthand for: asp sync <agent> chimera)
    ▲  asp drift  <agent>    agent → chimera, dry run   (shorthand for: asp sync <agent> chimera -n)
    ▼  asp apply  <agent>    chimera → agent            (shorthand for: asp sync chimera <agent>)
    ▼  asp plan   <agent>    chimera → agent, dry run   (shorthand for: asp sync chimera <agent> -n)
    ◄► asp sync X Y          direct conversion between agents
```

## Commands

| Command | Direction | Description |
|---------|-----------|-------------|
| `asp import <agent>` | agent → chimera | Import commands/skills into the hub |
| `asp drift <agent>` | agent → chimera | Preview import changes (dry run) |
| `asp apply <agent>` | chimera → agent | Apply hub commands/skills to an agent |
| `asp plan <agent>` | chimera → agent | Preview apply changes (dry run) |
| `asp sync X Y` | agent → agent | Direct conversion (bypasses hub) |

## Typical Workflow

```bash
# 1. Import from multiple agents into Chimera hub
asp import claude
asp import gemini

# 2. Preview what would change before applying
asp plan codex

# 3. Apply to target agents
asp apply codex
asp apply claude
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

- `asp apply claude` → restores `allowed-tools`, `model`, `argument-hint`
- `asp apply gemini` → restores `some-gemini-field`
- `asp apply codex` → no extras (semantic fields only)
