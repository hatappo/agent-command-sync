<div align="center"> en | <a href="README_ja.md">ja</a> </div>

--------------------------------------------------------------------------------

# ASP / agent-skill-porter

[![npm version](https://badge.fury.io/js/agent-skill-porter.svg)](https://www.npmjs.com/package/agent-skill-porter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A skill lifecycle management CLI for AI agents — Download and manage updates for any Skill, and convert formats across Claude Code and many other agents. Zero config, no extra files needed.

<div align="center">
  <img src="demo/acs-demo.svg" alt="ASP Demo" width="800">
</div>

## CHANGELOG

[CHANGELOG.md](CHANGELOG.md)

## Installation

```bash
npm install -g agent-skill-porter
```

> **Note:** The `acs` and `agent-command-sync` commands are still available as deprecated aliases.

## Quick Start

### Download a skill from GitHub

```bash
# Download a specific skill to your project (to ./skills/skill-creator/)
asp download https://github.com/anthropics/skills/tree/main/skills/skill-creator

# Download all skills from a repository
asp download https://github.com/anthropics/skills

# Place into a specific agent's directory (to ./.gemini/skills/)
asp download https://github.com/anthropics/skills gemini

# Place into user-level (global) directory (to ~/.claude/skills/)
asp download https://github.com/anthropics/skills claude -g

# Preview only, without downloading
asp download https://github.com/anthropics/skills -n
```

### Reformat and relocate skills for other agents

```bash
# Convert skill format and placement from Claude to Gemini
asp sync claude gemini

# Convert in both directions
asp sync gemini claude

# Convert skills in user-level (global) directories
asp sync gemini claude -g

# Preview changes before applying
asp sync gemini claude -n
```

## Supported Agents

| Agent | Skills | Commands | Placeholders |
| ----- |:------:|:--------:|:------------:|
| Claude Code | ✓ | ✓ | ✓ |
| Gemini CLI | ✓ | ✓ | ✓ |
| Codex CLI | ✓ | ✓ | ✓ |
| OpenCode | ✓ | ✓ | ✓ |
| GitHub Copilot | ✓ | ✓ | - |
| Cursor | ✓ | ✓ | - |
| Chimera Hub | ✓ | ✓ | ✓ |

## Features

- **Download from GitHub** — Fetch skills directly from GitHub repositories with `asp download`
- **Update from Upstream** — Check and apply upstream changes to downloaded skills with `asp update`
- **List Skills** — List all skills across agents with `asp list`
- **Skill Info** — View skill metadata and source links with `asp info`
- **Provenance Tracking** — Every download and sync records the source in `_from` (as `owner/repo@shortHash`, 7-char SHA by default; use `--full-hash` for full 40-char SHA). If a public skill is found to be compromised, trace affected local skills instantly. Disable with `--no-provenance`
- **Cross-Agent Conversion** — Convert skill formats and placement across 7 agents, absorbing format differences automatically
- **Placeholder Conversion** — `$ARGUMENTS` ↔ `{{args}}`, file references, shell commands auto-converted
- **Dry-Run Preview** — Preview changes with `-n` before applying them
- **Lossless Conversion — Chimera Hub** — Preserves all agent-specific settings across round-trip conversions ([details](docs/chimera-hub-workflow.md))

## Subcommands

### `asp download <url> [to]` (alias: `asp dl`) — Download a skill from GitHub

```bash
asp download https://github.com/anthropics/skills/tree/main/skills/skill-creator
asp download <url> gemini                  # Place in Gemini skill directory
asp download <url> claude -g               # Place in global Claude directory
asp download <url> -n                      # Preview without downloading
```

#### GitHub Authentication

For private repositories, set a [personal access token](https://github.com/settings/tokens?type=beta):

```bash
export GITHUB_TOKEN=ghp_...
```

**Token permissions**: Public repositories require no permissions. For private repositories, grant **Contents: Read** access to the target repository.

### `asp update [skill-path]` — Update downloaded skills from upstream

```bash
asp update                                 # Check and update all agent skills
asp update .claude/skills/my-skill         # Update a specific skill
asp update skills/                         # Update all skills under a path
asp update -n                              # Check for updates without applying
```

### `asp list` (alias: `asp ls`) — List skills across all agents

```bash
asp list                                   # List project-level skills
asp list -g                                # List global (user-level) skills
```

### `asp info [skill-path]` — Show skill information

```bash
asp info                                   # Interactively select and view a skill
asp info .claude/skills/my-skill           # Show skill info and source links
asp info .claude/skills/my-skill/SKILL.md  # SKILL.md path also accepted
```

### `asp sync <from> <to>` — Direct conversion between agents

```bash
asp sync claude gemini                     # Convert Claude → Gemini
asp sync claude gemini -t commands          # Commands only
```

### `asp import <agent>` / `asp apply <agent>` — Lossless conversion workflow

```bash
asp import claude                          # Import Claude → Chimera Hub
asp import gemini -t commands              # Import commands only
asp apply gemini                           # Apply Chimera Hub → Gemini
asp apply claude --remove-unsupported      # Remove unsupported fields
```

### `asp drift <agent>` / `asp plan <agent>` — Preview (dry run)

```bash
asp drift claude                           # Preview import changes
asp plan gemini                            # Preview apply changes
```

### `asp migrate` — Migrate Chimera Hub directories from .acs to .asp

```bash
asp migrate                                # Rename .acs → .asp (user-level + project-level)
```

## Options (sync subcommand)

| Option                      | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `<from>`                    | **Required.** Source agent: `claude`, `gemini`, `codex`, `opencode`, `copilot`, `cursor`, or `chimera` |
| `<to>`                      | **Required.** Destination agent: `claude`, `gemini`, `codex`, `opencode`, `copilot`, `cursor`, or `chimera` |
| `-t, --type <type>`         | Content type: `skills`, `commands`, or `both` (default: `skills`)    |
| `-f, --file <filename>`     | Convert specific file only (supports `.md`, `.toml` extensions)      |
| `-g, --global`              | Use user-level (global) directories instead of project-level          |
| `-n, --noop`                | Preview changes without applying them                                 |
| `-v, --verbose`             | Show detailed debug information                                       |
| `--no-overwrite`            | Skip existing files in target directory                               |
| `--sync-delete`             | Delete orphaned files in target directory                             |
| `--remove-unsupported`      | Remove fields not supported by target format                          |
| `--no-provenance`           | Do not record source in `_from` frontmatter property                  |
| `--claude-dir <path>`       | Claude base directory (default: ~/.claude)                            |
| `--gemini-dir <path>`       | Gemini base directory (default: ~/.gemini)                            |
| `--codex-dir <path>`        | Codex base directory (default: ~/.codex)                              |
| `--opencode-dir <path>`     | OpenCode base directory (default: ~/.config/opencode)                 |
| `--copilot-dir <path>`      | Copilot base directory (default: ~/.copilot)                          |
| `--cursor-dir <path>`       | Cursor base directory (default: ~/.cursor)                            |
| `--chimera-dir <path>`      | Chimera Hub base directory (default: ~/.config/asp)                   |

## Examples

```bash
# Direct conversion with preview
asp sync claude gemini -n

# Convert specific file
asp sync gemini claude -f analyze-code

# Chimera hub workflow
asp import claude                          # Import Claude → Chimera
asp import gemini                          # Import Gemini → Chimera (merges)
asp apply claude                           # Apply Chimera → Claude (with Claude extras)
asp apply gemini                           # Apply Chimera → Gemini (with Gemini extras)

# Full sync with cleanup
asp sync claude gemini --sync-delete --remove-unsupported

# Use custom directories
asp sync claude gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# Show verbose output for debugging
asp sync claude gemini -v
```

## Directory Resolution

When running inside a Git repository, `asp` defaults to **project-level** directories (e.g., `<repo>/.claude`, `<repo>/.gemini`). Use `-g`/`--global` to use user-level directories instead.

**Priority order:**
1. `--{agent}-dir` (custom directory) — always takes precedence
2. **Project-level** — default when inside a Git repository
3. **User-level** — default when outside a Git repository, or when `-g` is specified

### Project-level (default inside Git repos)

| Agent | Commands | Skills |
| ----- | -------- | ------ |
| **Claude Code** | `<repo>/.claude/commands/*.md` | `<repo>/.claude/skills/<name>/SKILL.md` |
| **Gemini CLI** | `<repo>/.gemini/commands/*.toml` | `<repo>/.gemini/skills/<name>/SKILL.md` |
| **Codex CLI** | `<repo>/.codex/prompts/*.md` | `<repo>/.codex/skills/<name>/SKILL.md` |
| **OpenCode** | `<repo>/.config/opencode/commands/*.md` | `<repo>/.config/opencode/skills/<name>/SKILL.md` |
| **GitHub Copilot** | `<repo>/.copilot/prompts/*.prompt.md` | `<repo>/.copilot/skills/<name>/SKILL.md` |
| **Cursor** | `<repo>/.cursor/commands/*.md` | `<repo>/.cursor/skills/<name>/SKILL.md` |
| **Chimera** | `<repo>/.asp/commands/*.md` | `<repo>/.asp/skills/<name>/SKILL.md` |

### User-level (with `-g` or outside Git repos)

| Agent | Commands | Skills |
| ----- | -------- | ------ |
| **Claude Code** | `~/.claude/commands/*.md` | `~/.claude/skills/<name>/SKILL.md` |
| **Gemini CLI** | `~/.gemini/commands/*.toml` | `~/.gemini/skills/<name>/SKILL.md` |
| **Codex CLI** | `~/.codex/prompts/*.md` | `~/.codex/skills/<name>/SKILL.md` |
| **OpenCode** | `~/.config/opencode/commands/*.md` | `~/.config/opencode/skills/<name>/SKILL.md` |
| **GitHub Copilot** | `~/.copilot/prompts/*.prompt.md` | `~/.copilot/skills/<name>/SKILL.md` |
| **Cursor** | `~/.cursor/commands/*.md` | `~/.cursor/skills/<name>/SKILL.md` |
| **Chimera** | `~/.config/asp/commands/*.md` | `~/.config/asp/skills/<name>/SKILL.md` |

## Skills Format

Skills follow the [Agent Skills](https://agentskills.io/) open standard adopted by Claude Code, Gemini CLI, Codex CLI, OpenCode, and Cursor.

### Directory Structure

Each skill is a directory containing `SKILL.md` and optional support files:

```
~/.claude/skills/
└── my-skill/
    ├── SKILL.md           # Main skill definition (required)
    ├── helper.sh          # Support file (optional)
    └── config.json        # Support file (optional)
```

### SKILL.md Format

All tools use the same `SKILL.md` format with YAML frontmatter:

```markdown
---
name: my-skill
description: A helpful skill description
---

Skill instructions go here.

Use $ARGUMENTS for user input.
```

### Skill Metadata Comparison

| Field | Claude Code | Gemini CLI | Codex CLI | OpenCode | Copilot | Cursor | Conversion Notes |
| ----- | ----------- | ---------- | --------- | -------- | ------- | ------ | ---------------- |
| `name` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Required |
| `description` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Preserved |
| `argument-hint` | ✓ | - | - | - | ✓ | - | Claude/Copilot |
| `allowed-tools` | ✓ | - | - | - | - | ✓ | Claude/Cursor (agentskills.io) |
| `model` | ✓ | - | - | - | - | - | Claude-specific |
| `context` | ✓ | - | - | - | - | - | Claude-specific (e.g., `"fork"`) |
| `agent` | ✓ | - | - | - | - | - | Claude-specific |
| `hooks` | ✓ | - | - | - | - | - | Claude-specific (before/after/on_error) |
| `disable-model-invocation` | ✓ | - | ✓* | ✓** | ✓ | ✓ | Converted (see below) |
| `user-invocable` / `user-invokable` | ✓ | - | - | - | ✓*** | ✓ | Converted with spelling normalization |

\* Codex uses `policy.allow_implicit_invocation` in `agents/openai.yaml` (inverted logic)
\*\* OpenCode uses `disable-model-invocation` directly in SKILL.md frontmatter
\*\*\* Copilot uses `user-invokable` (with 'k') instead of Claude's `user-invocable` (with 'c'); automatically normalized during conversion

### Codex-Specific: agents/openai.yaml

Codex CLI supports an optional `agents/openai.yaml` configuration file:

```
~/.codex/skills/
└── my-skill/
    ├── SKILL.md
    └── agents/
        └── openai.yaml    # Codex-specific configuration
```

Example `openai.yaml`:
```yaml
interface:
  display_name: "My Skill"
  short_description: "A skill description"
policy:
  allow_implicit_invocation: true
```

#### Model Invocation Control Conversion

The `policy.allow_implicit_invocation` field in Codex is converted to/from Claude's `disable-model-invocation` with inverted logic:

| Claude Code | Codex CLI (`openai.yaml`) |
| ----------- | ------------------------- |
| `disable-model-invocation: true` | `policy.allow_implicit_invocation: false` |
| `disable-model-invocation: false` | `policy.allow_implicit_invocation: true` |

When converting Claude → Codex with `disable-model-invocation` set, an `agents/openai.yaml` file is automatically generated.

Other `openai.yaml` fields (`interface.display_name`, `interface.short_description`) are Codex-specific and not converted.

### Support Files

Support files (scripts, configs, images, etc.) are copied as-is during conversion:

| File Type | Examples | Handling |
| --------- | -------- | -------- |
| Text | `.sh`, `.py`, `.json`, `.yaml` | Copied as-is |
| Binary | `.png`, `.jpg`, `.pdf` | Copied as-is |
| Config | `openai.yaml` | Codex-specific, ignored for other targets |

### Placeholder Conversion (Skills)

Same as [Commands](docs/advanced.md#content-placeholders-and-syntax):

| Feature | Claude Code / Codex CLI / OpenCode | Gemini CLI | Copilot | Cursor |
| ------- | ---------------------------------- | ---------- | ------- | ------ |
| All arguments | `$ARGUMENTS` | `{{args}}` | Not supported | Not supported |
| Individual arguments | `$1` ... `$9` | Not supported | Not supported | Not supported |
| Shell command | `` !`command` `` | `!{command}` | Not supported | Not supported |
| File reference | `@path/to/file` | `@{path/to/file}` | Not supported | Not supported |

## Advanced Reference

For detailed documentation on the following topics, see [Advanced Reference](docs/advanced.md):

- **Lossless Conversion — Chimera Hub** — Preserves all agent-specific settings across round-trip conversions ([details](docs/chimera-hub-workflow.md))
- **Commands** — Single-file slash command format details, metadata comparison, and placeholder syntax
- **Architecture** — Semantic IR design, body tokenization, and source layout

---

## Official Documents

### Commands
- [Slash commands - Claude Docs](https://docs.claude.com/en/docs/claude-code/slash-commands)
- [gemini-cli/docs/cli/custom-commands.md at main · google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md)
- [codex/docs/prompts.md at main · openai/codex](https://github.com/openai/codex/blob/main/docs/prompts.md)
- [OpenCode](https://opencode.ai/)
- [Custom instructions for GitHub Copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)

### Skills
- [Agent Skills Standard](https://agentskills.io/)
- [Custom skills - Claude Docs](https://docs.claude.com/en/docs/claude-code/custom-skills)

## Status Indicators

- `[A]` Created (Green) - New files created in target directory
- `[M]` Modified (Yellow) - Existing files updated
- `[=]` Unchanged (Blue) - File exists and converted content is identical
- `[D]` Deleted (Red) - Files removed with `--sync-delete`
- `[-]` Skipped (Gray) - Files skipped with `--no-overwrite`

## Requirements

- Node.js >= 24.0.0
- npm or compatible package manager

## Development

See [Development Guide](docs/development.md) for build, test, lint, and publishing instructions.

## License

MIT
