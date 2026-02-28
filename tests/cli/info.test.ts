import { mkdir, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGitHubUrl, buildSkillsShUrl, buildSkillsmpUrl, showSkillInfo } from "../../src/cli/info.js";

// Mock getOriginRemoteUrl
vi.mock("../../src/utils/git-utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils/git-utils.js")>();
  return {
    ...actual,
    getOriginRemoteUrl: vi.fn(),
  };
});

import { getOriginRemoteUrl } from "../../src/utils/git-utils.js";

describe("info command", () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: Mock;
  let tempDir: string;
  let consoleOutput: string[];

  beforeEach(async () => {
    (matter as unknown as { clearCache: () => void }).clearCache();

    tempDir = join(tmpdir(), `info-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    consoleOutput = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.join(" "));
    });

    vi.mocked(getOriginRemoteUrl).mockReset();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  // ── Helpers ─────────────────────────────────────────────────────

  const treeHash1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  async function createLocalSkill(
    relativePath: string,
    skillName: string,
    frontmatterOverrides: Record<string, unknown> = {},
  ): Promise<string> {
    const skillDir = join(tempDir, relativePath, skillName);
    await mkdir(skillDir, { recursive: true });
    const frontmatter: Record<string, unknown> = { description: "Test Skill", ...frontmatterOverrides };
    const content = matter.stringify(`# ${skillName}`, frontmatter);
    await fsWriteFile(join(skillDir, "SKILL.md"), content, "utf-8");
    return skillDir;
  }

  async function createSupportFile(skillDir: string, relativePath: string, content = "content"): Promise<void> {
    const filePath = join(skillDir, relativePath);
    await mkdir(join(filePath, ".."), { recursive: true });
    await fsWriteFile(filePath, content, "utf-8");
  }

  function mockDefaultBranch(branch = "main"): void {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ default_branch: branch }),
      headers: new Headers(),
    } as Response);
  }

  function mockTreeScan(skills: { name: string; path: string; treeHash?: string }[], truncated = false): void {
    const treeItems: { path: string; type: string; mode: string; sha: string; url: string }[] = [];
    for (const skill of skills) {
      treeItems.push({
        path: skill.path,
        type: "tree",
        mode: "040000",
        sha: skill.treeHash ?? `tree-${skill.name}`,
        url: "",
      });
      treeItems.push({ path: `${skill.path}/SKILL.md`, type: "blob", mode: "100644", sha: "s1", url: "" });
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sha: "abc", url: "...", tree: treeItems, truncated }),
      headers: new Headers(),
    } as Response);
  }

  // ── URL Builders ──────────────────────────────────────────────

  describe("buildGitHubUrl", () => {
    it("should build a GitHub tree URL", () => {
      expect(buildGitHubUrl("TryGhost", "Ghost", "main", ".claude/skills/create-database-migration")).toBe(
        "https://github.com/TryGhost/Ghost/tree/main/.claude/skills/create-database-migration",
      );
    });

    it("should preserve non-main branches", () => {
      expect(buildGitHubUrl("owner", "repo", "develop", "skills/my-skill")).toBe(
        "https://github.com/owner/repo/tree/develop/skills/my-skill",
      );
    });
  });

  describe("buildSkillsShUrl", () => {
    it("should build a skills.sh URL", () => {
      expect(buildSkillsShUrl("TryGhost", "Ghost", "create-database-migration")).toBe(
        "https://skills.sh/TryGhost/Ghost/create-database-migration",
      );
    });

    it("should preserve case from input", () => {
      expect(buildSkillsShUrl("anthropics", "skills", "frontend-design")).toBe(
        "https://skills.sh/anthropics/skills/frontend-design",
      );
    });
  });

  describe("buildSkillsmpUrl", () => {
    it("should convert TryGhost/Ghost example correctly", () => {
      expect(buildSkillsmpUrl("TryGhost", "Ghost", ".claude/skills/create-database-migration")).toBe(
        "https://skillsmp.com/skills/tryghost-ghost-claude-skills-create-database-migration-skill-md",
      );
    });

    it("should replace dots with hyphens", () => {
      expect(buildSkillsmpUrl("owner", "repo", ".gemini/skills/my.skill")).toBe(
        "https://skillsmp.com/skills/owner-repo-gemini-skills-my-skill-skill-md",
      );
    });

    it("should replace underscores with hyphens", () => {
      expect(buildSkillsmpUrl("owner", "repo", ".claude/skills/my_skill")).toBe(
        "https://skillsmp.com/skills/owner-repo-claude-skills-my-skill-skill-md",
      );
    });

    it("should collapse consecutive hyphens", () => {
      expect(buildSkillsmpUrl("owner", "repo", ".claude/skills/a..b__c")).toBe(
        "https://skillsmp.com/skills/owner-repo-claude-skills-a-b-c-skill-md",
      );
    });

    it("should lowercase everything", () => {
      expect(buildSkillsmpUrl("TryGhost", "Ghost", ".Claude/Skills/My-Skill")).toBe(
        "https://skillsmp.com/skills/tryghost-ghost-claude-skills-my-skill-skill-md",
      );
    });
  });

  // ── showSkillInfo ─────────────────────────────────────────────

  describe("showSkillInfo", () => {
    describe("meta information", () => {
      it("should display description, path, and remote", async () => {
        await createLocalSkill(".claude/skills", "my-skill", { description: "A great skill" });
        vi.mocked(getOriginRemoteUrl).mockResolvedValue("https://github.com/user/project");

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain("my-skill");
        expect(output).toContain("A great skill");
        expect(output).toContain(".claude/skills/my-skill");
        expect(output).toContain("https://github.com/user/project");
      });

      it("should display source when _from exists", async () => {
        await createLocalSkill(".claude/skills", "my-skill", { _from: `owner/repo@${treeHash1}` });
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);
        mockDefaultBranch();
        mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash1 }]);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain(`owner/repo@${treeHash1}`);
      });

      it("should display license when present", async () => {
        await createLocalSkill(".claude/skills", "my-skill", { license: "MIT" });
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain("MIT");
      });

      it("should not display license when absent", async () => {
        await createLocalSkill(".claude/skills", "my-skill");
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).not.toContain("License:");
      });

      it("should show dash when remote is not available", async () => {
        await createLocalSkill(".claude/skills", "my-skill");
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toMatch(/Remote:\s+-/);
      });

      it("should show dash when not in git repo", async () => {
        const skillDir = await createLocalSkill(".claude/skills", "my-skill");
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        await showSkillInfo({
          skillPath: skillDir,

          verbose: false,
          global: false,
          gitRoot: null,
        });

        const output = consoleOutput.join("\n");
        expect(output).toMatch(/Remote:\s+-/);
      });
    });

    describe("files section", () => {
      it("should list direct files", async () => {
        const skillDir = await createLocalSkill(".claude/skills", "my-skill");
        await createSupportFile(skillDir, "helper.py");
        await createSupportFile(skillDir, "config.json");
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain("SKILL.md");
        expect(output).toContain("config.json");
        expect(output).toContain("helper.py");
      });

      it("should show subdirectories with file count", async () => {
        const skillDir = await createLocalSkill(".claude/skills", "my-skill");
        await createSupportFile(skillDir, "core/module1.py");
        await createSupportFile(skillDir, "core/module2.py");
        await createSupportFile(skillDir, "core/nested/deep.py");
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain("SKILL.md");
        expect(output).toMatch(/core\/\s+\(3 files\)/);
      });
    });

    describe("source links", () => {
      it("should display source links in correct order (skillsmp before skills.sh)", async () => {
        await createLocalSkill(".claude/skills", "my-skill", { _from: `owner/repo@${treeHash1}` });
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);
        mockDefaultBranch();
        mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash1 }]);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain("Source links:");
        expect(output).toContain("https://github.com/owner/repo/tree/main/.claude/skills/my-skill");
        expect(output).toContain("https://skillsmp.com/skills/owner-repo-claude-skills-my-skill-skill-md");
        expect(output).toContain("https://skills.sh/owner/repo/my-skill");

        // Verify order: skillsmp before skills.sh
        const skillsmpIndex = output.indexOf("skillsmp:");
        const skillsShIndex = output.indexOf("skills.sh:");
        expect(skillsmpIndex).toBeLessThan(skillsShIndex);
      });

      it("should not show source links when _from is absent", async () => {
        await createLocalSkill(".claude/skills", "my-skill");
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).not.toContain("Source links:");
        expect(output).not.toContain("GitHub:");
      });
    });

    describe("SKILL.md path tolerance", () => {
      it("should accept SKILL.md path and use parent directory", async () => {
        await createLocalSkill(".claude/skills", "my-skill");
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill/SKILL.md",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain("my-skill");
      });
    });

    describe("error handling", () => {
      it("should throw when skill directory has no SKILL.md", async () => {
        await mkdir(join(tempDir, "not-a-skill"), { recursive: true });

        await expect(
          showSkillInfo({
            skillPath: "not-a-skill",

            verbose: false,
            global: false,
            gitRoot: tempDir,
          }),
        ).rejects.toThrow("Not a skill directory");
      });

      it("should handle API errors gracefully for source links", async () => {
        await createLocalSkill(".claude/skills", "my-skill", { _from: `owner/repo@${treeHash1}` });
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          headers: new Headers(),
        } as Response);

        // Should not throw — API errors are non-fatal for info display
        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: false,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain("my-skill");
        expect(output).not.toContain("Source links:");
      });
    });

    describe("verbose mode", () => {
      it("should show debug info in verbose mode", async () => {
        await createLocalSkill(".claude/skills", "my-skill", { _from: `owner/repo@${treeHash1}` });
        vi.mocked(getOriginRemoteUrl).mockResolvedValue(null);
        mockDefaultBranch();
        mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash1 }]);

        await showSkillInfo({
          skillPath: ".claude/skills/my-skill",

          verbose: true,
          global: false,
          gitRoot: tempDir,
        });

        const output = consoleOutput.join("\n");
        expect(output).toContain("DEBUG:");
      });
    });
  });
});
