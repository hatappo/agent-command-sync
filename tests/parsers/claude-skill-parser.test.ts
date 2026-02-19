import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ClaudeSkillParser } from "../../src/parsers/claude-skill-parser.js";

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
});
