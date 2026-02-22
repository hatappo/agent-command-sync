import { writeFile as fsWriteFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CursorAgent } from "../../src/agents/cursor.js";

const fixturesDir = join(__dirname, "..", "fixtures", "cursor-commands");

describe("CursorAgent (Command)", () => {
  const agent = new CursorAgent();

  describe("parseCommand", () => {
    it("should parse Cursor command as plain Markdown", async () => {
      const filePath = join(fixturesDir, "basic.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.content).toContain("basic Cursor command");
      expect(result.filePath).toBe(filePath);
    });

    it("should parse multiline Cursor command", async () => {
      const filePath = join(fixturesDir, "multiline.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.content).toContain("Review the code changes");
      expect(result.content).toContain("## Steps");
      expect(result.content).toContain("Verify test coverage");
    });

    it("should trim content whitespace", async () => {
      const tmpDir = join(tmpdir(), `cursor-parser-test-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const file = join(tmpDir, "whitespace.md");
      await fsWriteFile(file, "\n  Content with whitespace  \n\n", "utf-8");

      try {
        const result = await agent.parseCommand(file);
        expect(result.content).toBe("Content with whitespace");
      } finally {
        await rm(tmpDir, { recursive: true });
      }
    });

    it("should throw ParseError for non-existent file", async () => {
      const filePath = join(fixturesDir, "non-existent.md");

      await expect(agent.parseCommand(filePath)).rejects.toThrow("Failed to parse Cursor command file");
    });
  });

  describe("validateCommand", () => {
    it("should validate valid Cursor command", () => {
      const command = {
        content: "Test content",
        filePath: "test.md",
      };

      expect(agent.validateCommand(command)).toBe(true);
    });

    it("should invalidate command with non-string content", () => {
      const command = {
        content: null as unknown as string,
        filePath: "test.md",
      };

      expect(agent.validateCommand(command)).toBe(false);
    });
  });

  describe("stringifyCommand", () => {
    it("should return content as-is (no frontmatter)", () => {
      const command = {
        content: "This is the content of the command",
        filePath: "test.md",
      };

      const result = agent.stringifyCommand(command);
      expect(result).toBe("This is the content of the command");
    });
  });
});
