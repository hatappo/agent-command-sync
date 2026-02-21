import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeAgent } from "../../src/agents/claude.js";
import type { ClaudeCommand } from "../../src/types/index.js";
import { deleteFile, writeFile } from "../../src/utils/file-utils.js";

describe("ClaudeAgent (Command)", () => {
  let agent: ClaudeAgent;
  let testFilePath: string;

  beforeEach(() => {
    agent = new ClaudeAgent();
    testFilePath = join(tmpdir(), `test-claude-${Date.now()}.md`);
  });

  afterEach(async () => {
    try {
      await deleteFile(testFilePath);
    } catch {
      // Ignore if file does not exist
    }
  });

  describe("parseCommand", () => {
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
      const result = await agent.parseCommand(testFilePath);

      expect(result.frontmatter.description).toBe("Test command");
      expect(result.frontmatter.model).toBe("sonnet");
      expect(result.frontmatter["allowed-tools"]).toBe("Bash(git status:*)");
      expect(result.frontmatter["argument-hint"]).toEqual(["message"]); // YAML parser parses as array
      expect(result.content.trim()).toBe("This is a test command with $ARGUMENTS placeholder.\n\nExecute: !git status");
      expect(result.filePath).toBe(testFilePath);
    });

    it("should parse markdown file without frontmatter", async () => {
      const content = "Simple command without frontmatter.";

      await writeFile(testFilePath, content);
      const result = await agent.parseCommand(testFilePath);

      expect(result).toEqual({
        frontmatter: {},
        content: "Simple command without frontmatter.",
        filePath: testFilePath,
      });
    });

    it("should throw ParseError for non-existent file", async () => {
      await expect(agent.parseCommand("/non/existent/file.md")).rejects.toThrow("Failed to parse Claude command file");
    });
  });

  describe("validateCommand", () => {
    it("should validate correct ClaudeCommand", () => {
      const command: ClaudeCommand = {
        frontmatter: {
          description: "Test command",
          model: "sonnet",
        },
        content: "Test content",
        filePath: "/test/path.md",
      };

      expect(agent.validateCommand(command)).toBe(true);
    });

    it("should return false for invalid input", () => {
      // Detailed validation rules are tested in validation.test.ts
      const command = {
        frontmatter: {},
        content: "Test content",
      } as ClaudeCommand;

      expect(agent.validateCommand(command)).toBe(false);
    });
  });

  describe("stringifyCommand", () => {
    it("should convert ClaudeCommand to markdown with frontmatter", () => {
      const command: ClaudeCommand = {
        frontmatter: {
          description: "Test command",
          model: "sonnet",
        },
        content: "Test content",
        filePath: "/test/path.md",
      };

      const result = agent.stringifyCommand(command);

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

      const result = agent.stringifyCommand(command);
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

      const result = agent.stringifyCommand(command);

      expect(result).toContain("description: Test command");
      expect(result).not.toContain("model:");
      expect(result).not.toContain("allowed-tools:");
    });
  });
});
