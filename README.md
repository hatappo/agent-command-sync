<div align="center"> en | <a href="README_ja.md">ja</a> </div>

--------------------------------------------------------------------------------

# agent-command-sync

[![npm version](https://badge.fury.io/js/agent-command-sync.svg)](https://www.npmjs.com/package/agent-command-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bidirectionally convert and sync Custom Slash Commands between Claude Code, Gemini CLI, and Codex CLI with intuitive visual feedback.

## CHANGELOG

[CHANGELOG.txt](CHANGELOG.txt)

## Installation

```bash
npm install -g agent-command-sync
```

## Quick Start

```bash
# Convert Claude Code → Gemini CLI
acsync -s claude -d gemini

# Convert Gemini CLI → Claude Code
acsync -s gemini -d claude

# Preview changes without applying
acsync -n -s claude -d gemini
```

## Screenshots

### Usage Example
![agent-command-sync usage](docs/acsync-usage.png)

### Conversion Example
![agent-command-sync example](docs/acsync-example.png)

## Features

- **Colorful Output** - Clear visual feedback with color-coded status indicators
- **Fast Conversion** - Efficiently sync commands between Claude Code and Gemini CLI
- **Bidirectional** - Convert in both directions (Claude ↔ Gemini)
- **Safe by Default** - Preview changes with dry-run mode before applying
- **Short Command** - Use `acsync` instead of `agent-command-sync`
- **Selective Sync** - Convert specific files or all commands at once

## Options

| Option                      | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `-s, --src <product>`       | **Required.** Source product: `claude`, `gemini`, or `codex`         |
| `-d, --dest <product>`      | **Required.** Destination product: `claude`, `gemini`, or `codex`    |
| `-f, --file <filename>`     | Convert specific file only (supports `.md`, `.toml` extensions)      |
| `-n, --noop`                | Preview changes without applying them                                 |
| `-v, --verbose`             | Show detailed debug information                                       |
| `--claude-dir <path>`       | Claude base directory (default: ~/.claude)                            |
| `--gemini-dir <path>`       | Gemini base directory (default: ~/.gemini)                            |
| `--codex-dir <path>`        | Codex base directory (default: ~/.codex)                              |
| `--no-overwrite`            | Skip existing files in target directory                               |
| `--sync-delete`             | Delete orphaned files in target directory                             |
| `--remove-unsupported`      | Remove fields not supported by target format                          |

## Examples

```bash
# Convert all commands with preview
acsync -n -s claude -d gemini

# Convert specific file
acsync -s gemini -d claude -f analyze-code

# Full sync with cleanup
acsync -s claude -d gemini --sync-delete --remove-unsupported

# Use custom directories (base directories, /commands will be added automatically)
acsync -s claude -d gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# Show verbose output for debugging
acsync -s claude -d gemini -v
```

## Default File Locations

- **Claude Code**: `~/.claude/commands/*.md`
- **Gemini CLI**: `~/.gemini/commands/*.toml`
- **Codex CLI**: `~/.codex/prompts/*.md`

## Format Comparison and Conversion Specification

### File Structure and Metadata

| Feature                                   | Claude Code   | Gemini CLI    | Codex CLI     | Conversion Notes                             |
| ----------------------------------------- | ------------- | ------------- | ------------- | -------------------------------------------- |
| File format                               | Markdown      | TOML          | Markdown      | Automatically converted                      |
| Content field                             | Body content  | `prompt`      | Body content  | Main command content                         |
| Description metadata                      | `description` | `description` | `description` | Preserved across formats                     |
| `allowed-tools`, `argument-hint`, `model` | Supported     | -             | -             | Claude-specific (use `--remove-unsupported`) |

### Content Placeholders and Syntax

| Feature               | Claude Code    | Gemini CLI     | Codex CLI      | Conversion Behavior                    |
| --------------------- | -------------- | -------------- | -------------- | -------------------------------------- |
| All arguments         | `$ARGUMENTS`   | `{{args}}`     | `$ARGUMENTS`   | Converted between formats              |
| Individual arguments  | `$1` ... `$9`  | -              | `$1` ... `$9`  | Preserved (not supported in Gemini)    |
| Shell command         | `!command`     | `!{command}`   | -              | Converted between Claude/Gemini        |
| File reference        | `@path/to/file`| `@{path/to/file}` | -           | Converted between Claude/Gemini        |

#### Individual Arguments
The placeholders `$1` through `$9` allow referencing individual command arguments. For example, `$1` refers to the first argument, `$2` to the second, and so on. This feature is supported in Claude Code and Codex CLI, but not in Gemini CLI. During conversion, these placeholders are preserved as-is.

#### File References
File references allow embedding file contents inline within the command. The syntax differs between tools:
- Claude Code uses `@path/to/file.txt`
- Gemini CLI uses `@{path/to/file.txt}`
- Codex CLI does not support this feature

During conversion between Claude and Gemini, the syntax is automatically converted. When converting to/from Codex, the file reference syntax is preserved unchanged.

### Official Documents

- [Slash commands - Claude Docs](https://docs.claude.com/en/docs/claude-code/slash-commands)
- [gemini-cli/docs/cli/custom-commands.md at main · google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md)
- [codex/docs/prompts.md at main · openai/codex](https://github.com/openai/codex/blob/main/docs/prompts.md)

## Status Indicators

- `[A]` Created (Green) - New files created in target directory
- `[M]` Modified (Yellow) - Existing files updated
- `[D]` Deleted (Red) - Files removed with `--sync-delete`
- `[-]` Skipped (Gray) - Files skipped with `--no-overwrite`

## Requirements

- Node.js >= 18.0.0
- npm or compatible package manager

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
npm run release:dry

# Publish patch version (1.0.0 → 1.0.1)
npm run release:patch

# Publish minor version (1.0.0 → 1.1.0)
npm run release:minor

# Publish major version (1.0.0 → 2.0.0)
npm run release:major
```

## License

MIT
