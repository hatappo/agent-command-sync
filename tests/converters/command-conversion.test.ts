import { describe, expect, it } from "vitest";
import { ClaudeCommandConverter } from "../../src/converters/claude-command-converter.js";
import { GeminiCommandConverter } from "../../src/converters/gemini-command-converter.js";
import { CodexCommandConverter } from "../../src/converters/codex-command-converter.js";
import type { ClaudeCommand, GeminiCommand, CodexCommand } from "../../src/types/index.js";

describe("Command Conversion (Safety Net)", () => {
  describe("Claude -> Gemini", () => {
    it("should convert description and body", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test description" },
        content: "Test body content",
        filePath: "/test/command.md",
      };

      const claudeConverter = new ClaudeCommandConverter();
      const geminiConverter = new GeminiCommandConverter();
      const ir = claudeConverter.toIR(claude);
      const gemini = geminiConverter.fromIR(ir);

      expect(gemini.description).toBe("Test description");
      expect(gemini.prompt).toBe("Test body content");
    });

    it("should pass through Claude-specific fields", () => {
      const claude: ClaudeCommand = {
        frontmatter: {
          description: "Test",
          "allowed-tools": "bash,read",
          "argument-hint": "Enter filename",
          model: "sonnet",
        },
        content: "Body",
        filePath: "/test/command.md",
      };

      const claudeConverter = new ClaudeCommandConverter();
      const geminiConverter = new GeminiCommandConverter();
      const ir = claudeConverter.toIR(claude);
      const gemini = geminiConverter.fromIR(ir);

      expect(gemini["allowed-tools"]).toBe("bash,read");
      expect(gemini["argument-hint"]).toBe("Enter filename");
      expect(gemini.model).toBe("sonnet");
    });
  });

  describe("Gemini -> Claude", () => {
    it("should convert description and prompt to content", () => {
      const gemini: GeminiCommand = {
        description: "Gemini description",
        prompt: "Gemini prompt content",
        filePath: "/test/command.toml",
      };

      const geminiConverter = new GeminiCommandConverter();
      const claudeConverter = new ClaudeCommandConverter();
      const ir = geminiConverter.toIR(gemini);
      const claude = claudeConverter.fromIR(ir);

      expect(claude.frontmatter.description).toBe("Gemini description");
      expect(claude.content).toBe("Gemini prompt content");
    });

    it("should put extra fields into frontmatter", () => {
      const gemini: GeminiCommand = {
        description: "Test",
        prompt: "Body",
        filePath: "/test/command.toml",
        "custom-field": "custom-value",
      };

      const geminiConverter = new GeminiCommandConverter();
      const claudeConverter = new ClaudeCommandConverter();
      const ir = geminiConverter.toIR(gemini);
      const claude = claudeConverter.fromIR(ir);

      expect(claude.frontmatter["custom-field"]).toBe("custom-value");
    });
  });

  describe("Claude -> Codex", () => {
    it("should preserve frontmatter", () => {
      const claude: ClaudeCommand = {
        frontmatter: {
          description: "Test description",
          "allowed-tools": "bash",
          model: "opus",
        },
        content: "Test content",
        filePath: "/test/command.md",
      };

      const claudeConverter = new ClaudeCommandConverter();
      const codexConverter = new CodexCommandConverter();
      const ir = claudeConverter.toIR(claude);
      const codex = codexConverter.fromIR(ir);

      expect(codex.content).toBe("Test content");
      expect(codex.frontmatter?.description).toBe("Test description");
      expect(codex.frontmatter?.["allowed-tools"]).toBe("bash");
      expect(codex.frontmatter?.model).toBe("opus");
    });
  });

  describe("Codex -> Claude", () => {
    it("should restore frontmatter", () => {
      const codex: CodexCommand = {
        frontmatter: {
          description: "Codex desc",
          "allowed-tools": "bash",
        },
        content: "Codex content",
        filePath: "/test/command.md",
      };

      const codexConverter = new CodexCommandConverter();
      const claudeConverter = new ClaudeCommandConverter();
      const ir = codexConverter.toIR(codex);
      const claude = claudeConverter.fromIR(ir);

      expect(claude.frontmatter.description).toBe("Codex desc");
      expect(claude.frontmatter["allowed-tools"]).toBe("bash");
      expect(claude.content).toBe("Codex content");
    });
  });

  describe("Gemini -> Codex", () => {
    it("should convert prompt to content and preserve description", () => {
      const gemini: GeminiCommand = {
        description: "Gemini desc",
        prompt: "Gemini prompt",
        filePath: "/test/command.toml",
      };

      const geminiConverter = new GeminiCommandConverter();
      const codexConverter = new CodexCommandConverter();
      const ir = geminiConverter.toIR(gemini);
      const codex = codexConverter.fromIR(ir);

      expect(codex.content).toBe("Gemini prompt");
      expect(codex.frontmatter?.description).toBe("Gemini desc");
    });
  });

  describe("Codex -> Gemini", () => {
    it("should convert content to prompt", () => {
      const codex: CodexCommand = {
        frontmatter: { description: "Codex desc" },
        content: "Codex content",
        filePath: "/test/command.md",
      };

      const codexConverter = new CodexCommandConverter();
      const geminiConverter = new GeminiCommandConverter();
      const ir = codexConverter.toIR(codex);
      const gemini = geminiConverter.fromIR(ir);

      expect(gemini.prompt).toBe("Codex content");
      expect(gemini.description).toBe("Codex desc");
    });
  });

  describe("Round-trip: Claude -> Gemini -> Claude", () => {
    it("should preserve description and body", () => {
      const original: ClaudeCommand = {
        frontmatter: { description: "Round-trip test" },
        content: "Round-trip body",
        filePath: "/test/command.md",
      };

      const claudeConverter = new ClaudeCommandConverter();
      const geminiConverter = new GeminiCommandConverter();

      const ir1 = claudeConverter.toIR(original);
      const gemini = geminiConverter.fromIR(ir1);
      const ir2 = geminiConverter.toIR(gemini);
      const result = claudeConverter.fromIR(ir2);

      expect(result.frontmatter.description).toBe("Round-trip test");
      expect(result.content).toBe("Round-trip body");
    });
  });

  describe("Round-trip: Claude -> Codex -> Claude", () => {
    it("should preserve all fields", () => {
      const original: ClaudeCommand = {
        frontmatter: {
          description: "Full round-trip",
          "allowed-tools": "bash,read",
          "argument-hint": "Enter path",
          model: "sonnet",
        },
        content: "Full body content",
        filePath: "/test/command.md",
      };

      const claudeConverter = new ClaudeCommandConverter();
      const codexConverter = new CodexCommandConverter();

      const ir1 = claudeConverter.toIR(original);
      const codex = codexConverter.fromIR(ir1);
      const ir2 = codexConverter.toIR(codex);
      const result = claudeConverter.fromIR(ir2);

      expect(result.frontmatter.description).toBe("Full round-trip");
      expect(result.frontmatter["allowed-tools"]).toBe("bash,read");
      expect(result.frontmatter["argument-hint"]).toBe("Enter path");
      expect(result.frontmatter.model).toBe("sonnet");
      expect(result.content).toBe("Full body content");
    });
  });

  describe("Placeholder conversion through IR", () => {
    it("should convert Claude placeholders to Gemini format", () => {
      const claude: ClaudeCommand = {
        frontmatter: { description: "Test" },
        content: "Run !`git status` with $ARGUMENTS and load @config.json",
        filePath: "/test/command.md",
      };

      const claudeConverter = new ClaudeCommandConverter();
      const geminiConverter = new GeminiCommandConverter();
      const ir = claudeConverter.toIR(claude);
      const gemini = geminiConverter.fromIR(ir);

      expect(gemini.prompt).toBe("Run !{git status} with {{args}} and load @{config.json}");
    });

    it("should convert Gemini placeholders to Claude format", () => {
      const gemini: GeminiCommand = {
        description: "Test",
        prompt: "Execute !{npm test} with {{args}} and @{package.json}",
        filePath: "/test/command.toml",
      };

      const geminiConverter = new GeminiCommandConverter();
      const claudeConverter = new ClaudeCommandConverter();
      const ir = geminiConverter.toIR(gemini);
      const claude = claudeConverter.fromIR(ir);

      expect(claude.content).toBe("Execute !`npm test` with $ARGUMENTS and @package.json");
    });

    it("should preserve individual arguments through Claude → Gemini → Claude", () => {
      const original: ClaudeCommand = {
        frontmatter: {},
        content: "First: $1, Second: $2, All: $ARGUMENTS",
        filePath: "/test/command.md",
      };

      const claudeConverter = new ClaudeCommandConverter();
      const geminiConverter = new GeminiCommandConverter();

      const ir1 = claudeConverter.toIR(original);
      const gemini = geminiConverter.fromIR(ir1);
      expect(gemini.prompt).toBe("First: $1, Second: $2, All: {{args}}");

      const ir2 = geminiConverter.toIR(gemini);
      const result = claudeConverter.fromIR(ir2);
      expect(result.content).toBe("First: $1, Second: $2, All: $ARGUMENTS");
    });
  });
});
