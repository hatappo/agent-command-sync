import { mkdir, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OpenCodeAgent } from "../../src/agents/opencode.js";

const fixturesDir = join(__dirname, "..", "fixtures", "opencode-commands");

describe("OpenCodeAgent (Command)", () => {
  const agent = new OpenCodeAgent();

  describe("parseCommand", () => {
    it("should parse OpenCode command with frontmatter", async () => {
      const filePath = join(fixturesDir, "basic.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.frontmatter?.description).toBe("Basic OpenCode command");
      expect(result.content).toContain("basic OpenCode command");
      expect(result.filePath).toBe(filePath);
    });

    it("should parse OpenCode command with arguments", async () => {
      const filePath = join(fixturesDir, "with-args.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.content).toContain("$ARGUMENTS");
      expect(result.frontmatter?.description).toBe("OpenCode command with arguments");
      expect(result.frontmatter?.model).toBe("sonnet");
    });

    it("should parse simple command without frontmatter", async () => {
      const filePath = join(fixturesDir, "simple.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.frontmatter).toBeUndefined();
      expect(result.content).toContain("simple OpenCode command");
    });

    it("should throw ParseError for non-existent file", async () => {
      const filePath = join(fixturesDir, "non-existent.md");

      await expect(agent.parseCommand(filePath)).rejects.toThrow("Failed to parse OpenCode command file");
    });

    it("should throw ParseError for invalid YAML frontmatter", async () => {
      const tmpDir = join(tmpdir(), `opencode-parser-test-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const invalidFile = join(tmpDir, "invalid-frontmatter.md");
      await fsWriteFile(invalidFile, "---\ninvalid yaml: [[[\n---\nContent", "utf-8");

      try {
        await expect(agent.parseCommand(invalidFile)).rejects.toThrow("Failed to parse OpenCode command file");
      } finally {
        await rm(tmpDir, { recursive: true });
      }
    });
  });

  describe("validateCommand", () => {
    it("should validate valid OpenCode command", () => {
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
    it("should convert OpenCode command to string without frontmatter", () => {
      const command = {
        content: "This is the content of the command",
        filePath: "test.md",
      };

      const result = agent.stringifyCommand(command);
      expect(result).toBe("This is the content of the command");
    });

    it("should convert OpenCode command to string with frontmatter", () => {
      const command = {
        frontmatter: { description: "Test", model: "sonnet" },
        content: "Content here",
        filePath: "test.md",
      };

      const result = agent.stringifyCommand(command);
      expect(result).toContain("---");
      expect(result).toContain("description: Test");
      expect(result).toContain("model: sonnet");
      expect(result).toContain("Content here");
    });
  });
});
