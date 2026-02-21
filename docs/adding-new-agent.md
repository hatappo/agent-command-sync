# Guide to Adding a New Agent

This document outlines the step-by-step changes required to add a new agent (tool) to agent-command-sync.

## Background

All conversions use a hub-and-spoke architecture via **SemanticIR**.

```
Source Format → Parser → toIR() → SemanticIR → fromIR() → Target Format
```

When adding a new agent, **no pairwise converters are needed** — implementing a single pair of `toIR()` / `fromIR()` automatically enables bidirectional conversion with all existing agents.

### Agent Registry Pattern

Agent-specific logic is colocated in the `AgentDefinition` interface and centrally managed via `AGENT_REGISTRY: Record<ProductType, AgentDefinition>`. Adding a value to `PRODUCT_TYPES` will trigger a compile error if the registry is missing a corresponding entry.

---

## Step 1: Type Definitions

### `src/types/intermediate.ts`

Add the new agent name to the `PRODUCT_TYPES` array. `ProductType` is automatically derived.

```typescript
// Before
export const PRODUCT_TYPES = ["claude", "gemini", "codex", "opencode"] as const;
// After
export const PRODUCT_TYPES = ["claude", "gemini", "codex", "opencode", "newagent"] as const;
```

> This change alone will trigger a compile error if `AGENT_REGISTRY` is missing an entry for the new agent.

### `src/types/command.ts`

Add an agent-specific command type.

```typescript
export interface NewAgentCommand {
  // Define according to the agent's command file structure
  frontmatter?: Record<string, unknown>;  // If YAML frontmatter is used
  content: string;
  filePath: string;
}
```

### `src/types/skill.ts`

Add an agent-specific skill type. The standard approach is to extend `SkillBase`.

```typescript
export interface NewAgentSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
  // Add agent-specific settings here
}
```

> `src/types/index.ts` uses wildcard exports (`export *`), so adding types to command.ts / skill.ts automatically re-exports them. No changes needed.

---

## Step 2: Body Parser

### `src/converters/newagent-body.ts` (new file)

Define placeholder syntax.

- If the syntax is **the same** as Claude/Codex/OpenCode: import from `_claude-codex-body.ts` and create a thin wrapper
- If the syntax is **unique**: define custom `PatternDef[]` and `PlaceholderSerializers`

```typescript
import type { BodySegment } from "../types/body-segment.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { CLAUDE_CODEX_PATTERNS, CLAUDE_CODEX_SERIALIZERS } from "./_claude-codex-body.js";

// Define unsupported placeholder types as a Set
const UNSUPPORTED: ReadonlySet<ContentPlaceholder["type"]> = new Set([/* ... */]);

export function parseNewAgentBody(body: string): BodySegment[] {
  return parseBody(body, CLAUDE_CODEX_PATTERNS);
}

export function serializeNewAgentBody(segments: BodySegment[]): string {
  return serializeBody(segments, CLAUDE_CODEX_SERIALIZERS, UNSUPPORTED);
}
```

**Notes:**
- Placeholders in the unsupported set will emit warnings in `serializeBody` when `NODE_DEBUG=acsync` is set
- If no unsupported set is specified, all placeholders are treated as supported

---

## Step 3: Parser

### `src/parsers/newagent-parser.ts` (new file)

Implement the `Parser<T>` interface with the following methods.

| Method | Description |
|--------|-------------|
| `parse(filePath)` | Read and parse a file into the agent-specific type |
| `validate(data)` | Validate the data |
| `stringify(command)` | Convert the agent-specific type to file content string |

For Markdown + YAML frontmatter formats, use `gray-matter` (refer to the Codex/OpenCode parser).
For TOML formats, use `@iarna/toml` (refer to the Gemini parser).

### `src/parsers/newagent-skill-parser.ts` (new file)

In addition to `Parser<T>`, implement the `writeToDirectory()` method.

| Method | Description |
|--------|-------------|
| `parse(dirPath)` | Read from a skill directory |
| `validate(data)` | Validate the data |
| `stringify(skill)` | Convert to SKILL.md format |
| `writeToDirectory(skill, targetDir)` | Write a skill to a directory |

