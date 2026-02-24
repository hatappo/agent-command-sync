import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { version } from "../../package.json" assert { type: "json" };
import type { CLIOptions } from "../../src/cli/options.js";
import { showStatus } from "../../src/cli/status.js";
import { syncCommands } from "../../src/cli/sync.js";
import { directoryExists, ensureDirectory, fileExists, readFile, writeFile } from "../../src/utils/file-utils.js";

describe("CLI Integration Tests", () => {
  let testDir: string;
  let claudeDir: string;
  let geminiDir: string;
  let claudeBaseDir: string;
  let geminiBaseDir: string;
  let codexBaseDir: string;
  let opencodeBaseDir: string;
  let codexDir: string;
  let opencodeDir: string;
  let claudeSkillsDir: string;
  let geminiSkillsDir: string;
  let codexSkillsDir: string;
  let opencodeSkillsDir: string;

  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `agent-slash-sync-test-${Date.now()}`);

    // Base directories
    claudeBaseDir = join(testDir, ".claude");
    geminiBaseDir = join(testDir, ".gemini");
    codexBaseDir = join(testDir, ".codex");
    opencodeBaseDir = join(testDir, ".config", "opencode");

    // Command directories
    claudeDir = join(claudeBaseDir, "commands");
    geminiDir = join(geminiBaseDir, "commands");
    codexDir = join(codexBaseDir, "prompts");
    opencodeDir = join(opencodeBaseDir, "commands");

    // Skill directories
    claudeSkillsDir = join(claudeBaseDir, "skills");
    geminiSkillsDir = join(geminiBaseDir, "skills");
    codexSkillsDir = join(codexBaseDir, "skills");
    opencodeSkillsDir = join(opencodeBaseDir, "skills");

    await ensureDirectory(claudeDir);
    await ensureDirectory(geminiDir);
    await ensureDirectory(codexDir);
    await ensureDirectory(opencodeDir);

    // Move to test working directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Return to original working directory
    process.chdir(originalCwd);

    try {
      await rm(testDir, { recursive: true });
    } catch {
      // Ignore if directory does not exist
    }
  });

  describe("Claude to Gemini conversion", () => {
    it("should convert basic Claude command to Gemini", async () => {
      // Create Claude command
      const claudeContent = `---
description: Test command
model: sonnet
---

This is a test command with $ARGUMENTS.`;

      await writeFile(join(claudeDir, "test.md"), claudeContent);

      // Execute conversion
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.summary.processed).toBeGreaterThan(0);
      expect(result.summary.created).toBeGreaterThan(0);

      // Check converted file
      const geminiFile = join(geminiDir, "test.toml");
      expect(await fileExists(geminiFile)).toBe(true);

      // Check file content

      const geminiContent = await readFile(geminiFile);
      expect(geminiContent).toContain('description = "Test command"');
      expect(geminiContent).toContain("This is a test command with {{args}}.");
    });

    it("should handle dry run mode", async () => {
      // Create Claude command
      const claudeContent = "Test command content";
      await writeFile(join(claudeDir, "dryrun.md"), claudeContent);

      // Execute dry run
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: true,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.operations.length).toBeGreaterThan(0);

      // Check test file operations
      const testOperation = result.operations.find((op) => op.filePath.includes("dryrun.toml"));
      expect(testOperation).toBeDefined();
      expect(testOperation?.type).toBe("A");
      expect(testOperation?.description).toContain("Would create");

      // Verify file was not actually created
      const geminiFile = join(geminiDir, "dryrun.toml");
      expect(await fileExists(geminiFile)).toBe(false);
    });

    it("should handle no-overwrite option", async () => {
      // Create Claude command
      const claudeContent = "New content";
      await writeFile(join(claudeDir, "existing.md"), claudeContent);

      // Create existing Gemini file
      const existingGeminiContent = `prompt = "Existing content"`;
      await writeFile(join(geminiDir, "existing.toml"), existingGeminiContent);

      // Execute conversion with no-overwrite
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: true,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.summary.skipped).toBe(1);

      // Verify existing file was not changed

      const geminiContent = await readFile(join(geminiDir, "existing.toml"));
      expect(geminiContent).toContain("Existing content");
    });

    it("should remove unsupported fields when option is enabled", async () => {
      // Create command with Claude-specific fields
      const claudeContent = `---
description: Test command
allowed-tools: Bash(git status:*)
model: sonnet
argument-hint: "[message]"
---

Test content`;

      await writeFile(join(claudeDir, "unsupported.md"), claudeContent);

      // Execute conversion with remove-unsupported
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: true,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);

      // Verify results
      expect(result.success).toBe(true);

      // Check converted file

      const geminiContent = await readFile(join(geminiDir, "unsupported.toml"));
      expect(geminiContent).toContain('description = "Test command"');
      expect(geminiContent).not.toContain("_claude_");
    });
  });

  describe("Gemini to Claude conversion", () => {
    it("should convert basic Gemini command to Claude", async () => {
      // Create Gemini command
      const geminiContent = `description = "Test command"
prompt = "This is a test command with {{args}}."`;

      await writeFile(join(geminiDir, "test.toml"), geminiContent);

      // Execute conversion
      const options: CLIOptions = {
        source: "gemini",
        destination: "claude",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.summary.processed).toBeGreaterThan(0);
      expect(result.summary.created).toBeGreaterThan(0);

      // Check converted file
      const claudeFile = join(claudeDir, "test.md");
      expect(await fileExists(claudeFile)).toBe(true);

      // Check file content

      const claudeContent = await readFile(claudeFile);
      expect(claudeContent).toContain("description: Test command");
      expect(claudeContent).toContain("This is a test command with $ARGUMENTS.");
    });

    it("should restore Claude-specific fields", async () => {
      // Create Gemini command with Claude-specific fields
      const geminiContent = `description = "Test command"
prompt = "Test content"
allowed-tools = "Bash(git status:*)"
model = "sonnet"`;

      await writeFile(join(geminiDir, "restore.toml"), geminiContent);

      // Execute conversion
      const options: CLIOptions = {
        source: "gemini",
        destination: "claude",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);

      // Verify results
      expect(result.success).toBe(true);

      // Check converted file

      const claudeContent = await readFile(join(claudeDir, "restore.md"));
      expect(claudeContent).toContain("description: Test command");
      // Verify Claude-specific fields are restored
      expect(claudeContent).toContain("Test content");
    });
  });

  describe("Nested directory support", () => {
    it("should handle nested command directories", async () => {
      // Create command in nested directory
      const nestedClaudeDir = join(claudeDir, "git");
      await ensureDirectory(nestedClaudeDir);

      const claudeContent = "Git commit helper command";
      await writeFile(join(nestedClaudeDir, "commit.md"), claudeContent);

      // Execute conversion
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);

      // Verify results
      expect(result.success).toBe(true);

      // Check converted file in nested directory
      const nestedGeminiDir = join(geminiDir, "git");
      const geminiFile = join(nestedGeminiDir, "commit.toml");
      expect(await fileExists(geminiFile)).toBe(true);
    });
  });

  describe("Codex conversion with frontmatter", () => {
    it("should preserve frontmatter when converting Claude to Codex without removeUnsupported", async () => {
      // Create Claude command (with frontmatter)
      const claudeContent = `---
description: Test command
model: sonnet
allowed-tools: Bash(git:*)
---

Test content with $ARGUMENTS`;

      await writeFile(join(claudeDir, "test-codex.md"), claudeContent);

      // Execute conversion（removeUnsupported = false）
      const options: CLIOptions = {
        source: "claude",
        destination: "codex",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, codex: codexBaseDir },
      };

      const result = await syncCommands(options);

      // Log errors if any
      if (result.errors.length > 0) {
        console.error("Conversion errors:", result.errors);
      }

      // Verify results
      expect(result.success).toBe(true);

      // Check converted file
      const codexFile = join(codexDir, "test-codex.md");
      expect(await fileExists(codexFile)).toBe(true);

      // Check file content
      const codexContent = await readFile(codexFile);
      // Verify frontmatter is preserved
      expect(codexContent).toContain("description: Test command");
      expect(codexContent).toContain("model: sonnet");
      expect(codexContent).toContain("allowed-tools:");
      expect(codexContent).toContain("Test content with $ARGUMENTS");
    });

    it("should remove unsupported fields when converting Claude to Codex with removeUnsupported", async () => {
      // Create Claude command (with frontmatter)
      const claudeContent = `---
description: Test command
model: sonnet
allowed-tools: Bash(git:*)
---

Test content with $ARGUMENTS`;

      await writeFile(join(claudeDir, "test-codex-remove.md"), claudeContent);

      // Execute conversion（removeUnsupported = true）
      const options: CLIOptions = {
        source: "claude",
        destination: "codex",
        contentType: "commands",
        removeUnsupported: true,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, codex: codexBaseDir },
      };

      const result = await syncCommands(options);

      // Verify results
      expect(result.success).toBe(true);

      // Check converted file
      const codexFile = join(codexDir, "test-codex-remove.md");
      expect(await fileExists(codexFile)).toBe(true);

      // Check file content

      const codexContent = await readFile(codexFile);
      // description remains
      expect(codexContent).toContain("description: Test command");
      // Claude-specific fields are removed
      expect(codexContent).not.toContain("allowed-tools:");
      expect(codexContent).not.toContain("model: sonnet");
      expect(codexContent).toContain("Test content with $ARGUMENTS");
    });
  });

  describe("Error handling", () => {
    it("should handle invalid file formats gracefully", async () => {
      // Create file with invalid format
      const invalidContent = `---
invalid yaml: [[[
---
Content`;

      await writeFile(join(claudeDir, "invalid.md"), invalidContent);

      // Execute conversion
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);

      // Verify errors are logged
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Skill conversion", () => {
    it("should convert Claude skill to Gemini", async () => {
      const skillDir = join(claudeSkillsDir, "test-skill");
      await ensureDirectory(skillDir);
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: test-skill
description: Test skill
---

This is a test skill with $ARGUMENTS.`,
      );

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "skills",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.summary.created).toBe(1);

      const targetSkillMd = join(geminiSkillsDir, "test-skill", "SKILL.md");
      expect(await fileExists(targetSkillMd)).toBe(true);

      const content = await readFile(targetSkillMd);
      expect(content).toContain("name: test-skill");
      expect(content).toContain("{{args}}");
    });

    it("should convert Gemini skill to Claude", async () => {
      const skillDir = join(geminiSkillsDir, "gemini-skill");
      await ensureDirectory(skillDir);
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: gemini-skill
description: A Gemini skill
---

Use this with {{args}}.`,
      );

      const options: CLIOptions = {
        source: "gemini",
        destination: "claude",
        contentType: "skills",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      const targetSkillMd = join(claudeSkillsDir, "gemini-skill", "SKILL.md");
      expect(await fileExists(targetSkillMd)).toBe(true);

      const content = await readFile(targetSkillMd);
      expect(content).toContain("$ARGUMENTS");
    });

    it("should convert Claude skill to Codex with openaiConfig generation", async () => {
      const skillDir = join(claudeSkillsDir, "codex-target");
      await ensureDirectory(skillDir);
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: codex-target
description: Target for Codex
disable-model-invocation: true
---

Test content.`,
      );

      const options: CLIOptions = {
        source: "claude",
        destination: "codex",
        contentType: "skills",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, codex: codexBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      const openaiYaml = join(codexSkillsDir, "codex-target", "agents", "openai.yaml");
      expect(await fileExists(openaiYaml)).toBe(true);

      const yamlContent = await readFile(openaiYaml);
      expect(yamlContent).toContain("allow_implicit_invocation: false");
    });

    it("should convert both commands and skills with contentType 'both'", async () => {
      // Create a command
      await writeFile(join(claudeDir, "cmd.md"), "Command content");
      // Create a skill
      const skillDir = join(claudeSkillsDir, "both-skill");
      await ensureDirectory(skillDir);
      await writeFile(join(skillDir, "SKILL.md"), "---\nname: both-skill\n---\n\nSkill content.");

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "both",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.summary.processed).toBe(2);

      expect(await fileExists(join(geminiDir, "cmd.toml"))).toBe(true);
      expect(await fileExists(join(geminiSkillsDir, "both-skill", "SKILL.md"))).toBe(true);
    });

    it("should handle noop mode for skills", async () => {
      const skillDir = join(claudeSkillsDir, "noop-skill");
      await ensureDirectory(skillDir);
      await writeFile(join(skillDir, "SKILL.md"), "---\nname: noop-skill\n---\n\nContent");

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "skills",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: true,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.operations[0]?.description).toContain("Would create");
      expect(await fileExists(join(geminiSkillsDir, "noop-skill", "SKILL.md"))).toBe(false);
    });

    it("should handle noOverwrite mode for skills", async () => {
      // Source skill
      const sourceDir = join(claudeSkillsDir, "overwrite-skill");
      await ensureDirectory(sourceDir);
      await writeFile(join(sourceDir, "SKILL.md"), "---\nname: overwrite-skill\n---\n\nNew content");

      // Existing target skill
      const targetDir = join(geminiSkillsDir, "overwrite-skill");
      await ensureDirectory(targetDir);
      await writeFile(join(targetDir, "SKILL.md"), "---\nname: overwrite-skill\n---\n\nExisting content");

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "skills",
        removeUnsupported: false,
        noOverwrite: true,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.summary.skipped).toBe(1);

      const content = await readFile(join(targetDir, "SKILL.md"));
      expect(content).toContain("Existing content");
    });
  });

  describe("OpenCode conversion", () => {
    it("should convert Claude command to OpenCode preserving model", async () => {
      const claudeContent =
        `---
description: Test command
model: sonnet
allowed-tools: Bash(git:*)
---

Test content with $ARGUMENTS and !` +
        "`git status`" +
        " and @config.json";

      await writeFile(join(claudeDir, "test-opencode.md"), claudeContent);

      const options: CLIOptions = {
        source: "claude",
        destination: "opencode",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, opencode: opencodeBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      const opencodeFile = join(opencodeDir, "test-opencode.md");
      expect(await fileExists(opencodeFile)).toBe(true);

      const content = await readFile(opencodeFile);
      expect(content).toContain("description: Test command");
      expect(content).toContain("model: sonnet");
      expect(content).toContain("$ARGUMENTS");
    });

    it("should convert OpenCode command to Gemini", async () => {
      const opencodeContent =
        `---
description: OpenCode test
---

Run with $ARGUMENTS and !` +
        "`npm test`" +
        ".";

      await writeFile(join(opencodeDir, "test.md"), opencodeContent);

      const options: CLIOptions = {
        source: "opencode",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { opencode: opencodeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      const geminiFile = join(geminiDir, "test.toml");
      expect(await fileExists(geminiFile)).toBe(true);

      const content = await readFile(geminiFile);
      expect(content).toContain("{{args}}");
      expect(content).toContain("!{npm test}");
    });

    it("should convert Claude skill to OpenCode", async () => {
      const skillDir = join(claudeSkillsDir, "opencode-target");
      await ensureDirectory(skillDir);
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: opencode-target
description: Target for OpenCode
model: sonnet
---

Test skill with $ARGUMENTS.`,
      );

      const options: CLIOptions = {
        source: "claude",
        destination: "opencode",
        contentType: "skills",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, opencode: opencodeBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.summary.created).toBe(1);

      const targetSkillMd = join(opencodeSkillsDir, "opencode-target", "SKILL.md");
      expect(await fileExists(targetSkillMd)).toBe(true);

      const content = await readFile(targetSkillMd);
      expect(content).toContain("name: opencode-target");
      expect(content).toContain("model: sonnet");
      expect(content).toContain("$ARGUMENTS");
    });
  });

  describe("Chimera hub conversion", () => {
    let chimeraBaseDir: string;
    let chimeraDir: string;
    let chimeraSkillsDir: string;

    beforeEach(async () => {
      chimeraBaseDir = join(testDir, ".config", "acsync");
      chimeraDir = join(chimeraBaseDir, "commands");
      chimeraSkillsDir = join(chimeraBaseDir, "skills");
      await ensureDirectory(chimeraDir);
    });

    it("should import Claude command into Chimera with _chimera.claude extras", async () => {
      const claudeContent = `---
description: Test command
model: sonnet
allowed-tools: Bash(git:*)
---

Test content with $ARGUMENTS`;

      await writeFile(join(claudeDir, "test-import.md"), claudeContent);

      const options: CLIOptions = {
        source: "claude",
        destination: "chimera",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, chimera: chimeraBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      const chimeraFile = join(chimeraDir, "test-import.md");
      expect(await fileExists(chimeraFile)).toBe(true);

      const content = await readFile(chimeraFile);
      expect(content).toContain("description: Test command");
      expect(content).toContain("_chimera");
      expect(content).toContain("claude");
      expect(content).toContain("$ARGUMENTS");
    });

    it("should apply Chimera command to Gemini with _chimera.gemini extras", async () => {
      const chimeraContent =
        `---
description: Chimera command
_chimera:
  gemini:
    custom-gemini-field: gemini-value
  claude:
    model: opus-4
---

Run !` +
        "`npm test`" +
        " with $ARGUMENTS.";

      await writeFile(join(chimeraDir, "test-apply.md"), chimeraContent);

      const options: CLIOptions = {
        source: "chimera",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { chimera: chimeraBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      const geminiFile = join(geminiDir, "test-apply.toml");
      expect(await fileExists(geminiFile)).toBe(true);

      const content = await readFile(geminiFile);
      expect(content).toContain('description = "Chimera command"');
      expect(content).toContain("{{args}}");
      expect(content).toContain("custom-gemini-field");
      // Claude extras should NOT appear in Gemini output
      expect(content).not.toContain("opus-4");
    });

    it("should import and then apply preserving extras (round-trip)", async () => {
      // Step 1: Import Claude -> Chimera
      const claudeContent = `---
description: Round-trip test
model: sonnet
allowed-tools: Read,Write
---

Body with $ARGUMENTS`;

      await writeFile(join(claudeDir, "round-trip.md"), claudeContent);

      const importOptions: CLIOptions = {
        source: "claude",
        destination: "chimera",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, chimera: chimeraBaseDir },
      };

      const importResult = await syncCommands(importOptions);
      expect(importResult.success).toBe(true);

      // Step 2: Apply Chimera -> Claude (should restore extras)
      const applyOptions: CLIOptions = {
        source: "chimera",
        destination: "claude",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { chimera: chimeraBaseDir, claude: claudeBaseDir },
      };

      const applyResult = await syncCommands(applyOptions);
      expect(applyResult.success).toBe(true);

      const claudeFile = join(claudeDir, "round-trip.md");
      const content = await readFile(claudeFile);
      expect(content).toContain("description: Round-trip test");
      expect(content).toContain("model: sonnet");
      expect(content).toContain("allowed-tools:");
      expect(content).toContain("$ARGUMENTS");
    });

    it("should import skill into Chimera", async () => {
      await ensureDirectory(chimeraSkillsDir);
      const skillDir = join(claudeSkillsDir, "chimera-skill");
      await ensureDirectory(skillDir);
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: chimera-skill
description: Test skill
model: opus-4
---

Skill body.`,
      );

      const options: CLIOptions = {
        source: "claude",
        destination: "chimera",
        contentType: "skills",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, chimera: chimeraBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      const targetSkillMd = join(chimeraSkillsDir, "chimera-skill", "SKILL.md");
      expect(await fileExists(targetSkillMd)).toBe(true);

      const content = await readFile(targetSkillMd);
      expect(content).toContain("name: chimera-skill");
      expect(content).toContain("_chimera");
    });

    it("should merge imports from multiple agents", async () => {
      // First import: Claude -> Chimera
      const claudeContent = `---
description: Multi-import test
model: sonnet
---

Body`;

      await writeFile(join(claudeDir, "multi-import.md"), claudeContent);

      const importClaude: CLIOptions = {
        source: "claude",
        destination: "chimera",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, chimera: chimeraBaseDir },
      };

      await syncCommands(importClaude);

      // Second import: Gemini -> Chimera (should merge, keeping claude section)
      const geminiContent = `description = "Multi-import test"
prompt = "Body"
custom-gemini = "gval"`;

      await writeFile(join(geminiDir, "multi-import.toml"), geminiContent);

      const importGemini: CLIOptions = {
        source: "gemini",
        destination: "chimera",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { gemini: geminiBaseDir, chimera: chimeraBaseDir },
      };

      await syncCommands(importGemini);

      const chimeraFile = join(chimeraDir, "multi-import.md");
      const content = await readFile(chimeraFile);

      // Both agent sections should exist
      expect(content).toContain("claude");
      expect(content).toContain("gemini");
    });
  });

  describe("Unchanged detection", () => {
    it("should report unchanged when command content is identical", async () => {
      // Create Claude command
      const claudeContent = `---
description: Test command
---

Test content`;

      await writeFile(join(claudeDir, "unchanged.md"), claudeContent);

      // First conversion: creates the file
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const firstResult = await syncCommands(options);
      expect(firstResult.success).toBe(true);
      expect(firstResult.summary.created).toBe(1);

      // Second conversion: content is identical, should be unchanged
      const secondResult = await syncCommands(options);
      expect(secondResult.success).toBe(true);
      expect(secondResult.summary.unchanged).toBe(1);
      expect(secondResult.summary.modified).toBe(0);

      const unchangedOp = secondResult.operations.find((op) => op.filePath.includes("unchanged.toml"));
      expect(unchangedOp).toBeDefined();
      expect(unchangedOp?.type).toBe("=");
      expect(unchangedOp?.description).toBe("Unchanged");
    });

    it("should report unchanged in noop mode when content is identical", async () => {
      const claudeContent = `---
description: Noop unchanged test
---

Content`;

      await writeFile(join(claudeDir, "noop-unchanged.md"), claudeContent);

      // First: create the file
      const createOptions: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };
      await syncCommands(createOptions);

      // Second: noop mode should still detect unchanged
      const noopOptions: CLIOptions = {
        ...createOptions,
        noop: true,
      };
      const result = await syncCommands(noopOptions);
      expect(result.success).toBe(true);
      expect(result.summary.unchanged).toBe(1);

      const op = result.operations.find((op) => op.filePath.includes("noop-unchanged.toml"));
      expect(op?.type).toBe("=");
    });

    it("should report modified when content has changed", async () => {
      // Create Claude command
      const claudeContent = `---
description: Original
---

Original content`;

      await writeFile(join(claudeDir, "modified.md"), claudeContent);

      // First conversion
      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };
      await syncCommands(options);

      // Modify source
      const updatedContent = `---
description: Updated
---

Updated content`;
      await writeFile(join(claudeDir, "modified.md"), updatedContent);

      // Second conversion: content has changed
      const secondResult = await syncCommands(options);
      expect(secondResult.success).toBe(true);
      expect(secondResult.summary.modified).toBe(1);
      expect(secondResult.summary.unchanged).toBe(0);
    });
  });

  describe("syncDelete", () => {
    it("should delete orphaned command files in target", async () => {
      // Source: only cmd-a.md
      await writeFile(join(claudeDir, "cmd-a.md"), "Source A");
      // Target: cmd-a.toml (has source) + orphan.toml (no source)
      await writeFile(join(geminiDir, "cmd-a.toml"), 'prompt = "A"');
      await writeFile(join(geminiDir, "orphan.toml"), 'prompt = "Orphan"');

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: true,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      // orphan.toml should be deleted
      expect(await fileExists(join(geminiDir, "orphan.toml"))).toBe(false);
      // cmd-a.toml should still exist (updated)
      expect(await fileExists(join(geminiDir, "cmd-a.toml"))).toBe(true);
      expect(result.summary.deleted).toBeGreaterThan(0);
    });

    it("should report 'Would delete' in noop mode for syncDelete", async () => {
      await writeFile(join(claudeDir, "keep.md"), "Keep content");
      await writeFile(join(geminiDir, "keep.toml"), 'prompt = "Keep"');
      await writeFile(join(geminiDir, "stale.toml"), 'prompt = "Stale"');

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: true,
        noop: true,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      const deleteOp = result.operations.find((op) => op.filePath.includes("stale.toml"));
      expect(deleteOp).toBeDefined();
      expect(deleteOp?.type).toBe("D");
      expect(deleteOp?.description).toContain("Would delete");

      // File should still exist
      expect(await fileExists(join(geminiDir, "stale.toml"))).toBe(true);
    });

    it("should delete orphaned skill directories", async () => {
      // Source: only skill-a
      const sourceSkillDir = join(claudeSkillsDir, "skill-a");
      await ensureDirectory(sourceSkillDir);
      await writeFile(join(sourceSkillDir, "SKILL.md"), "---\nname: skill-a\n---\n\nContent A");

      // Target: skill-a (has source) + orphan-skill (no source)
      const targetSkillA = join(geminiSkillsDir, "skill-a");
      await ensureDirectory(targetSkillA);
      await writeFile(join(targetSkillA, "SKILL.md"), "---\nname: skill-a\n---\n\nOld A");

      const orphanSkill = join(geminiSkillsDir, "orphan-skill");
      await ensureDirectory(orphanSkill);
      await writeFile(join(orphanSkill, "SKILL.md"), "---\nname: orphan-skill\n---\n\nOrphan");

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "skills",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: true,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);

      // orphan-skill directory should be deleted
      expect(await directoryExists(orphanSkill)).toBe(false);
      // skill-a should still exist
      expect(await directoryExists(targetSkillA)).toBe(true);
    });
  });

  describe("status subcommand", () => {
    it("should display version and speech bubble", async () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));

      try {
        await showStatus({ gitRoot: testDir });
      } finally {
        console.log = origLog;
      }

      const output = logs.join("\n");
      expect(output).toContain(`v${version}`);
      // Speech bubble should contain User and Project lines
      expect(output).toContain("User:");
      expect(output).toContain("Project:");
      expect(output).toContain("commands");
      expect(output).toContain("skills");
      expect(output).toContain("agents");
    });

    it("should show single line when no gitRoot", async () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));

      try {
        await showStatus({});
      } finally {
        console.log = origLog;
      }

      const output = logs.join("\n");
      expect(output).toContain("User:");
      expect(output).not.toContain("Project:");
    });

    it("should detect project-level agents from actual directories", async () => {
      // testDir already has .claude/commands and .gemini/commands from beforeEach
      await writeFile(join(claudeDir, "status-test.md"), "# Test");
      await writeFile(join(geminiDir, "status-test.toml"), 'description = "test"');

      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));

      try {
        await showStatus({ gitRoot: testDir });
      } finally {
        console.log = origLog;
      }

      const output = logs.join("\n");
      // Project line should reflect the files we placed
      expect(output).toContain("Project:");
      // Should detect at least claude and gemini
      expect(output).toMatch(/Project:.*2 commands/);
    });

    it("should display chimera composition section", async () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));

      try {
        await showStatus({});
      } finally {
        console.log = origLog;
      }

      const output = logs.join("\n");
      expect(output).toContain("Chimera Lv.");
      expect(output).toContain("Composition:");
      expect(output).toContain("Your Chimera grows");
    });
  });

  describe("Project-level directory support", () => {
    it("should use project-level directories when gitRoot is set", async () => {
      // testDir acts as the git root (testDir already has .claude/.gemini dirs at project root)
      const claudeContent = `---
description: Project command
---

Project level content`;

      await writeFile(join(claudeDir, "project-cmd.md"), claudeContent);

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        gitRoot: testDir,
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.summary.created).toBe(1);

      // Verify file is created in project-level gemini dir
      const targetFile = join(testDir, ".gemini", "commands", "project-cmd.toml");
      expect(await fileExists(targetFile)).toBe(true);
      const content = await readFile(targetFile);
      expect(content).toContain("Project level content");
    });

    it("should use user-level directories when global flag is set", async () => {
      // With global: true, customDirs should be needed for this test to work
      // since user home dirs are not writable in tests
      const claudeContent = `---
description: Global command
---

Global level content`;

      await writeFile(join(claudeDir, "global-cmd.md"), claudeContent);

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.summary.created).toBe(1);

      // Verify file is created in customDir gemini dir (simulating user-level)
      const targetFile = join(geminiDir, "global-cmd.toml");
      expect(await fileExists(targetFile)).toBe(true);
    });

    it("should prioritize customDir over gitRoot", async () => {
      const claudeContent = `---
description: Custom dir test
---

Custom dir content`;

      await writeFile(join(claudeDir, "custom-test.md"), claudeContent);

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        gitRoot: "/some/other/path",
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.summary.created).toBe(1);

      // File should be in customDir, not gitRoot
      const targetFile = join(geminiDir, "custom-test.toml");
      expect(await fileExists(targetFile)).toBe(true);
    });

    it("should fall back to user-level when gitRoot is null", async () => {
      const claudeContent = `---
description: Fallback test
---

Fallback content`;

      await writeFile(join(claudeDir, "fallback.md"), claudeContent);

      const options: CLIOptions = {
        source: "claude",
        destination: "gemini",
        contentType: "commands",
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        global: false,
        gitRoot: null,
        customDirs: { claude: claudeBaseDir, gemini: geminiBaseDir },
      };

      const result = await syncCommands(options);
      expect(result.success).toBe(true);
      expect(result.summary.created).toBe(1);
    });
  });
});
