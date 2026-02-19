import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CodexSkillParser } from "../../src/parsers/codex-skill-parser.js";

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
});
