import { writeFile as fsWriteFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverSkillsByAgent, showList } from "../../src/cli/list.js";

describe("list command", () => {
  let tempDir: string;
  let consoleOutput: string[];

  beforeEach(async () => {
    (matter as unknown as { clearCache: () => void }).clearCache();

    tempDir = join(tmpdir(), `list-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    consoleOutput = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.join(" "));
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function createSkill(agentBase: string, skillName: string): Promise<void> {
    const skillDir = join(tempDir, agentBase, "skills", skillName);
    await mkdir(skillDir, { recursive: true });
    const content = matter.stringify(`# ${skillName}`, { description: `${skillName} description` });
    await fsWriteFile(join(skillDir, "SKILL.md"), content, "utf-8");
  }

  // ── discoverSkillsByAgent ─────────────────────────────────────

  describe("discoverSkillsByAgent", () => {
    it("should return empty array when no skills exist", async () => {
      const result = await discoverSkillsByAgent({ global: false, gitRoot: tempDir });
      expect(result).toEqual([]);
    });

    it("should discover skills grouped by agent", async () => {
      await createSkill(".claude", "my-skill");
      await createSkill(".gemini", "my-skill");

      const result = await discoverSkillsByAgent({ global: false, gitRoot: tempDir });

      expect(result.length).toBe(2);

      const claudeGroup = result.find((g) => g.agentName === "claude");
      expect(claudeGroup).toBeDefined();
      expect(claudeGroup?.skills).toHaveLength(1);
      expect(claudeGroup?.skills[0].name).toBe("my-skill");

      const geminiGroup = result.find((g) => g.agentName === "gemini");
      expect(geminiGroup).toBeDefined();
      expect(geminiGroup?.skills).toHaveLength(1);
      expect(geminiGroup?.skills[0].name).toBe("my-skill");
    });

    it("should skip agents with no skills", async () => {
      await createSkill(".claude", "my-skill");

      const result = await discoverSkillsByAgent({ global: false, gitRoot: tempDir });

      expect(result.length).toBe(1);
      expect(result[0].agentName).toBe("claude");
    });

    it("should discover multiple skills per agent", async () => {
      await createSkill(".claude", "skill-a");
      await createSkill(".claude", "skill-b");
      await createSkill(".claude", "skill-c");

      const result = await discoverSkillsByAgent({ global: false, gitRoot: tempDir });

      expect(result.length).toBe(1);
      expect(result[0].skills).toHaveLength(3);
    });
  });

  // ── showList ──────────────────────────────────────────────────

  describe("showList", () => {
    it("should show 'No skills found.' when no skills exist", async () => {
      await showList({ global: false, gitRoot: tempDir });

      expect(consoleOutput.some((line) => line.includes("No skills found."))).toBe(true);
    });

    it("should display skills grouped by agent", async () => {
      await createSkill(".claude", "develop-it");
      await createSkill(".claude", "check-tests");
      await createSkill(".gemini", "develop-it");

      await showList({ global: false, gitRoot: tempDir });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Claude Code");
      expect(output).toContain("Gemini CLI");
      expect(output).toContain("develop-it");
      expect(output).toContain("check-tests");
      // Summary line
      expect(output).toContain("3 skills across 2 agents (2 unique)");
    });

    it("should show correct mode label for project-level", async () => {
      await createSkill(".claude", "my-skill");

      await showList({ global: false, gitRoot: tempDir });

      const output = consoleOutput.join("\n");
      expect(output).toContain(`project: ${tempDir}`);
    });

    it("should show 'global' mode label when -g is used", async () => {
      // Use customDirs pointing to tempDir so we control the environment
      await createSkill(".claude", "my-skill");
      const customDirs = { claude: tempDir } as Record<string, string>;

      await showList({ global: true, gitRoot: tempDir, customDirs });

      const output = consoleOutput.join("\n");
      expect(output).toContain("global");
    });
  });
});
