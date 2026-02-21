import { mkdir, readFile as fsReadFile, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpenCodeAgent } from "../../src/agents/opencode.js";
import type { OpenCodeSkill } from "../../src/types/index.js";
import { fileExists } from "../../src/utils/file-utils.js";

const fixturesPath = join(process.cwd(), "tests/fixtures/opencode-skills");

describe("OpenCodeAgent (Skill)", () => {
  const agent = new OpenCodeAgent();

  describe("parseSkill", () => {
    it("should parse a skill directory", async () => {
      const skillDir = join(fixturesPath, "test-skill");
      const result = await agent.parseSkill(skillDir);

      expect(result.name).toBe("test-skill");
      expect(result.description).toBe("A test OpenCode skill");
      expect(result.content).toContain("test OpenCode skill");
      expect(result.content).toContain("$ARGUMENTS");
    });

    it("should throw error for invalid skill directory", async () => {
      const invalidDir = join(fixturesPath, "non-existent-skill");

      await expect(agent.parseSkill(invalidDir)).rejects.toThrow("Failed to parse OpenCode skill");
    });
  });

  describe("validateSkill", () => {
    it("should validate a valid skill", async () => {
      const skillDir = join(fixturesPath, "test-skill");
      const skill = await agent.parseSkill(skillDir);

      expect(agent.validateSkill(skill)).toBe(true);
    });
  });

  describe("stringifySkill", () => {
    it("should stringify a skill to SKILL.md format", async () => {
      const skillDir = join(fixturesPath, "test-skill");
      const skill = await agent.parseSkill(skillDir);
      const result = agent.stringifySkill(skill);

      expect(result).toContain("---");
      expect(result).toContain("name: test-skill");
      expect(result).toContain("description: A test OpenCode skill");
    });
  });

  describe("writeSkillToDirectory", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `opencode-skill-write-test-${Date.now()}`);
    });

    afterEach(async () => {
      try {
        await rm(tmpDir, { recursive: true });
      } catch {
        // Ignore
      }
    });

    it("should write SKILL.md to target directory", async () => {
      const skill: OpenCodeSkill = {
        name: "test-skill",
        content: "Test content",
        dirPath: tmpDir,
        supportFiles: [],
        frontmatter: { name: "test-skill", description: "Test" },
      };

      const targetDir = join(tmpDir, "output");
      await agent.writeSkillToDirectory(skill, tmpDir, targetDir);

      const skillContent = await fsReadFile(join(targetDir, "SKILL.md"), "utf-8");
      expect(skillContent).toContain("name: test-skill");
    });

    it("should copy text support files", async () => {
      const skill: OpenCodeSkill = {
        name: "test-skill",
        content: "Test",
        dirPath: tmpDir,
        supportFiles: [{ relativePath: "lib/utils.py", type: "text", content: "def hello(): pass" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "output");
      await agent.writeSkillToDirectory(skill, tmpDir, targetDir);

      const content = await fsReadFile(join(targetDir, "lib", "utils.py"), "utf-8");
      expect(content).toBe("def hello(): pass");
    });

    it("should copy binary support files from source", async () => {
      const sourceDir = join(tmpDir, "source");
      await mkdir(sourceDir, { recursive: true });
      await fsWriteFile(join(sourceDir, "model.bin"), Buffer.from([0x00, 0x01, 0x02]));

      const skill: OpenCodeSkill = {
        name: "test-skill",
        content: "Test",
        dirPath: sourceDir,
        supportFiles: [{ relativePath: "model.bin", type: "binary" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "target");
      await agent.writeSkillToDirectory(skill, sourceDir, targetDir);

      expect(await fileExists(join(targetDir, "model.bin"))).toBe(true);
    });
  });
});
