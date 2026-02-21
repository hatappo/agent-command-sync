import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeminiParser } from "../../src/parsers/gemini-parser.js";
import type { GeminiCommand } from "../../src/types/index.js";
import { deleteFile, writeFile } from "../../src/utils/file-utils.js";

describe("GeminiParser", () => {
  let parser: GeminiParser;
  let testFilePath: string;

  beforeEach(() => {
    parser = new GeminiParser();
    testFilePath = join(tmpdir(), `test-gemini-${Date.now()}.toml`);
  });

  afterEach(async () => {
    try {
      await deleteFile(testFilePath);
    } catch {
      // Ignore if file does not exist
    }
  });

  describe("parse", () => {
    it("should parse TOML file with description and prompt", async () => {
      const content = `description = "Test command"
prompt = """
This is a test command with {{args}} placeholder.

Execute: !{git status}
"""`;

      await writeFile(testFilePath, content);
      const result = await parser.parse(testFilePath);

      expect(result).toEqual({
        description: "Test command",
        prompt: "This is a test command with {{args}} placeholder.\n\nExecute: !{git status}\n",
        filePath: testFilePath,
      });
    });

    it("should parse TOML file with only prompt", async () => {
      const content = `prompt = "Simple command without description."`;

      await writeFile(testFilePath, content);
      const result = await parser.parse(testFilePath);

      expect(result).toEqual({
        description: undefined,
        prompt: "Simple command without description.",
        filePath: testFilePath,
      });
    });

    it("should handle empty prompt as empty string", async () => {
      const content = `description = "Test"
prompt = ""`;

      await writeFile(testFilePath, content);
      const result = await parser.parse(testFilePath);

      expect(result.prompt).toBe("");
    });

    it("should throw ParseError for invalid TOML", async () => {
      const content = "invalid toml content [[[";

      await writeFile(testFilePath, content);
      await expect(parser.parse(testFilePath)).rejects.toThrow("Failed to parse Gemini command file");
    });

    it("should throw ParseError for non-existent file", async () => {
      await expect(parser.parse("/non/existent/file.toml")).rejects.toThrow("Failed to parse Gemini command file");
    });
  });

  describe("validate", () => {
    it("should validate correct GeminiCommand", () => {
      const command: GeminiCommand = {
        description: "Test command",
        prompt: "Test prompt",
        filePath: "/test/path.toml",
      };

      expect(parser.validate(command)).toBe(true);
    });

    it("should validate GeminiCommand without description", () => {
      const command: GeminiCommand = {
        prompt: "Test prompt",
        filePath: "/test/path.toml",
      };

      expect(parser.validate(command)).toBe(true);
    });

    it("should return false for invalid input", () => {
      // Detailed validation rules are tested in validation.test.ts
      const command = {
        description: "Test",
        filePath: "/test/path.toml",
      } as GeminiCommand;

      expect(parser.validate(command)).toBe(false);
    });
  });

  describe("stringify", () => {
    it("should convert GeminiCommand to TOML with description", () => {
      const command: GeminiCommand = {
        description: "Test command",
        prompt: "Test prompt content",
        filePath: "/test/path.toml",
      };

      const result = parser.stringify(command);

      expect(result).toContain('description = "Test command"');
      expect(result).toContain('prompt = "Test prompt content"');
    });

    it("should convert GeminiCommand without description", () => {
      const command: GeminiCommand = {
        prompt: "Simple prompt",
        filePath: "/test/path.toml",
      };

      const result = parser.stringify(command);

      expect(result).toContain('prompt = "Simple prompt"');
      expect(result).not.toContain("description =");
    });

    it("should handle multiline prompts", () => {
      const command: GeminiCommand = {
        prompt: "Line 1\nLine 2\nLine 3",
        filePath: "/test/path.toml",
      };

      const result = parser.stringify(command);
      // TOML library outputs multiline strings with triple quotes
      expect(result).toContain('prompt = """');
    });

    it("should exclude empty description", () => {
      const command: GeminiCommand = {
        description: "",
        prompt: "Test prompt",
        filePath: "/test/path.toml",
      };

      const result = parser.stringify(command);

      expect(result).toContain('prompt = "Test prompt"');
      expect(result).not.toContain("description =");
    });
  });
});
