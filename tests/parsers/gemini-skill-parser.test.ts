import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GeminiSkillParser } from "../../src/parsers/gemini-skill-parser.js";

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
});
