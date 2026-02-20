import { mkdir, readFile as fsReadFile, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeminiSkillParser } from "../../src/parsers/gemini-skill-parser.js";
import type { GeminiSkill } from "../../src/types/index.js";
import { fileExists } from "../../src/utils/file-utils.js";

const fixturesPath = join(process.cwd(), "tests/fixtures/gemini-skills");

describe("GeminiSkillParser", () => {
  const parser = new GeminiSkillParser();

  describe("parse", () => {
    it("should parse a standard skill directory", async () => {
      const skillDir = join(fixturesPath, "standard-skill");
      const result = await parser.parse(skillDir);

      expect(result.name).toBe("standard-skill");
      expect(result.description).toBe("A standard test skill for Gemini");
      expect(result.content).toContain("This is a standard skill");
      expect(result.content).toContain("{{args}}");
    });

    it("should throw error for invalid skill directory", async () => {
      const invalidDir = join(fixturesPath, "non-existent-skill");

      await expect(parser.parse(invalidDir)).rejects.toThrow("Failed to parse Gemini skill");
    });
  });

  describe("validate", () => {
    it("should validate a valid skill", async () => {
      const skillDir = join(fixturesPath, "standard-skill");
      const skill = await parser.parse(skillDir);

      expect(parser.validate(skill)).toBe(true);
    });
  });

  describe("stringify", () => {
    it("should stringify a skill to SKILL.md format", async () => {
      const skillDir = join(fixturesPath, "standard-skill");
      const skill = await parser.parse(skillDir);
      const result = parser.stringify(skill);

      expect(result).toContain("---");
      expect(result).toContain("name: standard-skill");
      expect(result).toContain("description: A standard test skill for Gemini");
    });
  });

  describe("writeToDirectory", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `gemini-skill-write-test-${Date.now()}`);
    });

    afterEach(async () => {
      try {
        await rm(tmpDir, { recursive: true });
      } catch {
        // Ignore
      }
    });

    it("should write SKILL.md correctly", async () => {
      const skillDir = join(fixturesPath, "standard-skill");
      const skill = await parser.parse(skillDir);

      const targetDir = join(tmpDir, "output");
      await parser.writeToDirectory(skill, targetDir);

      const written = await fsReadFile(join(targetDir, "SKILL.md"), "utf-8");
      expect(written).toContain("name: standard-skill");
      expect(written).toContain("This is a standard skill");
    });

    it("should copy text support files", async () => {
      const skill: GeminiSkill = {
        name: "test-skill",
        content: "Test content",
        dirPath: tmpDir,
        supportFiles: [{ relativePath: "lib/helper.py", type: "text", content: "print('hello')" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "output");
      await parser.writeToDirectory(skill, targetDir);

      const content = await fsReadFile(join(targetDir, "lib", "helper.py"), "utf-8");
      expect(content).toBe("print('hello')");
    });

    it("should copy binary support files from source", async () => {
      const sourceDir = join(tmpDir, "source");
      await mkdir(sourceDir, { recursive: true });
      await fsWriteFile(join(sourceDir, "data.pdf"), Buffer.from([0x25, 0x50, 0x44, 0x46]));

      const skill: GeminiSkill = {
        name: "test-skill",
        content: "Test",
        dirPath: sourceDir,
        supportFiles: [{ relativePath: "data.pdf", type: "binary" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "target");
      await parser.writeToDirectory(skill, targetDir);

      expect(await fileExists(join(targetDir, "data.pdf"))).toBe(true);
    });
  });
});
