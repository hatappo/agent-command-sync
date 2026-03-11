# Advanced Reference

<div align="center"> en | <a href="advanced_ja.md">ja</a> </div>

## Lossless Conversion — Chimera Hub

Chimera Hub is a lossless conversion hub that preserves all agent-specific settings. Repeated direct conversions between agents may lose agent-specific fields (e.g., Claude's `allowed-tools`, Copilot's `tools`). Routing through Chimera Hub prevents this.

```bash
# Import from multiple agents (merges into hub)
asp import claude
asp import gemini

# Preview and apply
asp plan codex                             # Preview
asp apply codex                            # Apply
```

Hub files are stored in `~/.config/asp/` (global) or `<repo>/.asp/` (project).

For detailed workflow, architecture diagrams, and examples, see [Chimera Hub Workflow](chimera-hub-workflow.md).

## Commands

`asp` also supports converting single-file slash commands between agents.

### Commands vs Skills

| Aspect | Commands | Skills |
| ------ | -------- | ------ |
| Structure | Single file (`.md`, `.toml`) | Directory (`SKILL.md` + support files) |
| Location | `{base}/{tool}/commands/` | `{base}/{tool}/skills/<name>/` |
| Use Case | Simple prompts | Complex tasks with multiple files |

### File Structure and Metadata

| Feature                                   | Claude Code   | Gemini CLI    | Codex CLI     | OpenCode      | Copilot       | Cursor        | Conversion Notes                             |
| ----------------------------------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------------------------------------- |
| File format                               | Markdown      | TOML          | Markdown      | Markdown      | Markdown (`.prompt.md`) | Markdown | Automatically converted              |
| Content field                             | Body content  | `prompt`      | Body content  | Body content  | Body content  | Body content  | Main command content                         |
| Description metadata                      | `description` | `description` | `description` | `description` | `description` | -             | Lost when converting to Cursor (no frontmatter) |
| `model`                                   | Supported     | -             | -             | Supported     | Supported     | -             | Preserved for Claude/OpenCode/Copilot        |
| `tools` (YAML array)                      | -             | -             | -             | -             | Supported     | -             | Copilot-specific (passthrough via extras)    |
| `allowed-tools`, `argument-hint`          | Supported     | -             | -             | -             | -             | -             | Claude-specific (use `--remove-unsupported`) |

### Content Placeholders and Syntax

| Feature               | Claude Code    | Gemini CLI     | Codex CLI      | OpenCode       | Copilot        | Cursor         | Conversion Behavior                    |
| --------------------- | -------------- | -------------- | -------------- | -------------- | -------------- | -------------- | -------------------------------------- |
| All arguments         | `$ARGUMENTS`   | `{{args}}`     | `$ARGUMENTS`   | `$ARGUMENTS`   | -              | -              | Converted between formats              |
| Individual arguments  | `$1` ... `$9`  | -              | `$1` ... `$9`  | `$1` ... `$9`  | -              | -              | Preserved (not supported in Gemini/Copilot/Cursor) |
| Shell command         | `` !`command` ``| `!{command}`  | -              | `` !`command` ``| -             | -              | Converted between formats              |
| File reference        | `@path/to/file`| `@{path/to/file}` | -           | `@path/to/file`| -              | -              | Converted between formats              |

#### Individual Arguments

The placeholders `$1` through `$9` allow referencing individual command arguments. For example, `$1` refers to the first argument, `$2` to the second, and so on. This feature is supported in Claude Code, Codex CLI, and OpenCode, but not in Gemini CLI. During conversion, these placeholders are preserved as-is.

#### File References

File references allow embedding file contents inline within the command. The syntax differs between tools:
- Claude Code / OpenCode uses `@path/to/file.txt`
- Gemini CLI uses `@{path/to/file.txt}`
- Codex CLI does not support this feature

During conversion, the syntax is automatically converted between formats. When converting to/from Codex, the file reference syntax is preserved unchanged.

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
