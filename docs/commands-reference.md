# Commands Reference

Commands are single-file slash commands. For Skills (directory-based, recommended), see the main [README](../README.md#skills-format).

## Commands vs Skills

| Aspect | Commands | Skills |
| ------ | -------- | ------ |
| Structure | Single file (`.md`, `.toml`) | Directory (`SKILL.md` + support files) |
| Location | `{base}/{tool}/commands/` | `{base}/{tool}/skills/<name>/` |
| Use Case | Simple prompts | Complex tasks with multiple files |

## File Structure and Metadata

| Feature                                   | Claude Code   | Gemini CLI    | Codex CLI     | OpenCode      | Copilot       | Cursor        | Conversion Notes                             |
| ----------------------------------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------------------------------------- |
| File format                               | Markdown      | TOML          | Markdown      | Markdown      | Markdown (`.prompt.md`) | Markdown | Automatically converted              |
| Content field                             | Body content  | `prompt`      | Body content  | Body content  | Body content  | Body content  | Main command content                         |
| Description metadata                      | `description` | `description` | `description` | `description` | `description` | -             | Lost when converting to Cursor (no frontmatter) |
| `model`                                   | Supported     | -             | -             | Supported     | Supported     | -             | Preserved for Claude/OpenCode/Copilot        |
| `tools` (YAML array)                      | -             | -             | -             | -             | Supported     | -             | Copilot-specific (passthrough via extras)    |
| `allowed-tools`, `argument-hint`          | Supported     | -             | -             | -             | -             | -             | Claude-specific (use `--remove-unsupported`) |

## Content Placeholders and Syntax

| Feature               | Claude Code    | Gemini CLI     | Codex CLI      | OpenCode       | Copilot        | Cursor         | Conversion Behavior                    |
| --------------------- | -------------- | -------------- | -------------- | -------------- | -------------- | -------------- | -------------------------------------- |
| All arguments         | `$ARGUMENTS`   | `{{args}}`     | `$ARGUMENTS`   | `$ARGUMENTS`   | -              | -              | Converted between formats              |
| Individual arguments  | `$1` ... `$9`  | -              | `$1` ... `$9`  | `$1` ... `$9`  | -              | -              | Preserved (not supported in Gemini/Copilot/Cursor) |
| Shell command         | `` !`command` ``| `!{command}`  | -              | `` !`command` ``| -             | -              | Converted between formats              |
| File reference        | `@path/to/file`| `@{path/to/file}` | -           | `@path/to/file`| -              | -              | Converted between formats              |

### Individual Arguments
The placeholders `$1` through `$9` allow referencing individual command arguments. For example, `$1` refers to the first argument, `$2` to the second, and so on. This feature is supported in Claude Code, Codex CLI, and OpenCode, but not in Gemini CLI. During conversion, these placeholders are preserved as-is.

### File References
File references allow embedding file contents inline within the command. The syntax differs between tools:
- Claude Code / OpenCode uses `@path/to/file.txt`
- Gemini CLI uses `@{path/to/file.txt}`
- Codex CLI does not support this feature

During conversion, the syntax is automatically converted between formats. When converting to/from Codex, the file reference syntax is preserved unchanged.
