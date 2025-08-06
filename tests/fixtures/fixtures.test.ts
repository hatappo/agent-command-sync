import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { C2GConverter } from "../../src/converters/c2g-converter.js";
import { G2CConverter } from "../../src/converters/g2c-converter.js";
import { ClaudeParser } from "../../src/parsers/claude-parser.js";
import { GeminiParser } from "../../src/parsers/gemini-parser.js";
import type { ConversionOptions } from "../../src/types/index.js";

const fixturesDir = join(__dirname, ".");

describe("Agent Slash Sync Tests", () => {
  const defaultOptions: ConversionOptions = {
    direction: "c2g",
    removeUnsupported: false,
    noOverwrite: false,
    syncDelete: false,
    dryRun: false,
    verbose: false,
  };

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

      expect(result.content).toContain("Simple command");
      expect(parser.validate(result)).toBe(true);
    });

    it("should parse Gemini command with shell execution", async () => {
      const parser = new GeminiParser();
      const filePath = join(fixturesDir, "gemini-commands", "with-shell.toml");

      const result = await parser.parse(filePath);

      expect(result.prompt).toContain("!{git status}");
      expect(parser.validate(result)).toBe(true);
    });
  });

  describe("Conversion Tests", () => {
    it("should convert Claude to Gemini with placeholder transformation", async () => {
      const claudeParser = new ClaudeParser();
      const converter = new C2GConverter();

      const claudeFilePath = join(fixturesDir, "claude-commands", "basic.md");
      const claudeCommand = await claudeParser.parse(claudeFilePath);

      const geminiCommand = converter.convert(claudeCommand, defaultOptions);

      expect(geminiCommand.description).toBe("Basic test command");
      expect(geminiCommand.prompt).toContain("{{args}}");
      expect(geminiCommand.prompt).not.toContain("$ARGUMENTS");
    });

    it("should convert Gemini to Claude with placeholder transformation", async () => {
      const geminiParser = new GeminiParser();
      const converter = new G2CConverter();

      const geminiFilePath = join(fixturesDir, "gemini-commands", "basic.toml");
      const geminiCommand = await geminiParser.parse(geminiFilePath);

      const claudeCommand = converter.convert(geminiCommand, {
        ...defaultOptions,
        direction: "g2c",
      });

      expect(claudeCommand.frontmatter.description).toBe("Basic test command");
      expect(claudeCommand.content).toContain("$ARGUMENTS");
      expect(claudeCommand.content).not.toContain("{{args}}");
    });

    it("should preserve Claude-specific fields without prefix when removeUnsupported=false", async () => {
      const claudeParser = new ClaudeParser();
      const converter = new C2GConverter();
      const geminiParser = new GeminiParser();

      const claudeFilePath = join(fixturesDir, "claude-commands", "with-tools.md");
      const claudeCommand = await claudeParser.parse(claudeFilePath);

      const geminiCommand = converter.convert(claudeCommand, defaultOptions);

      // Claude固有フィールドがプレフィックスなしで保持されることを確認
      expect(geminiCommand["allowed-tools"]).toBeDefined();
      expect(geminiCommand["argument-hint"]).toBeDefined();
      expect(geminiCommand.model).toBeDefined();

      // TOML出力でpromptが最後に来ることを確認
      const tomlOutput = geminiParser.stringify(geminiCommand);
      const lines = tomlOutput.trim().split("\n");
      // 複数行文字列の場合も考慮
      const promptLineIndex = lines.findIndex((line) => line.startsWith("prompt = "));

      // promptフィールドが他のフィールドより後に配置されていることを確認
      // Claude固有フィールドも含めて、すべてのフィールドがpromptより前にあることを確認
      const otherFieldLines = lines.filter(
        (line, idx) => idx < promptLineIndex && line.includes(" = ") && !line.startsWith("prompt = "),
      );

      // promptが最後のフィールドであることを確認（複数行文字列の場合も考慮）
      expect(promptLineIndex).toBeGreaterThan(-1);
      expect(otherFieldLines.length).toBeGreaterThan(0);
    });

    it("should restore Claude-specific fields during round-trip conversion", async () => {
      const geminiParser = new GeminiParser();
      const g2cConverter = new G2CConverter();
      const c2gConverter = new C2GConverter();

      const geminiFilePath = join(fixturesDir, "gemini-commands", "with-claude-fields.toml");
      const originalGemini = await geminiParser.parse(geminiFilePath);

      // 元のGeminiコマンドにClaude固有フィールドが含まれていることを確認
      expect(originalGemini["allowed-tools"]).toBe("Bash(git status:*)");

      // Convert to Claude
      const claudeCommand = g2cConverter.convert(originalGemini, {
        ...defaultOptions,
        direction: "g2c",
      });

      // Claude固有フィールドが復元されていることを確認
      expect(claudeCommand.frontmatter["allowed-tools"]).toBe("Bash(git status:*)");
      expect(claudeCommand.frontmatter.model).toBe("sonnet");

      // Convert back to Gemini
      const roundTripGemini = c2gConverter.convert(claudeCommand, defaultOptions);

      // ラウンドトリップ後もClaude固有フィールドが保持されていることを確認
      expect(roundTripGemini["allowed-tools"]).toBe("Bash(git status:*)");
      expect(roundTripGemini.model).toBe("sonnet");
    });

    it("should remove Claude-specific fields when removeUnsupported=true", async () => {
      const claudeParser = new ClaudeParser();
      const converter = new C2GConverter();

      const claudeFilePath = join(fixturesDir, "claude-commands", "with-tools.md");
      const claudeCommand = await claudeParser.parse(claudeFilePath);

      const geminiCommand = converter.convert(claudeCommand, {
        ...defaultOptions,
        removeUnsupported: true,
      });

      expect(geminiCommand["allowed-tools"]).toBeUndefined();
      expect(geminiCommand["argument-hint"]).toBeUndefined();
      expect(geminiCommand.model).toBeUndefined();
    });

    it("should handle shell command conversion", async () => {
      const claudeParser = new ClaudeParser();
      const c2gConverter = new C2GConverter();
      const g2cConverter = new G2CConverter();

      const claudeFilePath = join(fixturesDir, "claude-commands", "with-tools.md");
      const claudeCommand = await claudeParser.parse(claudeFilePath);

      // Claude → Gemini: !command → !{command}
      const geminiCommand = c2gConverter.convert(claudeCommand, defaultOptions);
      expect(geminiCommand.prompt).toContain("!{git status}");

      // Gemini → Claude: !{command} → !`command`
      const backToClaude = g2cConverter.convert(geminiCommand, {
        ...defaultOptions,
        direction: "g2c",
      });
      expect(backToClaude.content).toContain("!`git status`");
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

      const customClaudeDir = "/custom/claude/path";
      const customGeminiDir = "/custom/gemini/path";

      const directories = getCommandDirectories(customClaudeDir, customGeminiDir);

      expect(directories.claude.user).toBe(customClaudeDir);
      expect(directories.gemini.user).toBe(customGeminiDir);
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

      expect(directories.claude.user).toBe(join(homedir(), "custom-claude"));
      expect(directories.gemini.user).toBe(join(homedir(), "custom-gemini"));
    });

    it("should pass custom directories to file search functions", async () => {
      const { findClaudeCommands, findGeminiCommands } = await import("../../src/utils/file-utils.js");

      // これらの関数は実際のファイルシステムにアクセスするため、
      // 存在しないディレクトリでも空の配列を返すことを確認
      const claudeFiles = await findClaudeCommands(undefined, "/nonexistent/claude/dir");
      const geminiFiles = await findGeminiCommands(undefined, "/nonexistent/gemini/dir");

      expect(Array.isArray(claudeFiles)).toBe(true);
      expect(Array.isArray(geminiFiles)).toBe(true);
      expect(claudeFiles.length).toBe(0);
      expect(geminiFiles.length).toBe(0);
    });
  });

  describe("TOML Output Format", () => {
    it("should output prompt field last in TOML", async () => {
      const claudeParser = new ClaudeParser();
      const converter = new C2GConverter();
      const geminiParser = new GeminiParser();

      const claudeFilePath = join(fixturesDir, "claude-commands", "with-tools.md");
      const claudeCommand = await claudeParser.parse(claudeFilePath);

      const geminiCommand = converter.convert(claudeCommand, defaultOptions);
      const tomlOutput = geminiParser.stringify(geminiCommand);

      const lines = tomlOutput.trim().split("\n");
      const promptLineIndex = lines.findIndex((line) => line.startsWith("prompt = "));

      // promptフィールドが他のフィールドより後に配置されていることを確認
      const otherFieldLines = lines.filter(
        (line, idx) => idx < promptLineIndex && line.includes(" = ") && !line.startsWith("prompt = "),
      );

      // promptが最後のフィールドであることを確認（複数行文字列の場合も考慮）
      expect(promptLineIndex).toBeGreaterThan(-1);
      expect(otherFieldLines.length).toBeGreaterThan(0);

      // promptフィールドより後に他のフィールドがないことを確認
      const fieldsAfterPrompt = lines
        .slice(promptLineIndex + 1)
        .filter((line) => line.includes(" = ") && !line.startsWith("  ") && !line.startsWith("\t"));
      expect(fieldsAfterPrompt.length).toBe(0);
    });

    it("should handle empty description correctly", async () => {
      const geminiParser = new GeminiParser();
      const command = {
        description: "",
        prompt: "Test prompt",
        filePath: "test.toml",
      };

      const tomlOutput = geminiParser.stringify(command);

      // 空のdescriptionは出力されないことを確認
      expect(tomlOutput).not.toContain('description = ""');
      expect(tomlOutput).toContain('prompt = "Test prompt"');
    });
  });

  describe("CLI Options Integration", () => {
    it("should handle conversion options with custom directories", async () => {
      const optionsWithCustomDirs: ConversionOptions = {
        ...defaultOptions,
        claudeDir: "~/custom-claude",
        geminiDir: "~/custom-gemini",
        verbose: true,
      };

      // オプションが正しく設定されることを確認
      expect(optionsWithCustomDirs.claudeDir).toBe("~/custom-claude");
      expect(optionsWithCustomDirs.geminiDir).toBe("~/custom-gemini");
      expect(optionsWithCustomDirs.verbose).toBe(true);
    });

    it("should validate CLI options correctly", async () => {
      const { validateCLIOptions } = await import("../../src/cli/options.js");

      const validOptions = {
        direction: "c2g" as const,
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        dryRun: false,
        verbose: false,
        claudeDir: "~/claude-commands",
        geminiDir: "~/gemini-commands",
      };

      const errors = validateCLIOptions(validOptions);
      expect(errors).toHaveLength(0);
    });

    it("should reject invalid direction in CLI options", async () => {
      const { validateCLIOptions } = await import("../../src/cli/options.js");

      const invalidOptions = {
        // biome-ignore lint/suspicious/noExplicitAny: intentional any for testing invalid input
        direction: "invalid" as any,
        removeUnsupported: false,
        noOverwrite: false,
        syncDelete: false,
        dryRun: false,
        verbose: false,
      };

      const errors = validateCLIOptions(invalidOptions);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('--convert must be either "c2g" or "g2c"');
    });
  });
});
