# Guide to Adding a New Agent

This document outlines the step-by-step changes required to add a new agent (tool) to agent-command-sync.

## Background

All conversions use a hub-and-spoke architecture via **SemanticIR**.

```
Source Format → Parser → toIR() → SemanticIR → fromIR() → Target Format
```

When adding a new agent, **no pairwise converters are needed** — implementing a single pair of `toIR()` / `fromIR()` automatically enables bidirectional conversion with all existing agents.

### Agent Registry Pattern

Agent-specific logic is colocated in a single agent class that implements the `AgentDefinition` interface and is centrally managed via `AGENT_REGISTRY: Record<ProductType, AgentDefinition>`. Adding a value to `PRODUCT_TYPES` will trigger a compile error if the registry is missing a corresponding entry.

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

## Step 2: Agent Class

### `src/agents/newagent.ts` (new file)

Create a single agent class that implements all interfaces: `AgentConfig`, `BodyParser`, `CommandParser`, `CommandConverter`, `SkillParser`, and `SkillConverter`. Each agent has one file (e.g., `claude.ts`, `gemini.ts`, `codex.ts`, `opencode.ts`).

```typescript
import type { BodySegment } from "../types/body-segment.js";
import type { NewAgentCommand, NewAgentSkill } from "../types/index.js";
import type { ConverterOptions, SemanticIR } from "../types/semantic-ir.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import type {
  AgentDefinition,
  BodyParser,
  CommandConverter,
  CommandParser,
  SkillConverter,
  SkillParser,
} from "./types.js";

export class NewAgentAgent
  implements
    AgentDefinition,
    BodyParser,
    CommandParser<NewAgentCommand>,
    CommandConverter<NewAgentCommand>,
    SkillParser<NewAgentSkill>,
    SkillConverter<NewAgentSkill>
{
  // ── AgentConfig ───────────────────────────────────────────────────

  readonly displayName = "NewAgent";       // human-readable name (used in CLI help)
  readonly dirs = {
    commandSubdir: "commands",             // or "prompts" etc.
    skillSubdir: "skills",
    projectBase: ".newagent",              // project root relative
    userDefault: ".newagent",              // homedir relative (e.g. ".config/newagent")
  };
  readonly fileExtension = ".md";          // or ".toml"

  // ── BodyParser ────────────────────────────────────────────────────

  parseBody(body: string): BodySegment[] {
    // If using Claude-syntax placeholders, import from _claude-syntax-body-patterns.ts:
    //   import { CLAUDE_SYNTAX_PATTERNS } from "./_claude-syntax-body-patterns.js";
    //   return parseBody(body, CLAUDE_SYNTAX_PATTERNS);
    // If using unique syntax, define custom PatternDef[] in this file.
    return parseBody(body, /* patterns */);
  }

  serializeBody(segments: BodySegment[]): string {
    // If using Claude-syntax placeholders:
    //   import { CLAUDE_SYNTAX_SERIALIZERS } from "./_claude-syntax-body-patterns.js";
    //   return serializeBody(segments, CLAUDE_SYNTAX_SERIALIZERS);
    // Optionally pass an UNSUPPORTED set as the third argument.
    return serializeBody(segments, /* serializers */);
  }

  // ── CommandParser ─────────────────────────────────────────────────

  async parseCommand(filePath: string): Promise<NewAgentCommand> {
    // Read and parse a command file into the agent-specific type
  }

  validateCommand(data: NewAgentCommand): boolean {
    // Validate the data
  }

  stringifyCommand(command: NewAgentCommand): string {
    // Convert the agent-specific type to file content string
  }

  // ── CommandConverter ──────────────────────────────────────────────

  commandToIR(source: NewAgentCommand): SemanticIR {
    // description → ir.semantic.description
    // body → this.parseBody(...)
    // other fields → ir.extras
  }

  commandFromIR(ir: SemanticIR, options?: ConverterOptions): NewAgentCommand {
    // ir.semantic.description → agent-specific field
    // ir.body → this.serializeBody(...)
    // ir.extras → pass through (or skip with removeUnsupported)
  }

  // ── SkillParser ───────────────────────────────────────────────────

  async parseSkill(dirPath: string): Promise<NewAgentSkill> {
    // Read from a skill directory (SKILL.md + support files)
  }

  validateSkill(data: NewAgentSkill): boolean {
    // Validate the data
  }

  stringifySkill(skill: NewAgentSkill): string {
    // Convert to SKILL.md format
  }

  async writeSkillToDirectory(
    skill: NewAgentSkill,
    sourceDirPath: string,
    targetDir: string,
  ): Promise<void> {
    // Write a skill to a directory (SKILL.md + support files)
  }

  // ── SkillConverter ────────────────────────────────────────────────

  skillToIR(source: NewAgentSkill): SemanticIR {
    // Similar to commandToIR, with additional handling for:
    // - modelInvocationEnabled semantic property
    // - _claude_ prefixed fields for round-trip fidelity
  }

  skillFromIR(ir: SemanticIR, options?: ConverterOptions): NewAgentSkill {
    // Similar to commandFromIR, with:
    // - CLAUDE_SKILL_FIELDS for removeUnsupported
    // - _claude_ prefix handling
  }
}

export function createNewAgentAgent(): AgentDefinition {
  return new NewAgentAgent();
}
```

