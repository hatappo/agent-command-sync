import { mkdir, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CopilotAgent } from "../../src/agents/copilot.js";

const fixturesDir = join(__dirname, "..", "fixtures", "copilot-commands");

describe("CopilotAgent (Command)", () => {
  const agent = new CopilotAgent();

  describe("parseCommand", () => {
    it("should parse Copilot command with frontmatter", async () => {
      const filePath = join(fixturesDir, "basic.prompt.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.frontmatter.description).toBe("Basic Copilot command");
      expect(result.frontmatter.model).toBe("gpt-4o");
      expect(result.content).toContain("basic Copilot command");
      expect(result.filePath).toBe(filePath);
    });

    it("should parse Copilot command with tools array", async () => {
      const filePath = join(fixturesDir, "with-tools.prompt.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.frontmatter.tools).toEqual(["bash", "codeEditor", "fileBrowser"]);
      expect(result.frontmatter.agent).toBe("copilot");
      expect(result.frontmatter["argument-hint"]).toBe("[query]");
    });

    it("should parse command without frontmatter", async () => {
      const filePath = join(fixturesDir, "no-frontmatter.prompt.md");
      const result = await agent.parseCommand(filePath);

      expect(result).toBeDefined();
      expect(result.content).toContain("Simple Copilot prompt");
    });

    it("should throw ParseError for non-existent file", async () => {
      const filePath = join(fixturesDir, "non-existent.prompt.md");

      await expect(agent.parseCommand(filePath)).rejects.toThrow("Failed to parse Copilot command file");
    });

    it("should throw ParseError for invalid YAML frontmatter", async () => {
      const tmpDir = join(tmpdir(), `copilot-parser-test-${Date.now()}`);
      await mkdir(tmpDir, { recursive: true });
      const invalidFile = join(tmpDir, "invalid.prompt.md");
      await fsWriteFile(invalidFile, "---\ninvalid yaml: [[[\n---\nContent", "utf-8");

      try {
        await expect(agent.parseCommand(invalidFile)).rejects.toThrow("Failed to parse Copilot command file");
      } finally {
        await rm(tmpDir, { recursive: true });
      }
    });
  });

  describe("validateCommand", () => {
    it("should validate valid Copilot command", () => {
      const command = {
        frontmatter: { description: "Test" },
        content: "Test content",
        filePath: "test.prompt.md",
      };

      expect(agent.validateCommand(command)).toBe(true);
    });

    it("should invalidate command with non-string content", () => {
      const command = {
        frontmatter: {},
        content: null as unknown as string,
        filePath: "test.prompt.md",
      };

      expect(agent.validateCommand(command)).toBe(false);
    });
  });

  describe("stringifyCommand", () => {
    it("should convert Copilot command to string without frontmatter", () => {
      const command = {
        frontmatter: {},
        content: "This is the content of the command",
        filePath: "test.prompt.md",
      };

      const result = agent.stringifyCommand(command);
      expect(result).toBe("This is the content of the command");
    });

    it("should convert Copilot command to string with frontmatter", () => {
      const command = {
        frontmatter: { description: "Test", model: "gpt-4o", tools: ["bash", "codeEditor"] },
        content: "Content here",
        filePath: "test.prompt.md",
      };

      const result = agent.stringifyCommand(command);
      expect(result).toContain("---");
      expect(result).toContain("description: Test");
      expect(result).toContain("model: gpt-4o");
      expect(result).toContain("Content here");
    });
  });
});