**Checklist:**
- [ ] Verify SKILL.md existence with `isSkillDirectory()`
- [ ] Collect support files with `collectSupportFiles()`
- [ ] If agent-specific config files exist, parse/write them individually (e.g., Codex's `agents/openai.yaml`)

---

## Step 4: Converter

### `src/converters/newagent-command-converter.ts` (new file)

Implement `SemanticConverter<NewAgentCommand>`.

```typescript
export class NewAgentCommandConverter implements SemanticConverter<NewAgentCommand> {
  toIR(source: NewAgentCommand): SemanticIR { /* ... */ }
  fromIR(ir: SemanticIR, options?: ConverterOptions): NewAgentCommand { /* ... */ }
}
```

**`toIR()` implementation:**
1. `description` → `ir.semantic.description`
2. Body → parse with `parseNewAgentBody()` into `ir.body`
3. Other fields → `ir.extras`
4. Set `ir.meta.sourceType`

**`fromIR()` implementation:**
1. `ir.semantic.description` → agent-specific field
2. `ir.body` → serialize with `serializeNewAgentBody()`
3. Process other agent-specific fields from `ir.extras`:
   - When `removeUnsupported` option is set, skip keys included in `CLAUDE_COMMAND_FIELDS`
   - Otherwise, pass through to frontmatter etc.

**Defining `CLAUDE_COMMAND_FIELDS`:**
Define the list of fields not supported by the target.

```typescript
// Example: OpenCode supports model, so only allowed-tools and argument-hint
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint"] as const;

// Example: Codex doesn't support model either, so three fields
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint", "model"] as const;
```

### `src/converters/newagent-skill-converter.ts` (new file)

Implement `SemanticConverter<NewAgentSkill>`. Similar structure to commands, with these additional considerations:

- **`_claude_` prefix**: Claude-specific fields are stored in frontmatter with `_claude_*` prefix (for round-trip fidelity)
- **`modelInvocationEnabled`**: A semantic property. Bidirectionally converted with Claude's `disable-model-invocation` (inverted) and Codex's `allow_implicit_invocation`
- **`CLAUDE_SKILL_FIELDS`**: List of Claude-specific skill fields not supported by the target

---

## Step 5: Agent Registry Registration

### `src/agents/newagent.ts` (new file)

Create a factory function for the agent. Colocate parsers, converters, and directory configuration as an `AgentDefinition`.

```typescript
import { NewAgentCommandConverter } from "../converters/newagent-command-converter.js";
import { NewAgentSkillConverter } from "../converters/newagent-skill-converter.js";
import { NewAgentParser } from "../parsers/newagent-parser.js";
import { NewAgentSkillParser } from "../parsers/newagent-skill-parser.js";
import type { NewAgentCommand, NewAgentSkill } from "../types/index.js";
import type { AgentDefinition } from "./types.js";

export function createNewAgentAgent(): AgentDefinition {
  const parser = new NewAgentParser();
  const skillParser = new NewAgentSkillParser();
  const cmdConverter = new NewAgentCommandConverter();
  const skillConverter = new NewAgentSkillConverter();

  return {
    displayName: "NewAgent",       // human-readable name (used in CLI help)
    dirs: {
      commandSubdir: "commands",   // or "prompts" etc.
      skillSubdir: "skills",
      projectBase: ".newagent",    // project root relative
      userDefault: ".newagent",    // homedir relative (e.g. ".config/newagent")
    },
    fileExtension: ".md",          // or ".toml"
    commands: {
      parse: (f) => parser.parse(f),
      toIR: (cmd) => cmdConverter.toIR(cmd as NewAgentCommand),
      fromIR: (ir, opts) => cmdConverter.fromIR(ir, opts),
      stringify: (cmd) => parser.stringify(cmd as NewAgentCommand),
    },
    skills: {
      parse: (d) => skillParser.parse(d),
      toIR: (s) => skillConverter.toIR(s as NewAgentSkill),
      fromIR: (ir, opts) => skillConverter.fromIR(ir, opts),
      writeToDirectory: async (skill, srcDir, tgtDir) => {
        const s = skill as NewAgentSkill;
        s.dirPath = srcDir;
        await skillParser.writeToDirectory(s, tgtDir);
      },
    },
  };
}
```

### `src/agents/registry.ts`

Add an entry to the registry.

```typescript
import { createNewAgentAgent } from "./newagent.js";

export const AGENT_REGISTRY: Record<ProductType, AgentDefinition> = {
  claude: createClaudeAgent(),
  gemini: createGeminiAgent(),
  codex: createCodexAgent(),
  opencode: createOpenCodeAgent(),
  newagent: createNewAgentAgent(),  // Add this
};
```

> **That's all** — no changes to sync.ts / file-utils.ts are needed. The registry lookup automatically integrates into all sync operations.

---

## Step 6: CLI Integration

`src/cli/index.ts` dynamically generates CLI options (`--xxx-dir`), description, and customDirs mapping from `PRODUCT_TYPES` and `AGENT_REGISTRY`. **No changes needed.**

Optionally, you can add usage examples for the new agent in the help examples section.

---

## Step 7: Exports

### `src/index.ts`

Add re-exports for the new parsers and converters.

```typescript
export * from "./parsers/newagent-parser.js";
export * from "./converters/newagent-command-converter.js";
export * from "./converters/newagent-skill-converter.js";
```

> `src/agents/` is automatically exported via `src/agents/index.ts`, so no additional work is needed.

---

## Step 8: Tests

### Test Fixtures (`tests/fixtures/`)

- Place sample command files in `tests/fixtures/newagent-commands/`
- Place a sample skill in `tests/fixtures/newagent-skills/test-skill/SKILL.md`

### New Test Files

| File | Test Coverage |
|------|---------------|
| `tests/parsers/newagent-parser.test.ts` | parse, validate, stringify |
| `tests/parsers/newagent-skill-parser.test.ts` | parse, validate, stringify, writeToDirectory |

### Additions to Existing Tests

| File | Tests to Add |
|------|--------------|
| `tests/utils/body-segment-utils.test.ts` | `parseNewAgentBody` / `serializeNewAgentBody` |
| `tests/converters/command-conversion.test.ts` | Other agents ↔ NewAgent conversion |
| `tests/converters/skill-conversion.test.ts` | Other agents ↔ NewAgent skill conversion |
| `tests/integration/cli.test.ts` | End-to-end conversion tests |

> `tests/utils/file-utils.test.ts` and `tests/agents/registry.test.ts` use `AGENT_REGISTRY`, so simply adding to the registry will automatically be covered by existing tests.

---

## Step 9: Documentation

### `CLAUDE.md`

Update the following sections:

- Supported formats table (Commands / Skills)
- Placeholder conversion table
- Claude-specific fields section
- CLI option examples

### `README.md` / `README_ja.md`

Update the following sections:

- Add agent name to the title description
- Features section
- Options table (`--src` / `--dest` description, add `--newagent-dir` option)
- Default File Locations (Commands / Skills)
- Add new column to Commands Format table
- Add new column to Content Placeholders table
- Skills Format description
- Add new column to Skill Metadata table
- Add link to Official Documents

---

## File Change Checklist

### New Files

- [ ] `src/agents/newagent.ts` — AgentDefinition factory
- [ ] `src/converters/newagent-body.ts`
- [ ] `src/converters/newagent-command-converter.ts`
- [ ] `src/converters/newagent-skill-converter.ts`
- [ ] `src/parsers/newagent-parser.ts`
- [ ] `src/parsers/newagent-skill-parser.ts`
- [ ] `tests/parsers/newagent-parser.test.ts`
- [ ] `tests/parsers/newagent-skill-parser.test.ts`
- [ ] `tests/fixtures/newagent-commands/*.md` (or `.toml`)
- [ ] `tests/fixtures/newagent-skills/test-skill/SKILL.md`

### Modified Files

- [ ] `src/types/intermediate.ts` — Add to PRODUCT_TYPES
- [ ] `src/types/command.ts` — New command type
- [ ] `src/types/skill.ts` — New skill type
- [ ] `src/agents/registry.ts` — Add registry entry
- [ ] `src/index.ts` — Add exports
- [ ] `tests/utils/body-segment-utils.test.ts`
- [ ] `tests/converters/command-conversion.test.ts`
- [ ] `tests/converters/skill-conversion.test.ts`
- [ ] `tests/integration/cli.test.ts`
- [ ] `CLAUDE.md`
- [ ] `README.md`
- [ ] `README_ja.md`

### No Changes Needed (Automatically Handled by Registry Pattern)

- `src/types/index.ts` — Wildcard exports automatically re-export new types
- `src/cli/index.ts` — CLI options dynamically generated from PRODUCT_TYPES / AGENT_REGISTRY
- `src/cli/sync.ts`
- `src/utils/file-utils.ts`
- `src/cli/options.ts`
- `tests/utils/file-utils.test.ts`
- `tests/agents/registry.test.ts`
- `tests/fixtures/fixtures.test.ts`

### Verification Commands

```bash
npm run lint && npm run lint:tsc && npm test && npm run build
```
