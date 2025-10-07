<div align="center"> en | <a href="README_ja.md">ja</a> </div>

--------------------------------------------------------------------------------

# agent-slash-sync

[![npm version](https://badge.fury.io/js/agent-slash-sync.svg)](https://www.npmjs.com/package/agent-slash-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bidirectionally convert and sync Custom Slash Commands between Claude Code, Gemini CLI, and Codex CLI with intuitive visual feedback.

## Installation

```bash
npm install -g agent-slash-sync
```

## Quick Start

```bash
# Convert Claude Code → Gemini CLI
assync -s claude -d gemini

# Convert Gemini CLI → Claude Code
assync -s gemini -d claude

# Preview changes without applying
assync -n -s claude -d gemini
```

## Screenshots

### Usage Example
![agent-slash-sync usage](docs/assync-usage.png)

### Conversion Example
![agent-slash-sync example](docs/assync-example.png)

## Features

- **Colorful Output** - Clear visual feedback with color-coded status indicators
- **Fast Conversion** - Efficiently sync commands between Claude Code and Gemini CLI
- **Bidirectional** - Convert in both directions (Claude ↔ Gemini)
- **Safe by Default** - Preview changes with dry-run mode before applying
- **Short Command** - Use `assync` instead of `agent-slash-sync`
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
assync -n -s claude -d gemini

# Convert specific file
assync -s gemini -d claude -f analyze-code

# Full sync with cleanup
assync -s claude -d gemini --sync-delete --remove-unsupported

# Use custom directories (base directories, /commands will be added automatically)
assync -s claude -d gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# Show verbose output for debugging
assync -s claude -d gemini -v
```

## File Locations

- **Claude Code**: `~/.claude/commands/*.md`
- **Gemini CLI**: `~/.gemini/commands/*.toml`
- **Codex CLI**: `~/.codex/prompts/*.md`

## Format Conversion

| Claude Code                               | Gemini CLI    | Codex CLI     | Notes                                        |
| ----------------------------------------- | ------------- | ------------- | -------------------------------------------- |
| Markdown                                  | `prompt`      | Markdown      | Main command content                         |
| Frontmatter `description`                 | `description` | -             | Command description                          |
| `allowed-tools`, `argument-hint`, `model` | -             | -             | Claude-specific (use `--remove-unsupported`) |
| `$ARGUMENTS`                              | `{{args}}`    | `$ARGUMENTS`  | Argument placeholder                         |
| `!command`                                | `!{command}`  | -             | Shell command syntax                         |

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
