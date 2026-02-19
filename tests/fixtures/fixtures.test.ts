import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ClaudeParser } from "../../src/parsers/claude-parser.js";
import { GeminiParser } from "../../src/parsers/gemini-parser.js";

const fixturesDir = join(__dirname, ".");

describe("Agent Slash Sync Tests", () => {
  describe("Parser Tests", () => {
    it("should parse Claude command with all fields", async () => {
      const parser = new ClaudeParser();
      const filePath = join(fixturesDir, "claude-commands", "with-tools.md");

      const result = await parser.parse(filePath);

      expect(result.frontmatter["allowed-tools"]).toContain("Bash(git status:*)");
      expect(result.frontmatter["argument-hint"]).toBeDefined();
      expect(result.content).toContain("!git status");
      expect(parser.validate(result)).toBe(true);
    });

    it("should parse Claude command without frontmatter", async () => {
      const parser = new ClaudeParser();
      const filePath = join(fixturesDir, "claude-commands", "no-frontmatter.md");

      const result = await parser.parse(filePath);

      expect(result.frontmatter).toEqual({});
      expect(result.content).toContain("Simple command without any frontmatter");
      expect(parser.validate(result)).toBe(true);
    });

    it("should parse Gemini command with shell execution", async () => {
      const parser = new GeminiParser();
      const filePath = join(fixturesDir, "gemini-commands", "with-shell.toml");

      const result = await parser.parse(filePath);

      expect(result.prompt).toContain("!{git status}");
      expect(parser.validate(result)).toBe(true);
    });

    it("should parse Codex command without frontmatter", async () => {
      const { CodexParser } = await import("../../src/parsers/codex-parser.js");
      const parser = new CodexParser();
      const filePath = join(fixturesDir, "codex-commands", "simple.md");

      const result = await parser.parse(filePath);

      expect(result.content).toContain("simple Codex custom prompt");
      expect(result.frontmatter).toBeUndefined();
      expect(parser.validate(result)).toBe(true);
    });

    it("should parse Codex command with frontmatter", async () => {
      const { CodexParser } = await import("../../src/parsers/codex-parser.js");
      const parser = new CodexParser();
      const filePath = join(fixturesDir, "codex-commands", "with-frontmatter.md");

      const result = await parser.parse(filePath);

      expect(result.content).toContain("Codex command that includes frontmatter");
      expect(result.frontmatter).toBeDefined();
      expect(result.frontmatter?.description).toBe("Codex command with frontmatter");
      expect(result.frontmatter?.model).toBe("gpt-4");
      expect(result.frontmatter?.temperature).toBe(0.7);
      expect(parser.validate(result)).toBe(true);
    });
  });

  describe("Placeholder Conversions", () => {
    it("should convert file references between Claude and Gemini", async () => {
      const { convertClaudeToGeminiPlaceholders, convertGeminiToClaudePlaceholders, convertFileReferences } =
        await import("../../src/utils/placeholder-utils.js");

      // Claude to Gemini file reference conversion
      const claudeContent = "Load config from @config.json and template from @templates/main.html";
      const geminiContent = convertClaudeToGeminiPlaceholders(claudeContent);
      expect(geminiContent).toBe("Load config from @{config.json} and template from @{templates/main.html}");

      // Gemini to Claude file reference conversion
      const geminiSource = "Include @{src/main.ts} and @{README.md}";
      const claudeResult = convertGeminiToClaudePlaceholders(geminiSource);
      expect(claudeResult).toBe("Include @src/main.ts and @README.md");

      // Using convertFileReferences function
      const testContent = "Load @settings.yml and @data/users.json";
      expect(convertFileReferences(testContent, "c2g")).toBe("Load @{settings.yml} and @{data/users.json}");
      expect(convertFileReferences("@{config.toml}", "g2c")).toBe("@config.toml");
    });

    it("should preserve individual argument placeholders", async () => {
      const { convertClaudeToGeminiPlaceholders, convertGeminiToClaudePlaceholders } = await import(
        "../../src/utils/placeholder-utils.js"
      );

      // Individual arguments should be preserved (not converted)
      const claudeContent = "First: $1, Second: $2, All: $ARGUMENTS";
      const geminiContent = convertClaudeToGeminiPlaceholders(claudeContent);
      expect(geminiContent).toBe("First: $1, Second: $2, All: {{args}}");

      // Reverse conversion should also preserve individual arguments
      const geminiSource = "Args: {{args}}, First: $1, Last: $9";
      const claudeResult = convertGeminiToClaudePlaceholders(geminiSource);
      expect(claudeResult).toBe("Args: $ARGUMENTS, First: $1, Last: $9");
    });

    it("should handle mixed placeholders correctly", async () => {
      const { convertClaudeToGeminiPlaceholders, convertGeminiToClaudePlaceholders } = await import(
        "../../src/utils/placeholder-utils.js"
      );

      // Mixed Claude placeholders
      const claudeMixed = "Run !`git status` with $ARGUMENTS and load @config.json for user $1";
      const geminiMixed = convertClaudeToGeminiPlaceholders(claudeMixed);
      expect(geminiMixed).toBe("Run !{git status} with {{args}} and load @{config.json} for user $1");

      // Mixed Gemini placeholders
      const geminiMixed2 = "Execute !{npm test} with {{args}} and @{package.json}";
      const claudeMixed2 = convertGeminiToClaudePlaceholders(geminiMixed2);
      expect(claudeMixed2).toBe("Execute !`npm test` with $ARGUMENTS and @package.json");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty files gracefully", async () => {
      const parser = new ClaudeParser();
      const filePath = join(fixturesDir, "edge-cases", "empty.md");

      const result = await parser.parse(filePath);

      expect(result.content).toBe("");
      expect(parser.validate(result)).toBe(true);
    });

    it("should handle invalid YAML frontmatter", async () => {
      const parser = new ClaudeParser();
      const filePath = join(fixturesDir, "edge-cases", "invalid-yaml.md");

      await expect(parser.parse(filePath)).rejects.toThrow("Failed to parse Claude command file");
    });

    it("should handle special characters", async () => {
      const parser = new ClaudeParser();
      const filePath = join(fixturesDir, "edge-cases", "special-chars.md");

      const result = await parser.parse(filePath);

      expect(result.frontmatter.description).toContain("éñ中文🚀");
      expect(result.content).toContain("éñ中文🚀");
      expect(parser.validate(result)).toBe(true);
    });

    it("should handle invalid TOML", async () => {
      const parser = new GeminiParser();
      const filePath = join(fixturesDir, "edge-cases", "invalid.toml");

      await expect(parser.parse(filePath)).rejects.toThrow("Failed to parse Gemini command file");
    });
  });

  describe("Custom Directory Support", () => {
    it("should use custom directories when specified", async () => {
      const { getCommandDirectories } = await import("../../src/utils/file-utils.js");

      const customClaudeDir = "/custom/claude";
      const customGeminiDir = "/custom/gemini";

      const directories = getCommandDirectories(customClaudeDir, customGeminiDir);

      expect(directories.claude.user).toBe("/custom/claude/commands");
      expect(directories.gemini.user).toBe("/custom/gemini/commands");
    });

    it("should use default directories when custom directories not specified", async () => {
      const { getCommandDirectories } = await import("../../src/utils/file-utils.js");
      const { homedir } = await import("node:os");

      const directories = getCommandDirectories();

      expect(directories.claude.user).toBe(join(homedir(), ".claude", "commands"));
      expect(directories.gemini.user).toBe(join(homedir(), ".gemini", "commands"));
    });

    it("should handle tilde expansion in custom directories", async () => {
      const { getCommandDirectories } = await import("../../src/utils/file-utils.js");
      const { homedir } = await import("node:os");

      const directories = getCommandDirectories("~/custom-claude", "~/custom-gemini");

      expect(directories.claude.user).toBe(join(homedir(), "custom-claude", "commands"));
      expect(directories.gemini.user).toBe(join(homedir(), "custom-gemini", "commands"));
    });

    it("should pass custom directories to file search functions", async () => {
      const { findClaudeCommands, findGeminiCommands } = await import("../../src/utils/file-utils.js");

      // This test is just to ensure the custom directories are used
      // The actual functionality is tested in integration tests
      await expect(findClaudeCommands(undefined, "/non-existent-claude")).resolves.toEqual([]);
      await expect(findGeminiCommands(undefined, "/non-existent-gemini")).resolves.toEqual([]);
    });
  });

  describe("TOML Output Format", () => {
    it("should output prompt field last in TOML", async () => {
      const parser = new GeminiParser();
      const command = {
        description: "Test command",
        model: "test-model",
        prompt: "Test prompt content",
        filePath: "test.toml",
      };

      const toml = parser.stringify(command);
      const lines = toml.trim().split("\n");

      // Find the index of each field
      const descriptionIndex = lines.findIndex((line) => line.includes("description = "));
      const modelIndex = lines.findIndex((line) => line.includes("model = "));
      const promptIndex = lines.findIndex((line) => line.includes("prompt = "));

      // Ensure prompt comes after other fields
      expect(promptIndex).toBeGreaterThan(descriptionIndex);
      expect(promptIndex).toBeGreaterThan(modelIndex);
    });

    it("should handle empty description correctly", async () => {
      const parser = new GeminiParser();
      const command = {
        prompt: "Test prompt",
        filePath: "test.toml",
      };

      const toml = parser.stringify(command);
      expect(toml).not.toContain("description");
      expect(toml).toContain("prompt = ");
    });
  });

  describe("CLI Options Integration", () => {
    it("should handle conversion options with custom directories", async () => {
      const { cliOptionsToConversionOptions } = await import("../../src/cli/options.js");

      const cliOptions = {
        source: "claude" as const,
        destination: "gemini" as const,
        contentType: "commands" as const,
        removeUnsupported: false,
        noOverwrite: true,
        syncDelete: false,
        noop: true,
        verbose: true,
        claudeDir: "~/custom-claude",
        geminiDir: "~/custom-gemini",
      };

      const conversionOptions = cliOptionsToConversionOptions(cliOptions);

      expect(conversionOptions.source).toBe("claude");
      expect(conversionOptions.destination).toBe("gemini");
      expect(conversionOptions.removeUnsupported).toBe(false);
      expect(conversionOptions.noOverwrite).toBe(true);
      expect(conversionOptions.syncDelete).toBe(false);
      expect(conversionOptions.noop).toBe(true);
      expect(conversionOptions.verbose).toBe(true);
      expect(conversionOptions.claudeDir).toBe("~/custom-claude");
      expect(conversionOptions.geminiDir).toBe("~/custom-gemini");
    });

    it("should validate CLI options correctly", async () => {
      const { validateCLIOptions } = await import("../../src/cli/options.js");

      const validOptions = {
        source: "claude" as const,
        destination: "gemini" as const,
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
        claudeDir: "~/claude-commands",
        geminiDir: "~/gemini-commands",
      };

      const errors = validateCLIOptions(validOptions);
      expect(errors).toHaveLength(0);
    });

    it("should reject invalid source/destination in CLI options", async () => {
      const { validateCLIOptions } = await import("../../src/cli/options.js");

      const invalidOptions = {
        // biome-ignore lint/suspicious/noExplicitAny: intentional any for testing invalid input
        source: "invalid" as any,
        destination: "gemini" as const,
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        noop: false,
        verbose: false,
      };

      const errors = validateCLIOptions(invalidOptions);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('--src must be one of "claude", "gemini", or "codex"');
    });
  });
});
