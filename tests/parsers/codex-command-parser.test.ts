import { writeFile as fsWriteFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CodexAgent } from "../../src/agents/codex.js";

const fixturesDir = join(__dirname, "..", "fixtures", "codex-commands");

describe("CodexAgent (Command)", () => {
  const agent = new CodexAgent();

  describe("parseCommand", () => {
    it("should parse simple Codex command", async () => {
      const filePath = join(fixturesDir, "simple.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.content).toContain("simple Codex custom prompt");
      expect(result.filePath).toBe(filePath);
    });

    it("should parse Codex command with arguments", async () => {
      const filePath = join(fixturesDir, "with-arguments.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.content).toContain("$ARGUMENTS");
      expect(result.content).toContain("Generate a function");
      expect(result.filePath).toBe(filePath);
    });

    it("should throw ParseError for non-existent file", async () => {
      const filePath = join(fixturesDir, "non-existent.md");

      await expect(agent.parseCommand(filePath)).rejects.toThrow("Failed to parse Codex command file");
    });

    it("should throw ParseError for invalid YAML frontmatter", async () => {
      const tmpDir = join(tmpdir(), `codex-parser-test-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const invalidFile = join(tmpDir, "invalid-frontmatter.md");
      await fsWriteFile(invalidFile, "---\ninvalid yaml: [[[\n---\nContent", "utf-8");

      try {
        await expect(agent.parseCommand(invalidFile)).rejects.toThrow("Failed to parse Codex command file");
      } finally {
        await rm(tmpDir, { recursive: true });
      }
    });
  });

  describe("validateCommand", () => {
    it("should validate valid Codex command", () => {
      const command = {
        content: "Test content",
        filePath: "test.md",
      };

      expect(agent.validateCommand(command)).toBe(true);
    });

    it("should accept command with empty content", () => {
      const command = {
        content: "",
        filePath: "test.md",
      };

      expect(agent.validateCommand(command)).toBe(true); // Empty string is still a string
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
    it("should convert Codex command to string", () => {
      const command = {
        content: "This is the content of the command",
        filePath: "test.md",
      };

      const result = agent.stringifyCommand(command);
      expect(result).toBe("This is the content of the command");
    });
  });
});
