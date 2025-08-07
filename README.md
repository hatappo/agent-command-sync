# agent-slash-sync

[![npm version](https://badge.fury.io/js/agent-slash-sync.svg)](https://www.npmjs.com/package/agent-slash-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Bidirectionally convert and sync Custom Slash Commands between Claude Code and Gemini CLI with intuitive visual feedback.

## Installation

```bash
npm install -g agent-slash-sync
```

## Quick Start

```bash
# Convert Claude Code → Gemini CLI
agent-slash-sync -c c2g
# or use short form
assync -c c2g

# Convert Gemini CLI → Claude Code
agent-slash-sync -c g2c
# or use short form
assync -c g2c

# Preview changes without applying
agent-slash-sync -d -c c2g
# or use short form
assync -d -c c2g
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

| Option                      | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `-c, --convert <direction>` | **Required.** Conversion direction: `c2g` or `g2c`              |
| `-f, --file <filename>`     | Convert specific file only (supports `.md`, `.toml` extensions) |
| `-d, --dry-run`             | Preview changes without applying them                           |
| `-v, --verbose`             | Show detailed debug information                                 |
| `--claude-dir <path>`       | Claude commands directory (default: ~/.claude/commands)         |
| `--gemini-dir <path>`       | Gemini commands directory (default: ~/.gemini/commands)         |
| `--no-overwrite`            | Skip existing files in target directory                         |
| `--sync-delete`             | Delete orphaned files in target directory                       |
| `--remove-unsupported`      | Remove fields not supported by target format                    |

## Examples

```bash
# Convert all commands with preview
assync -d -c c2g

# Convert specific file
assync -c g2c -f analyze-code

# Full sync with cleanup
assync -c c2g --sync-delete --remove-unsupported

# Use custom directories
assync -c c2g --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# Show verbose output for debugging
assync -c c2g -v
```

## File Locations

- **Claude Code**: `~/.claude/commands/*.md`
- **Gemini CLI**: `~/.gemini/commands/*.toml`

## Format Conversion

| Claude Code                               | Gemini CLI    | Notes                                        |
| ----------------------------------------- | ------------- | -------------------------------------------- |
| Markdown content                          | `prompt`      | Main command content                         |
| Frontmatter `description`                 | `description` | Command description                          |
| `$ARGUMENTS`                              | `{{args}}`    | Argument placeholder                         |
| `!command`                                | `!{command}`  | Shell command syntax                         |
| `allowed-tools`, `argument-hint`, `model` | -             | Claude-specific (use `--remove-unsupported`) |

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
