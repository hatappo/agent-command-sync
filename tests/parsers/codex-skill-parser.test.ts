import { mkdir, readFile as fsReadFile, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodexSkillParser } from "../../src/parsers/codex-skill-parser.js";
import type { CodexSkill } from "../../src/types/index.js";
import { directoryExists, fileExists } from "../../src/utils/file-utils.js";

const fixturesPath = join(process.cwd(), "tests/fixtures/codex-skills");

describe("CodexSkillParser", () => {
  const parser = new CodexSkillParser();

  describe("parse", () => {
    it("should parse a skill directory with openai.yaml", async () => {
      const skillDir = join(fixturesPath, "with-config");
      const result = await parser.parse(skillDir);

      expect(result.name).toBe("with-config");
      expect(result.description).toBe("A Codex skill with openai.yaml configuration");
      expect(result.content).toContain("This is a Codex skill");
      expect(result.content).toContain("$ARGUMENTS");

      // Check openai.yaml config
      expect(result.openaiConfig).toBeDefined();
      expect(result.openaiConfig?.interface?.display_name).toBe("With Config Skill");
      expect(result.openaiConfig?.policy?.allow_implicit_invocation).toBe(true);
    });

    it("should throw error for invalid skill directory", async () => {
      const invalidDir = join(fixturesPath, "non-existent-skill");

      await expect(parser.parse(invalidDir)).rejects.toThrow("Failed to parse Codex skill");
    });
  });

  describe("validate", () => {
    it("should validate a valid skill", async () => {
      const skillDir = join(fixturesPath, "with-config");
      const skill = await parser.parse(skillDir);

      expect(parser.validate(skill)).toBe(true);
    });
  });

  describe("stringify", () => {
    it("should stringify a skill to SKILL.md format", async () => {
      const skillDir = join(fixturesPath, "with-config");
      const skill = await parser.parse(skillDir);
      const result = parser.stringify(skill);

      expect(result).toContain("---");
      expect(result).toContain("name: with-config");
      expect(result).toContain("description: A Codex skill with openai.yaml configuration");
    });
  });

  describe("stringifyOpenAIConfig", () => {
    it("should stringify openai.yaml config", async () => {
      const skillDir = join(fixturesPath, "with-config");
      const skill = await parser.parse(skillDir);

      if (skill.openaiConfig) {
        const result = parser.stringifyOpenAIConfig(skill.openaiConfig);
        expect(result).toContain("display_name: With Config Skill");
        expect(result).toContain("allow_implicit_invocation: true");
      }
    });
  });

  describe("writeToDirectory", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `codex-skill-write-test-${Date.now()}`);
    });

    afterEach(async () => {
      try {
        await rm(tmpDir, { recursive: true });
      } catch {
        // Ignore
      }
    });

    it("should write SKILL.md and agents/openai.yaml when openaiConfig is present", async () => {
      const skill: CodexSkill = {
        name: "test-skill",
        content: "Test content",
        dirPath: tmpDir,
        supportFiles: [],
        frontmatter: { name: "test-skill", description: "Test" },
        openaiConfig: {
          interface: { display_name: "Test Skill" },
          policy: { allow_implicit_invocation: true },
        },
      };

      const targetDir = join(tmpDir, "output");
      await parser.writeToDirectory(skill, targetDir);

      const skillContent = await fsReadFile(join(targetDir, "SKILL.md"), "utf-8");
      expect(skillContent).toContain("name: test-skill");

      const configContent = await fsReadFile(join(targetDir, "agents", "openai.yaml"), "utf-8");
      expect(configContent).toContain("display_name: Test Skill");
      expect(configContent).toContain("allow_implicit_invocation: true");
    });

    it("should not write agents/openai.yaml when openaiConfig is absent", async () => {
      const skill: CodexSkill = {
        name: "test-skill",
        content: "Test content",
        dirPath: tmpDir,
        supportFiles: [],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "output");
      await parser.writeToDirectory(skill, targetDir);

      expect(await fileExists(join(targetDir, "SKILL.md"))).toBe(true);
      expect(await directoryExists(join(targetDir, "agents"))).toBe(false);
    });

    it("should copy text support files", async () => {
      const skill: CodexSkill = {
        name: "test-skill",
        content: "Test",
        dirPath: tmpDir,
        supportFiles: [{ relativePath: "lib/utils.py", type: "text", content: "def hello(): pass" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "output");
      await parser.writeToDirectory(skill, targetDir);

      const content = await fsReadFile(join(targetDir, "lib", "utils.py"), "utf-8");
      expect(content).toBe("def hello(): pass");
    });

    it("should copy binary support files from source", async () => {
      const sourceDir = join(tmpDir, "source");
      await mkdir(sourceDir, { recursive: true });
      await fsWriteFile(join(sourceDir, "model.bin"), Buffer.from([0x00, 0x01, 0x02]));

      const skill: CodexSkill = {
        name: "test-skill",
        content: "Test",
        dirPath: sourceDir,
        supportFiles: [{ relativePath: "model.bin", type: "binary" }],
        frontmatter: { name: "test-skill" },
      };

      const targetDir = join(tmpDir, "target");
      await parser.writeToDirectory(skill, targetDir);

      expect(await fileExists(join(targetDir, "model.bin"))).toBe(true);
    });
  });
});
