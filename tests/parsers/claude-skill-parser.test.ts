import { mkdir, readFile as fsReadFile, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeSkillParser } from "../../src/parsers/claude-skill-parser.js";
import type { ClaudeSkill } from "../../src/types/index.js";
import { fileExists } from "../../src/utils/file-utils.js";

const fixturesPath = join(process.cwd(), "tests/fixtures/claude-skills");

describe("ClaudeSkillParser", () => {
  const parser = new ClaudeSkillParser();

  describe("parse", () => {
    it("should parse a basic skill directory", async () => {
      const skillDir = join(fixturesPath, "basic-skill");
      const result = await parser.parse(skillDir);

      expect(result.name).toBe("basic-skill");
      expect(result.description).toBe("A basic test skill for Claude");
      expect(result.frontmatter["allowed-tools"]).toBe("Read, Grep");
      expect(result.frontmatter.model).toBe("sonnet");
      expect(result.content).toContain("This is a basic skill");
      expect(result.content).toContain("$ARGUMENTS");
    });

    it("should throw error for invalid skill directory", async () => {
      const invalidDir = join(fixturesPath, "non-existent-skill");

      await expect(parser.parse(invalidDir)).rejects.toThrow("Failed to parse Claude skill");
    });
  });

  describe("validate", () => {
    it("should validate a valid skill", async () => {
      const skillDir = join(fixturesPath, "basic-skill");
      const skill = await parser.parse(skillDir);

      expect(parser.validate(skill)).toBe(true);
    });

    it("should reject skill without content", () => {
      const invalidSkill = {
        name: "test",
        content: "",
        dirPath: "/test",
        supportFiles: [],
        frontmatter: {},
      };

      expect(parser.validate(invalidSkill as never)).toBe(false);
    });
  });

  describe("stringify", () => {
    it("should stringify a skill to SKILL.md format", async () => {
      const skillDir = join(fixturesPath, "basic-skill");
      const skill = await parser.parse(skillDir);
      const result = parser.stringify(skill);

      expect(result).toContain("---");
      expect(result).toContain("name: basic-skill");
      expect(result).toContain("description: A basic test skill for Claude");
      expect(result).toContain("This is a basic skill");
    });
  });

  describe("writeToDirectory", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `claude-skill-write-test-${Date.now()}`);
    });

    afterEach(async () => {
      try {
        await rm(tmpDir, { recursive: true });
      } catch {
        // Ignore
      }
    });

    it("should write SKILL.md correctly", async () => {
      const skillDir = join(fixturesPath, "basic-skill");
      const skill = await parser.parse(skillDir);

      const targetDir = join(tmpDir, "output");
      await parser.writeToDirectory(skill, targetDir);

      const written = await fsReadFile(join(targetDir, "SKILL.md"), "utf-8");
      expect(written).toContain("name: basic-skill");
      expect(written).toContain("This is a basic skill");
    });

    it("should copy text support files", async () => {
      const skill: ClaudeSkill = {
        name: "test-skill",
        content: "Test content",
        dirPath: tmpDir,
        supportFiles: [{ relativePath: "helpers/util.ts", type: "text", content: "export const x = 1;" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "output");
      await parser.writeToDirectory(skill, targetDir);

      const content = await fsReadFile(join(targetDir, "helpers", "util.ts"), "utf-8");
      expect(content).toBe("export const x = 1;");
    });

    it("should copy binary support files from source", async () => {
      const sourceDir = join(tmpDir, "source");
      await mkdir(join(sourceDir, "images"), { recursive: true });
      await fsWriteFile(join(sourceDir, "images", "icon.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const skill: ClaudeSkill = {
        name: "test-skill",
        content: "Test",
        dirPath: sourceDir,
        supportFiles: [{ relativePath: "images/icon.png", type: "binary" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "target");
      await parser.writeToDirectory(skill, targetDir);

      expect(await fileExists(join(targetDir, "images", "icon.png"))).toBe(true);
    });

    it("should preserve nested directory structure", async () => {
      const skill: ClaudeSkill = {
        name: "test-skill",
        content: "Test",
        dirPath: tmpDir,
        supportFiles: [{ relativePath: "a/b/c/deep.ts", type: "text", content: "deep" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "output");
      await parser.writeToDirectory(skill, targetDir);

      const content = await fsReadFile(join(targetDir, "a", "b", "c", "deep.ts"), "utf-8");
      expect(content).toBe("deep");
    });
  });
});
