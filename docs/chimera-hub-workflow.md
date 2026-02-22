# Chimera Hub Workflow

## Overview

Chimera is a virtual agent that acts as a lossless conversion hub. It preserves all agent-specific settings (e.g., `model`, `allowed-tools`) in `_chimera.{agent}` frontmatter sections, enabling round-trip fidelity across agents.

## Architecture

```
                        ┌──────────────────┐
                        │  Chimera (Hub)   │
                        │ ~/.config/acsync │
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

    ▲  acs import <agent>    agent → chimera            (shorthand for: acs sync -s <agent> -d chimera)
    ▲  acs drift  <agent>    agent → chimera, dry run   (shorthand for: acs sync -s <agent> -d chimera -n)
    ▼  acs apply  <agent>    chimera → agent            (shorthand for: acs sync -s chimera -d <agent>)
    ▼  acs plan   <agent>    chimera → agent, dry run   (shorthand for: acs sync -s chimera -d <agent> -n)
    ◄► acs sync -s X -d Y   direct conversion between agents
```

## Commands

| Command | Direction | Description |
|---------|-----------|-------------|
| `acs import <agent>` | agent → chimera | Import commands/skills into the hub |
| `acs drift <agent>` | agent → chimera | Preview import changes (dry run) |
| `acs apply <agent>` | chimera → agent | Apply hub commands/skills to an agent |
| `acs plan <agent>` | chimera → agent | Preview apply changes (dry run) |
| `acs sync -s X -d Y` | agent → agent | Direct conversion (bypasses hub) |

## Typical Workflow

```bash
# 1. Import from multiple agents into Chimera hub
acs import claude
acs import gemini

# 2. Preview what would change before applying
acs plan codex

# 3. Apply to target agents
acs apply codex
acs apply claude
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

- `acs apply claude` → restores `allowed-tools`, `model`, `argument-hint`
- `acs apply gemini` → restores `some-gemini-field`
- `acs apply codex` → no extras (semantic fields only)
