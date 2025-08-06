import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeParser } from "../../src/parsers/claude-parser.js";
import type { ClaudeCommand } from "../../src/types/index.js";
import { deleteFile, writeFile } from "../../src/utils/file-utils.js";

describe("ClaudeParser", () => {
  let parser: ClaudeParser;
  let testFilePath: string;

  beforeEach(() => {
    parser = new ClaudeParser();
    testFilePath = join(tmpdir(), `test-claude-${Date.now()}.md`);
  });

  afterEach(async () => {
    try {
      await deleteFile(testFilePath);
    } catch {
      // ファイルが存在しない場合は無視
    }
  });

  describe("parse", () => {
    it("should parse markdown file with frontmatter", async () => {
      const content = `---
description: Test command
model: sonnet
allowed-tools: Bash(git status:*)
argument-hint: [message]
---

This is a test command with $ARGUMENTS placeholder.

Execute: !git status`;

      await writeFile(testFilePath, content);
      const result = await parser.parse(testFilePath);

      expect(result.frontmatter.description).toBe("Test command");
      expect(result.frontmatter.model).toBe("sonnet");
      expect(result.frontmatter["allowed-tools"]).toBe("Bash(git status:*)");
      expect(result.frontmatter["argument-hint"]).toEqual(["message"]); // YAMLパーサーが配列として解析
      expect(result.content.trim()).toBe("This is a test command with $ARGUMENTS placeholder.\n\nExecute: !git status");
      expect(result.filePath).toBe(testFilePath);
    });

    it("should parse markdown file without frontmatter", async () => {
      const content = "Simple command without frontmatter.";

      await writeFile(testFilePath, content);
      const result = await parser.parse(testFilePath);

      expect(result).toEqual({
        frontmatter: {},
        content: "Simple command without frontmatter.",
        filePath: testFilePath,
      });
    });

    it("should throw ParseError for non-existent file", async () => {
      await expect(parser.parse("/non/existent/file.md")).rejects.toThrow("Failed to parse Claude command file");
    });
  });

  describe("validate", () => {
    it("should validate correct ClaudeCommand", () => {
      const command: ClaudeCommand = {
        frontmatter: {
          description: "Test command",
          model: "sonnet",
        },
        content: "Test content",
        filePath: "/test/path.md",
      };

      expect(parser.validate(command)).toBe(true);
    });

    it("should reject command without filePath", () => {
      const command = {
        frontmatter: {},
        content: "Test content",
      } as ClaudeCommand;

      expect(parser.validate(command)).toBe(false);
    });

    it("should reject command with invalid frontmatter", () => {
      const command = {
        frontmatter: null,
        content: "Test content",
        filePath: "/test/path.md",
      } as unknown as ClaudeCommand;

      expect(parser.validate(command)).toBe(false);
    });

    it("should reject command with non-string content", () => {
      const command = {
        frontmatter: {},
        content: 123,
        filePath: "/test/path.md",
      } as unknown as ClaudeCommand;

      expect(parser.validate(command)).toBe(false);
    });
  });

  describe("stringify", () => {
    it("should convert ClaudeCommand to markdown with frontmatter", () => {
      const command: ClaudeCommand = {
        frontmatter: {
          description: "Test command",
          model: "sonnet",
        },
        content: "Test content",
        filePath: "/test/path.md",
      };

      const result = parser.stringify(command);

      expect(result).toContain("---");
      expect(result).toContain("description: Test command");
      expect(result).toContain("model: sonnet");
      expect(result).toContain("Test content");
    });

    it("should convert ClaudeCommand without frontmatter", () => {
      const command: ClaudeCommand = {
        frontmatter: {},
        content: "Simple content",
        filePath: "/test/path.md",
      };

      const result = parser.stringify(command);
      expect(result).toBe("Simple content");
    });

    it("should exclude undefined values from frontmatter", () => {
      const command: ClaudeCommand = {
        frontmatter: {
          description: "Test command",
          model: undefined,
          "allowed-tools": undefined,
        },
        content: "Test content",
        filePath: "/test/path.md",
      };

      const result = parser.stringify(command);

      expect(result).toContain("description: Test command");
      expect(result).not.toContain("model:");
      expect(result).not.toContain("allowed-tools:");
    });
  });
});
