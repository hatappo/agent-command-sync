import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChimeraAgent } from "../../src/agents/chimera.js";
import type { ChimeraCommand } from "../../src/types/index.js";
import { deleteFile, writeFile } from "../../src/utils/file-utils.js";

describe("ChimeraAgent (Command)", () => {
  let agent: ChimeraAgent;
  let testFilePath: string;

  beforeEach(() => {
    agent = new ChimeraAgent();
    testFilePath = join(tmpdir(), `test-chimera-${Date.now()}.md`);
  });

  afterEach(async () => {
    try {
      await deleteFile(testFilePath);
    } catch {
      // Ignore if file does not exist
    }
  });

  describe("parseCommand", () => {
    it("should parse basic chimera command", async () => {
      const content = `---
description: Test command
---

Test content with $ARGUMENTS.`;

      await writeFile(testFilePath, content);
      const result = await agent.parseCommand(testFilePath);

      expect(result.frontmatter.description).toBe("Test command");
      expect(result.content.trim()).toBe("Test content with $ARGUMENTS.");
      expect(result.filePath).toBe(testFilePath);
    });

    it("should parse chimera command with _chimera section", async () => {
      const content = `---
description: Review code
_chimera:
  claude:
    allowed-tools: "Read,Write,Bash"
    model: opus-4
  gemini:
    custom-field: value
---

Review $ARGUMENTS.`;

      await writeFile(testFilePath, content);
      const result = await agent.parseCommand(testFilePath);

      expect(result.frontmatter.description).toBe("Review code");
      expect(result.frontmatter._chimera).toBeDefined();
      expect(result.frontmatter._chimera?.claude?.["allowed-tools"]).toBe("Read,Write,Bash");
      expect(result.frontmatter._chimera?.claude?.model).toBe("opus-4");
      expect(result.frontmatter._chimera?.gemini?.["custom-field"]).toBe("value");
    });

    it("should parse command without frontmatter", async () => {
      const content = "Simple command without frontmatter.";

      await writeFile(testFilePath, content);
      const result = await agent.parseCommand(testFilePath);

      expect(result.content).toBe("Simple command without frontmatter.");
    });

    it("should throw ParseError for non-existent file", async () => {
      await expect(agent.parseCommand("/non/existent/file.md")).rejects.toThrow("Failed to parse Chimera command file");
    });
  });

  describe("validateCommand", () => {
    it("should validate correct ChimeraCommand", () => {
      const command: ChimeraCommand = {
        frontmatter: { description: "Test" },
        content: "Test content",
        filePath: "/test/path.md",
      };
      expect(agent.validateCommand(command)).toBe(true);
    });
  });

  describe("stringifyCommand", () => {
    it("should convert ChimeraCommand to markdown with frontmatter", () => {
      const command: ChimeraCommand = {
        frontmatter: {
          description: "Test command",
          _chimera: {
            claude: { model: "opus-4" },
          },
        },
        content: "Test content",
        filePath: "/test/path.md",
      };

      const result = agent.stringifyCommand(command);

      expect(result).toContain("---");
      expect(result).toContain("description: Test command");
      expect(result).toContain("_chimera");
      expect(result).toContain("Test content");
    });

    it("should output plain content without frontmatter", () => {
      const command: ChimeraCommand = {
        frontmatter: {},
        content: "Simple content",
        filePath: "/test/path.md",
      };

      const result = agent.stringifyCommand(command);
      expect(result).toBe("Simple content");
    });
  });
});
