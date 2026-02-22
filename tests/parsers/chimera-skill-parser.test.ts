import { writeFile as fsWriteFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChimeraAgent } from "../../src/agents/chimera.js";

describe("ChimeraAgent (Skill)", () => {
  let agent: ChimeraAgent;
  let testDir: string;

  beforeEach(async () => {
    agent = new ChimeraAgent();
    testDir = join(tmpdir(), `test-chimera-skill-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true });
    } catch {
      // Ignore
    }
  });

  describe("parseSkill", () => {
    it("should parse basic chimera skill", async () => {
      await fsWriteFile(
        join(testDir, "SKILL.md"),
        `---
name: test-skill
description: A test skill
---

Skill body content.`,
        "utf-8",
      );

      const result = await agent.parseSkill(testDir);

      expect(result.name).toBe("test-skill");
      expect(result.description).toBe("A test skill");
      expect(result.content.trim()).toBe("Skill body content.");
    });

    it("should parse skill with _chimera section", async () => {
      await fsWriteFile(
        join(testDir, "SKILL.md"),
        `---
name: chimera-skill
description: Skill with extras
disable-model-invocation: true
_chimera:
  claude:
    allowed-tools: Read,Write
    model: opus-4
  copilot:
    user-invokable: true
---

Skill body with $ARGUMENTS.`,
        "utf-8",
      );

      const result = await agent.parseSkill(testDir);

      expect(result.name).toBe("chimera-skill");
      expect(result.frontmatter["disable-model-invocation"]).toBe(true);
      expect(result.frontmatter._chimera?.claude?.["allowed-tools"]).toBe("Read,Write");
      expect(result.frontmatter._chimera?.copilot?.["user-invokable"]).toBe(true);
    });

    it("should throw for missing SKILL.md", async () => {
      await expect(agent.parseSkill(testDir)).rejects.toThrow("Failed to parse Chimera skill");
    });
  });

  describe("validateSkill", () => {
    it("should validate valid skill", async () => {
      await fsWriteFile(
        join(testDir, "SKILL.md"),
        `---
name: valid-skill
---

Content.`,
        "utf-8",
      );

      const skill = await agent.parseSkill(testDir);
      expect(agent.validateSkill(skill)).toBe(true);
    });
  });

  describe("stringifySkill", () => {
    it("should stringify skill with _chimera section", async () => {
      await fsWriteFile(
        join(testDir, "SKILL.md"),
        `---
name: stringify-test
description: Test
_chimera:
  claude:
    model: opus-4
---

Body.`,
        "utf-8",
      );

      const skill = await agent.parseSkill(testDir);
      const result = agent.stringifySkill(skill);

      expect(result).toContain("name: stringify-test");
      expect(result).toContain("_chimera");
      expect(result).toContain("Body.");
    });
  });
});
