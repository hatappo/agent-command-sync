<div align="center"> en | <a href="README_ja.md">ja</a> </div>

--------------------------------------------------------------------------------

# agent-command-sync

[![npm version](https://badge.fury.io/js/agent-command-sync.svg)](https://www.npmjs.com/package/agent-command-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A skill package manager for AI coding agents — Download, update, and sync Skills across Claude Code, Gemini CLI, Codex CLI, OpenCode, GitHub Copilot, and Cursor. Zero config, no extra files needed.

## CHANGELOG

[CHANGELOG.txt](CHANGELOG.txt)

## Installation

```bash
npm install -g agent-command-sync
```

## Quick Start

### Download a skill from GitHub

```bash
# Download a specific skill to your project (to ./skills/skill-creator/)
acs download https://github.com/anthropics/skills/tree/main/skills/skill-creator

# Download all skills from a repository
acs download https://github.com/anthropics/skills

# Place into a specific agent's directory (to ./.gemini/skills/)
acs download https://github.com/anthropics/skills gemini

# Place into user-level (global) directory (to ~/.claude/skills/)
acs download https://github.com/anthropics/skills claude -g

# Preview only, without downloading
acs download https://github.com/anthropics/skills -n
```

![acs download and update](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acs-download.png)

### Reformat and relocate skills for other agents

```bash
# Convert skill format and placement from Claude to Gemini
acs sync claude gemini

# Convert in both directions
acs sync gemini claude

# Convert skills in user-level (global) directories
acs sync gemini claude -g

# Preview changes before applying
acs sync gemini claude -n
```

![acs sync example](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acsync-example.png)

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

- **Download from GitHub** — Fetch skills directly from GitHub repositories with `acs download`
- **Update from Upstream** — Check and apply upstream changes to downloaded skills with `acs update`
- **Provenance Tracking** — Every download and sync records the source in `_from` (as `owner/repo@treeHash`). If a public skill is found to be compromised, trace affected local skills instantly. Disable with `--no-provenance`
- **Cross-Agent Conversion** — Convert skill formats and placement across 7 agents, absorbing format differences automatically
- **Placeholder Conversion** — `$ARGUMENTS` ↔ `{{args}}`, file references, shell commands auto-converted
- **Dry-Run Preview** — Preview changes with `-n` before applying them
- **Chimera Hub** — Lossless conversion hub that preserves all agent-specific settings ([details](docs/chimera-hub-workflow.md))

> **Upgrading from v5.2?** v5.3.0 adds the `acs update` subcommand and appends tree hashes to `_from` (`owner/repo@treeHash`). See [CHANGELOG.txt](CHANGELOG.txt).
>
> **Upgrading from v5.1?** v5.2.0 changes `_from` format from full GitHub URL to `owner/repo`. See [CHANGELOG.txt](CHANGELOG.txt).
>
> **Upgrading from v3?** v4.0.0 changes the default directory scope. See [CHANGELOG.txt](CHANGELOG.txt) for breaking changes.
>
> **Upgrading from v2?** See the [Migration Guide](docs/migration-v2-to-v3.md).

## Subcommands

### `acs download <url> [to]` — Download a skill from GitHub

```bash
acs download https://github.com/anthropics/skills/tree/main/skills/skill-creator
acs download <url> gemini                  # Place in Gemini skill directory
acs download <url> claude -g               # Place in global Claude directory
acs download <url> -n                      # Preview without downloading
```

#### GitHub Authentication

For private repositories, set a [personal access token](https://github.com/settings/tokens?type=beta):

```bash
export GITHUB_TOKEN=ghp_...
```

**Token permissions**: Public repositories require no permissions. For private repositories, grant **Contents: Read** access to the target repository.

### `acs update [skill-path]` — Update downloaded skills from upstream

```bash
acs update                                 # Check and update all agent skills
acs update .claude/skills/my-skill         # Update a specific skill
acs update skills/                         # Update all skills under a path
acs update -n                              # Check for updates without applying
```

### `acs sync <from> <to>` — Direct conversion between agents

```bash
acs sync claude gemini                     # Convert Claude → Gemini
acs sync claude gemini -t commands          # Commands only
```

### `acs import <agent>` / `acs apply <agent>` — Lossless conversion workflow

```bash
acs import claude                          # Import Claude → Chimera Hub
acs import gemini -t commands              # Import commands only
acs apply gemini                           # Apply Chimera Hub → Gemini
acs apply claude --remove-unsupported      # Remove unsupported fields
```

### `acs drift <agent>` / `acs plan <agent>` — Preview (dry run)

```bash
acs drift claude                           # Preview import changes
acs plan gemini                            # Preview apply changes
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
| `--chimera-dir <path>`      | Chimera Hub base directory (default: ~/.config/acs)                   |

## Examples

```bash
# Direct conversion with preview
acs sync claude gemini -n

# Convert specific file
acs sync gemini claude -f analyze-code

# Chimera hub workflow
acs import claude                          # Import Claude → Chimera
acs import gemini                          # Import Gemini → Chimera (merges)
acs apply claude                           # Apply Chimera → Claude (with Claude extras)
acs apply gemini                           # Apply Chimera → Gemini (with Gemini extras)

# Full sync with cleanup
acs sync claude gemini --sync-delete --remove-unsupported

# Use custom directories
acs sync claude gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# Show verbose output for debugging
acs sync claude gemini -v
```

## Directory Resolution

When running inside a Git repository, `acs` defaults to **project-level** directories (e.g., `<repo>/.claude`, `<repo>/.gemini`). Use `-g`/`--global` to use user-level directories instead.

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
| **Chimera** | `<repo>/.acs/commands/*.md` | `<repo>/.acs/skills/<name>/SKILL.md` |

### User-level (with `-g` or outside Git repos)

| Agent | Commands | Skills |
| ----- | -------- | ------ |
| **Claude Code** | `~/.claude/commands/*.md` | `~/.claude/skills/<name>/SKILL.md` |
| **Gemini CLI** | `~/.gemini/commands/*.toml` | `~/.gemini/skills/<name>/SKILL.md` |
| **Codex CLI** | `~/.codex/prompts/*.md` | `~/.codex/skills/<name>/SKILL.md` |
| **OpenCode** | `~/.config/opencode/commands/*.md` | `~/.config/opencode/skills/<name>/SKILL.md` |
| **GitHub Copilot** | `~/.copilot/prompts/*.prompt.md` | `~/.copilot/skills/<name>/SKILL.md` |
| **Cursor** | `~/.cursor/commands/*.md` | `~/.cursor/skills/<name>/SKILL.md` |
| **Chimera** | `~/.config/acs/commands/*.md` | `~/.config/acs/skills/<name>/SKILL.md` |

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

Same as [Commands](docs/commands-reference.md):

| Feature | Claude Code / Codex CLI / OpenCode | Gemini CLI | Copilot | Cursor |
| ------- | ---------------------------------- | ---------- | ------- | ------ |
| All arguments | `$ARGUMENTS` | `{{args}}` | Not supported | Not supported |
| Individual arguments | `$1` ... `$9` | Not supported | Not supported | Not supported |
| Shell command | `` !`command` `` | `!{command}` | Not supported | Not supported |
| File reference | `@path/to/file` | `@{path/to/file}` | Not supported | Not supported |

## Advanced: Chimera Hub

Chimera Hub is a lossless conversion hub that preserves all agent-specific settings. Repeated direct conversions between agents may lose agent-specific fields (e.g., Claude's `allowed-tools`, Copilot's `tools`). Routing through Chimera Hub prevents this.

```bash
# Import from multiple agents (merges into hub)
acs import claude
acs import gemini

# Preview and apply
acs plan codex                             # Preview
acs apply codex                            # Apply
```

Hub files are stored in `~/.config/acs/` (global) or `<repo>/.acs/` (project).

For detailed workflow and examples, see [Chimera Hub Workflow](docs/chimera-hub-workflow.md).

## Commands

`acs` also supports converting single-file slash commands between agents. For command format details, metadata comparison, and placeholder syntax, see [Commands Reference](docs/commands-reference.md).

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

- Node.js >= 18.0.0
- npm or compatible package manager

## Architecture

### Semantic IR (Intermediate Representation)

All conversions go through a hub-and-spoke Semantic IR, eliminating the need for pairwise converters between every agent combination:

```
Source Format → Parser → toIR() → SemanticIR → fromIR() → Target Format
```

Each agent has a single class implementing all interfaces (`AgentConfig`, `BodyParser`, `CommandParser`, `CommandConverter`, `SkillParser`, `SkillConverter`). Adding a new agent requires only one agent class — not N converters for N existing agents.

### SemanticIR Structure

```typescript
interface SemanticIR {
  contentType: "command" | "skill";
  body: BodySegment[];                  // Tokenized body content
  semantic: SemanticProperties;         // Shared properties (description, name, from, etc.)
  extras: Record<string, unknown>;      // Agent-specific passthrough properties
  meta: SemanticMeta;                   // Conversion context (source path, type, etc.)
}
```

- **`semantic`** — Properties with shared meaning across agents (e.g., `description`). Agent classes map between agent-specific field names and semantic properties.
- **`extras`** — All other properties pass through unchanged. Agent-specific fields (e.g., Claude's `allowed-tools`) are preserved for round-trip fidelity and can be stripped with `--remove-unsupported`.
- **`body`** — Tokenized as `BodySegment[]` (an array of plain strings and semantic placeholders), so placeholder syntax conversion (e.g., `$ARGUMENTS` ↔ `{{args}}`) happens automatically within each agent's `commandToIR()`/`commandFromIR()`.

### Body Tokenization

Body content is parsed into an array of `BodySegment` elements — plain strings interleaved with typed `ContentPlaceholder` objects:

```typescript
type ContentPlaceholder =
  | { type: "arguments" }                // $ARGUMENTS / {{args}}
  | { type: "individual-argument"; index: 1-9 }  // $1-$9
  | { type: "shell-command"; command: string }    // !`cmd` / !{cmd}
  | { type: "file-reference"; path: string };     // @path / @{path}
```

Each agent defines its own body patterns and serializers colocated within its agent class file (`src/agents/claude.ts`, `src/agents/gemini.ts`, etc.). Claude, Codex, and OpenCode share the same placeholder syntax via a common module (`src/agents/_claude-syntax-body-patterns.ts`), while Codex marks unsupported placeholder types (shell-command, file-reference) for best-effort output. A type-driven serializer registry (`PlaceholderSerializers`) ensures compile-time exhaustiveness — adding a new placeholder type causes a type error until every agent implements it.

### Source Layout

```
src/
├── agents/             # Agent classes (one file per agent: parsing, conversion, body handling)
├── types/              # Type definitions (SemanticIR, BodySegment, agent formats)
├── utils/              # Shared utilities (file ops, validation, body parsing engine)
└── cli/                # CLI entry point and sync orchestration
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint and format code
npm run lint
npm run format

# Type check
npm run lint:tsc

# Development mode (watch)
npm run dev
```

### Publishing

```bash
# Check package contents
npm pack --dry-run

# Update patch version (1.0.0 → 1.0.1)
npm version patch

# Update minor version (1.0.0 → 1.1.0)
npm version minor

# Update major version (1.0.0 → 2.0.0)
npm version major

# Publish a package
npm publish
```

## License

MIT