**Body patterns:**

- If the syntax is **the same** as Claude/Codex/OpenCode: import `CLAUDE_SYNTAX_PATTERNS` and `CLAUDE_SYNTAX_SERIALIZERS` from `_claude-syntax-body-patterns.ts`
- If the syntax is **unique**: define custom `PatternDef[]` and `PlaceholderSerializers` in the agent file (see `gemini.ts` for an example)

**`CLAUDE_COMMAND_FIELDS`:** Define the list of fields not supported by the target.

```typescript
// Example: OpenCode supports model, so only allowed-tools and argument-hint
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint"] as const;

// Example: Codex doesn't support model either, so three fields
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint", "model"] as const;
```

**`CLAUDE_SKILL_FIELDS`:** List of Claude-specific skill fields not supported by the target. Additional considerations:

- **`_claude_` prefix**: Claude-specific fields are stored in frontmatter with `_claude_*` prefix (for round-trip fidelity)
- **`modelInvocationEnabled`**: A semantic property. Bidirectionally converted with Claude's `disable-model-invocation` (inverted) and Codex's `allow_implicit_invocation`

**Skill parser checklist:**
- [ ] Verify SKILL.md existence with `isSkillDirectory()`
- [ ] Collect support files with `collectSupportFiles()`
- [ ] If agent-specific config files exist, parse/write them individually (e.g., Codex's `agents/openai.yaml`)

---

## Step 3: Agent Registry Registration

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

## Step 4: CLI Integration

`src/cli/index.ts` dynamically generates CLI options (`--xxx-dir`), description, and customDirs mapping from `PRODUCT_TYPES` and `AGENT_REGISTRY`. **No changes needed.**

Optionally, you can add usage examples for the new agent in the help examples section.

---

## Step 5: Exports

### `src/agents/index.ts`

Add re-export for the new agent.

```typescript
export * from "./newagent.js";
```

> `src/index.ts` re-exports `src/agents/index.ts` via `export * from "./agents/index.js"`, so no additional changes needed there.

---

## Step 6: Tests

### Test Fixtures (`tests/fixtures/`)

- Place sample command files in `tests/fixtures/newagent-commands/`
- Place a sample skill in `tests/fixtures/newagent-skills/test-skill/SKILL.md`

### New Test Files

| File | Test Coverage |
|------|---------------|
| `tests/parsers/newagent-command-parser.test.ts` | parseCommand, validateCommand, stringifyCommand |
| `tests/parsers/newagent-skill-parser.test.ts` | parseSkill, validateSkill, stringifySkill, writeSkillToDirectory |

### Additions to Existing Tests

| File | Tests to Add |
|------|--------------|
| `tests/utils/body-segment-utils.test.ts` | `parseBody` / `serializeBody` with new agent's patterns |
| `tests/converters/command-conversion.test.ts` | Other agents ↔ NewAgent conversion |
| `tests/converters/skill-conversion.test.ts` | Other agents ↔ NewAgent skill conversion |
| `tests/integration/cli.test.ts` | End-to-end conversion tests |

> `tests/utils/file-utils.test.ts` and `tests/agents/registry.test.ts` use `AGENT_REGISTRY`, so simply adding to the registry will automatically be covered by existing tests.

---

## Step 7: Documentation

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

**Source:**
- [ ] `src/agents/newagent.ts` — Agent class (body + command + skill parsing/conversion)

**Tests:**
- [ ] `tests/parsers/newagent-command-parser.test.ts`
- [ ] `tests/parsers/newagent-skill-parser.test.ts`
- [ ] `tests/fixtures/newagent-commands/*.md` (or `.toml`)
- [ ] `tests/fixtures/newagent-skills/test-skill/SKILL.md`

### Modified Files

**Source:**
- [ ] `src/types/intermediate.ts` — Add to PRODUCT_TYPES
- [ ] `src/types/command.ts` — New command type (optional: existing types may suffice)
- [ ] `src/types/skill.ts` — New skill type (optional: existing types may suffice)
- [ ] `src/agents/registry.ts` — Add registry entry
- [ ] `src/agents/index.ts` — Add re-export

**Tests:**
- [ ] `tests/utils/body-segment-utils.test.ts`
- [ ] `tests/converters/command-conversion.test.ts`
- [ ] `tests/converters/skill-conversion.test.ts`
- [ ] `tests/integration/cli.test.ts`

**Documentation:**
- [ ] `CLAUDE.md`
- [ ] `README.md`
- [ ] `README_ja.md`

### No Changes Needed (Automatically Handled by Registry Pattern)

- `src/types/index.ts` — Wildcard exports automatically re-export new types
- `src/index.ts` — Re-exports `src/agents/index.ts` via wildcard
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
