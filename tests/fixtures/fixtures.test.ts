import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ClaudeParser } from "../../src/parsers/claude-parser.js";
import { GeminiParser } from "../../src/parsers/gemini-parser.js";

const fixturesDir = join(__dirname, ".");

describe("Agent Slash Sync Tests", () => {
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
      const { resolveCommandDir } = await import("../../src/utils/file-utils.js");
      const { AGENT_REGISTRY } = await import("../../src/agents/registry.js");

      const claudeDirs = resolveCommandDir(AGENT_REGISTRY.claude, "/custom/claude");
      expect(claudeDirs.user).toBe("/custom/claude/commands");

      const geminiDirs = resolveCommandDir(AGENT_REGISTRY.gemini, "/custom/gemini");
      expect(geminiDirs.user).toBe("/custom/gemini/commands");
    });

    it("should use default directories when custom directories not specified", async () => {
      const { resolveCommandDir } = await import("../../src/utils/file-utils.js");
      const { AGENT_REGISTRY } = await import("../../src/agents/registry.js");
      const { homedir } = await import("node:os");

      const claudeDirs = resolveCommandDir(AGENT_REGISTRY.claude);
      expect(claudeDirs.user).toBe(join(homedir(), ".claude", "commands"));

      const geminiDirs = resolveCommandDir(AGENT_REGISTRY.gemini);
      expect(geminiDirs.user).toBe(join(homedir(), ".gemini", "commands"));
    });

    it("should handle tilde expansion in custom directories", async () => {
      const { resolveCommandDir } = await import("../../src/utils/file-utils.js");
      const { AGENT_REGISTRY } = await import("../../src/agents/registry.js");
      const { homedir } = await import("node:os");

      const claudeDirs = resolveCommandDir(AGENT_REGISTRY.claude, "~/custom-claude");
      expect(claudeDirs.user).toBe(join(homedir(), "custom-claude", "commands"));

      const geminiDirs = resolveCommandDir(AGENT_REGISTRY.gemini, "~/custom-gemini");
      expect(geminiDirs.user).toBe(join(homedir(), "custom-gemini", "commands"));
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
    it("should validate CLI options with customDirs", async () => {
      const { validateCLIOptions } = await import("../../src/cli/options.js");

      const options = {
        source: "claude" as const,
        destination: "gemini" as const,
        contentType: "commands" as const,
        removeUnsupported: false,
        noOverwrite: true,
        syncDelete: false,
        noop: true,
        verbose: true,
        customDirs: { claude: "~/custom-claude", gemini: "~/custom-gemini" },
      };

      const errors = validateCLIOptions(options);
      expect(errors).toHaveLength(0);
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
        customDirs: { claude: "~/claude-commands", gemini: "~/gemini-commands" },
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
      expect(errors[0]).toContain("--src must be one of");
    });
  });
});
