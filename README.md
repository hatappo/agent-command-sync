# agent-slash-sync

Convert Custom Slash Commands between Claude Code and Gemini CLI.

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
agent-slash-sync -d -c c2g

# Convert specific file
agent-slash-sync -c g2c -f analyze-code

# Full sync with cleanup
agent-slash-sync -c c2g --sync-delete --remove-unsupported

# Use custom directories
agent-slash-sync -c c2g --claude-dir ~/my-claude --gemini-dir ~/my-gemini
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

- `[A]` Created • `[M]` Modified • `[D]` Deleted • `[-]` Skipped

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
```

## License

MIT
