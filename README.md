<div align="center"> en | <a href="README_ja.md">ja</a> </div>

--------------------------------------------------------------------------------

# agent-command-sync

[![npm version](https://badge.fury.io/js/agent-command-sync.svg)](https://www.npmjs.com/package/agent-command-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bidirectionally convert and sync Custom Slash Commands and Skills between Claude Code, Gemini CLI, Codex CLI, and OpenCode with intuitive visual feedback.

## CHANGELOG

[CHANGELOG.txt](CHANGELOG.txt)

## Installation

```bash
npm install -g agent-command-sync
```

## Quick Start

```bash
# Convert Claude Code → Gemini CLI (Commands + Skills)
acsync -s claude -d gemini

# Convert Gemini CLI → Claude Code
acsync -s gemini -d claude

# Convert Skills only
acsync -s claude -d gemini -t skills

# Convert Commands only
acsync -s claude -d gemini -t commands

# Preview changes without applying
acsync -n -s claude -d gemini
```

## Screenshots

### Usage Example
![agent-command-sync usage](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acsync-usage.png)

### Conversion Example
![agent-command-sync example](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acsync-example.png)

## Features

- **Colorful Output** - Clear visual feedback with color-coded status indicators
- **Fast Conversion** - Efficiently sync commands between Claude Code, Gemini CLI, Codex CLI, and OpenCode
- **Bidirectional** - Convert in any direction (Claude ↔ Gemini ↔ Codex ↔ OpenCode)
- **Safe by Default** - Preview changes with dry-run mode before applying
- **Short Command** - Use `acsync` instead of `agent-command-sync`
- **Selective Sync** - Convert specific files or all commands at once

## Options

| Option                      | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `-s, --src <product>`       | **Required.** Source product: `claude`, `gemini`, `codex`, or `opencode` |
| `-d, --dest <product>`      | **Required.** Destination product: `claude`, `gemini`, `codex`, or `opencode` |
| `-t, --type <type>`         | Content type: `commands`, `skills`, or `both` (default: `both`)      |
| `-f, --file <filename>`     | Convert specific file only (supports `.md`, `.toml` extensions)      |
| `-n, --noop`                | Preview changes without applying them                                 |
| `-v, --verbose`             | Show detailed debug information                                       |
| `--claude-dir <path>`       | Claude base directory (default: ~/.claude)                            |
| `--gemini-dir <path>`       | Gemini base directory (default: ~/.gemini)                            |
| `--codex-dir <path>`        | Codex base directory (default: ~/.codex)                              |
| `--opencode-dir <path>`     | OpenCode base directory (default: ~/.config/opencode)                 |
| `--no-overwrite`            | Skip existing files in target directory                               |
| `--sync-delete`             | Delete orphaned files in target directory                             |
| `--remove-unsupported`      | Remove fields not supported by target format                          |

## Examples

```bash
# Convert all commands and skills with preview
acsync -n -s claude -d gemini

# Convert specific file
acsync -s gemini -d claude -f analyze-code

# Convert Skills only
acsync -s claude -d gemini -t skills

# Convert specific skill
acsync -s claude -d gemini -t skills -f my-skill

# Full sync with cleanup
acsync -s claude -d gemini --sync-delete --remove-unsupported

# Use custom directories (base directories, /commands and /skills will be added automatically)
acsync -s claude -d gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# Show verbose output for debugging
acsync -s claude -d gemini -v
```

## Default File Locations

### Commands
- **Claude Code**: `~/.claude/commands/*.md`
- **Gemini CLI**: `~/.gemini/commands/*.toml`
- **Codex CLI**: `~/.codex/prompts/*.md`
- **OpenCode**: `~/.config/opencode/commands/*.md`

### Skills
- **Claude Code**: `~/.claude/skills/<skill-name>/SKILL.md`
- **Gemini CLI**: `~/.gemini/skills/<skill-name>/SKILL.md`
- **Codex CLI**: `~/.codex/skills/<skill-name>/SKILL.md`
- **OpenCode**: `~/.config/opencode/skills/<skill-name>/SKILL.md`

## Format Comparison and Conversion Specification

### Commands vs Skills

| Aspect | Commands | Skills |
| ------ | -------- | ------ |
| Structure | Single file (`.md`, `.toml`) | Directory (`SKILL.md` + support files) |
| Location | `~/.{tool}/commands/` | `~/.{tool}/skills/<name>/` |
| Use Case | Simple prompts | Complex tasks with multiple files |

---

## Commands Format

### File Structure and Metadata

| Feature                                   | Claude Code   | Gemini CLI    | Codex CLI     | OpenCode      | Conversion Notes                             |
| ----------------------------------------- | ------------- | ------------- | ------------- | ------------- | -------------------------------------------- |
| File format                               | Markdown      | TOML          | Markdown      | Markdown      | Automatically converted                      |
| Content field                             | Body content  | `prompt`      | Body content  | Body content  | Main command content                         |
| Description metadata                      | `description` | `description` | `description` | `description` | Preserved across formats                     |
| `model`                                   | Supported     | -             | -             | Supported     | Preserved for Claude/OpenCode                |
| `allowed-tools`, `argument-hint`          | Supported     | -             | -             | -             | Claude-specific (use `--remove-unsupported`) |

### Content Placeholders and Syntax

| Feature               | Claude Code    | Gemini CLI     | Codex CLI      | OpenCode       | Conversion Behavior                    |
| --------------------- | -------------- | -------------- | -------------- | -------------- | -------------------------------------- |
| All arguments         | `$ARGUMENTS`   | `{{args}}`     | `$ARGUMENTS`   | `$ARGUMENTS`   | Converted between formats              |
| Individual arguments  | `$1` ... `$9`  | -              | `$1` ... `$9`  | `$1` ... `$9`  | Preserved (not supported in Gemini)    |
| Shell command         | `` !`command` ``| `!{command}`  | -              | `` !`command` ``| Converted between formats              |
| File reference        | `@path/to/file`| `@{path/to/file}` | -           | `@path/to/file`| Converted between formats              |

#### Individual Arguments
The placeholders `$1` through `$9` allow referencing individual command arguments. For example, `$1` refers to the first argument, `$2` to the second, and so on. This feature is supported in Claude Code, Codex CLI, and OpenCode, but not in Gemini CLI. During conversion, these placeholders are preserved as-is.

#### File References
File references allow embedding file contents inline within the command. The syntax differs between tools:
- Claude Code / OpenCode uses `@path/to/file.txt`
- Gemini CLI uses `@{path/to/file.txt}`
- Codex CLI does not support this feature

During conversion, the syntax is automatically converted between formats. When converting to/from Codex, the file reference syntax is preserved unchanged.

---

## Skills Format

Skills follow the [Agent Skills](https://agentskills.io/) open standard adopted by Claude Code, Gemini CLI, Codex CLI, and OpenCode.

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

| Field | Claude Code | Gemini CLI | Codex CLI | OpenCode | Conversion Notes |
| ----- | ----------- | ---------- | --------- | -------- | ---------------- |
| `name` | ✓ | ✓ | ✓ | ✓ | Required |
| `description` | ✓ | ✓ | ✓ | ✓ | Preserved |
| `argument-hint` | ✓ | - | - | - | Claude-specific |
| `allowed-tools` | ✓ | - | - | - | Claude-specific |
| `model` | ✓ | - | - | - | Claude-specific |
| `context` | ✓ | - | - | - | Claude-specific (e.g., `"fork"`) |
| `agent` | ✓ | - | - | - | Claude-specific |
| `hooks` | ✓ | - | - | - | Claude-specific (before/after/on_error) |
| `disable-model-invocation` | ✓ | - | ✓* | ✓** | Converted (see below) |
| `user-invocable` | ✓ | - | - | - | Claude-specific |

\* Codex uses `policy.allow_implicit_invocation` in `agents/openai.yaml` (inverted logic)
\*\* OpenCode uses `disable-model-invocation` directly in SKILL.md frontmatter

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

Same as Commands:

| Feature | Claude Code / Codex CLI / OpenCode | Gemini CLI |
| ------- | ---------------------------------- | ---------- |
| All arguments | `$ARGUMENTS` | `{{args}}` |
| Individual arguments | `$1` ... `$9` | Not supported |
| Shell command | `` !`command` `` | `!{command}` |
| File reference | `@path/to/file` | `@{path/to/file}` |

---

## Official Documents

### Commands
- [Slash commands - Claude Docs](https://docs.claude.com/en/docs/claude-code/slash-commands)
- [gemini-cli/docs/cli/custom-commands.md at main · google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md)
- [codex/docs/prompts.md at main · openai/codex](https://github.com/openai/codex/blob/main/docs/prompts.md)
- [OpenCode](https://opencode.ai/)

### Skills
- [Agent Skills Standard](https://agentskills.io/)
- [Custom skills - Claude Docs](https://docs.claude.com/en/docs/claude-code/custom-skills)

## Status Indicators

- `[A]` Created (Green) - New files created in target directory
- `[M]` Modified (Yellow) - Existing files updated
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

Each agent has a single bidirectional converter implementing `toIR()` and `fromIR()`. Adding a new agent requires only one converter — not N converters for N existing agents.

### SemanticIR Structure

```typescript
interface SemanticIR {
  contentType: "command" | "skill";
  body: BodySegment[];                  // Tokenized body content
  semantic: SemanticProperties;         // Shared properties (description, name, etc.)
  extras: Record<string, unknown>;      // Agent-specific passthrough properties
  meta: SemanticMeta;                   // Conversion context (source path, type, etc.)
}
```

- **`semantic`** — Properties with shared meaning across agents (e.g., `description`). Converters map between agent-specific field names and semantic properties.
- **`extras`** — All other properties pass through unchanged. Agent-specific fields (e.g., Claude's `allowed-tools`) are preserved for round-trip fidelity and can be stripped with `--remove-unsupported`.
- **`body`** — Tokenized as `BodySegment[]` (an array of plain strings and semantic placeholders), so placeholder syntax conversion (e.g., `$ARGUMENTS` ↔ `{{args}}`) happens automatically within each converter's `toIR()`/`fromIR()`.

### Body Tokenization

Body content is parsed into an array of `BodySegment` elements — plain strings interleaved with typed `ContentPlaceholder` objects:

```typescript
type ContentPlaceholder =
  | { type: "arguments" }                // $ARGUMENTS / {{args}}
  | { type: "individual-argument"; index: 1-9 }  // $1-$9
  | { type: "shell-command"; command: string }    // !`cmd` / !{cmd}
  | { type: "file-reference"; path: string };     // @path / @{path}
```

Each agent defines its own patterns and serializers colocated with its converters (`claude-body.ts`, `codex-body.ts`, `gemini-body.ts`). Claude and Codex share the same placeholder syntax via a common module (`_claude-codex-body.ts`), while Codex marks unsupported placeholder types (shell-command, file-reference) for best-effort output. A type-driven serializer registry (`PlaceholderSerializers`) ensures compile-time exhaustiveness — adding a new placeholder type causes a type error until every agent implements it.

### Source Layout

```
src/
├── agents/             # Agent Registry (AgentDefinition per agent, compile-time exhaustiveness)
├── types/              # Type definitions (SemanticIR, BodySegment, agent formats)
├── parsers/            # File parsers (Markdown, TOML → agent-specific types)
├── converters/         # Bidirectional converters (toIR/fromIR) + body parsers/serializers
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
