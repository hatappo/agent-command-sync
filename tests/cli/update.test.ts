import { mkdir, readFile, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseFromValue, updateSkills } from "../../src/cli/update.js";

describe("update command", () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: Mock;
  let tempDir: string;
  let consoleOutput: string[];

  beforeEach(async () => {
    (matter as unknown as { clearCache: () => void }).clearCache();

    tempDir = join(tmpdir(), `update-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    consoleOutput = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.join(" "));
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  // ── Helpers ─────────────────────────────────────────────────────

  const treeHash1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const treeHash2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  /** Create a local skill directory with a SKILL.md containing _from */
  async function createLocalSkill(
    relativePath: string,
    skillName: string,
    fromValue?: string,
    description = "Test Skill",
  ): Promise<string> {
    const skillDir = join(tempDir, relativePath, skillName);
    await mkdir(skillDir, { recursive: true });
    const frontmatter: Record<string, unknown> = { description };
    if (fromValue !== undefined) {
      frontmatter._from = fromValue;
    }
    const content = matter.stringify(`# ${skillName}`, frontmatter);
    await fsWriteFile(join(skillDir, "SKILL.md"), content, "utf-8");
    return skillDir;
  }

  /** Mock fetchDefaultBranch response */
  function mockDefaultBranch(branch = "main"): void {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ default_branch: branch }),
      headers: new Headers(),
    } as Response);
  }

  /** Mock scanRepositoryForSkills response */
  function mockTreeScan(
    skills: { name: string; path: string; treeHash?: string }[],
    truncated = false,
  ): void {
    const treeItems: { path: string; type: string; mode: string; sha: string; url: string }[] = [];
    for (const skill of skills) {
      treeItems.push({
        path: skill.path,
        type: "tree",
        mode: "040000",
        sha: skill.treeHash ?? `tree-${skill.name}`,
        url: "",
      });
      treeItems.push({
        path: `${skill.path}/SKILL.md`,
        type: "blob",
        mode: "100644",
        sha: "s1",
        url: "",
      });
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sha: "abc", url: "...", tree: treeItems, truncated }),
      headers: new Headers(),
    } as Response);
  }

  /** Mock fetchSkillFromTree raw download */
  function mockSkillRawDownload(description = "Updated Skill"): void {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => `---\ndescription: ${description}\n---\n# Updated`,
      arrayBuffer: async () => new TextEncoder().encode(`---\ndescription: ${description}\n---\n# Updated`).buffer,
      headers: new Headers(),
    } as Response);
  }

  // ── parseFromValue ────────────────────────────────────────────

  describe("parseFromValue", () => {
    it("should parse owner/repo@treeHash format", () => {
      const result = parseFromValue(`owner/repo@${treeHash1}`);
      expect(result).toEqual({ ownerRepo: "owner/repo", treeHash: treeHash1 });
    });

    it("should parse owner/repo without hash → empty string treeHash", () => {
      const result = parseFromValue("owner/repo");
      expect(result).toEqual({ ownerRepo: "owner/repo", treeHash: "" });
    });

    it("should parse truncated/short hex hash after @", () => {
      const result = parseFromValue("owner/repo@5c2");
      expect(result).toEqual({ ownerRepo: "owner/repo", treeHash: "5c2" });
    });

    it("should not split on @ that is not followed by hex", () => {
      const result = parseFromValue("owner/repo@not-a-hash");
      expect(result).toEqual({ ownerRepo: "owner/repo@not-a-hash", treeHash: "" });
    });

    it("should handle @ at position 0 as no hash", () => {
      const result = parseFromValue(`@${treeHash1}`);
      expect(result).toEqual({ ownerRepo: `@${treeHash1}`, treeHash: "" });
    });
  });

  // ── No argument: scan agent directories ───────────────────────

  describe("no argument (agent directory scan)", () => {
    it("should show message when no skills with _from exist", async () => {
      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("No skills with _from provenance found");
    });

    it("should skip skills without _from", async () => {
      await createLocalSkill(".claude/skills", "no-from-skill", undefined);

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("No skills with _from provenance found");
    });

    it("should find skills in agent directories", async () => {
      await createLocalSkill(".claude/skills", "my-skill", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash1 }]);

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("No upstream changes");
    });

    it("should scan skills across different agent directories", async () => {
      await createLocalSkill(".claude/skills", "skill-c", `owner/repo@${treeHash1}`);
      await createLocalSkill(".gemini/skills", "skill-g", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([
        { name: "skill-c", path: ".claude/skills/skill-c", treeHash: treeHash1 },
        { name: "skill-g", path: ".gemini/skills/skill-g", treeHash: treeHash2 },
      ]);
      mockSkillRawDownload();

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("skill-c");
      expect(output).toContain("No upstream changes");
      expect(output).toContain("skill-g");
      expect(output).toContain("Updated");
    });
  });

  // ── With skill-path argument ──────────────────────────────────

  describe("with skill-path argument", () => {
    it("should find a single skill by direct path", async () => {
      await createLocalSkill("skills", "skill-creator", `anthropics/skills@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "skill-creator", path: "skills/skill-creator", treeHash: treeHash1 }]);

      await updateSkills({
        skillPath: "skills/skill-creator",
        noop: true,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("skill-creator");
      expect(output).toContain("No upstream changes");
    });

    it("should find multiple skills under a parent directory", async () => {
      await createLocalSkill("skills", "skill-a", `owner/repo@${treeHash1}`);
      await createLocalSkill("skills", "skill-b", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([
        { name: "skill-a", path: "skills/skill-a", treeHash: treeHash1 },
        { name: "skill-b", path: "skills/skill-b", treeHash: treeHash2 },
      ]);
      mockSkillRawDownload();

      await updateSkills({
        skillPath: "skills",
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("skill-a");
      expect(output).toContain("No upstream changes");
      expect(output).toContain("skill-b");
      expect(output).toContain("Updated");
    });

    it("should show message when no skills found under path", async () => {
      await mkdir(join(tempDir, "empty-dir"), { recursive: true });

      await updateSkills({
        skillPath: "empty-dir",
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain('No skills with _from provenance found under "empty-dir"');
    });

    it("should update skill at a deep path and write new _from", async () => {
      await createLocalSkill("some/deep/path", "my-skill", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "my-skill", path: "some/deep/path/my-skill", treeHash: treeHash2 }]);
      mockSkillRawDownload();

      await updateSkills({
        skillPath: "some/deep/path/my-skill",
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Updated");

      const skillMd = await readFile(join(tempDir, "some/deep/path/my-skill/SKILL.md"), "utf-8");
      const parsed = matter(skillMd);
      expect(parsed.data._from).toBe(`owner/repo@${treeHash2}`);
    });
  });

  // ── Tree hash comparison ──────────────────────────────────────

  describe("tree hash comparison", () => {
    it("should show 'Up to date' when tree hash matches", async () => {
      await createLocalSkill(".claude/skills", "my-skill", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash1 }]);

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("No upstream changes");
      expect(output).toContain("1 unchanged");
    });

    it("should update when tree hash differs", async () => {
      await createLocalSkill(".claude/skills", "my-skill", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash2 }]);
      mockSkillRawDownload();

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Updated");
      expect(output).toContain("1 skill updated");

      const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
      const parsed = matter(skillMd);
      expect(parsed.data._from).toBe(`owner/repo@${treeHash2}`);
    });

    it("should update when local tree hash is non-existent (invalid but valid hex format)", async () => {
      const fakeHash = "0000000000000000000000000000000000000000";
      await createLocalSkill(".claude/skills", "my-skill", `owner/repo@${fakeHash}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash1 }]);
      mockSkillRawDownload();

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Updated");
      expect(output).toContain("1 skill updated");

      const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
      const parsed = matter(skillMd);
      expect(parsed.data._from).toBe(`owner/repo@${treeHash1}`);
    });

    it("should force download when no local tree hash (legacy _from)", async () => {
      await createLocalSkill(".claude/skills", "my-skill", "owner/repo");

      mockDefaultBranch();
      mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash1 }]);
      mockSkillRawDownload();

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Updated");

      const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
      const parsed = matter(skillMd);
      expect(parsed.data._from).toBe(`owner/repo@${treeHash1}`);
    });
  });

  // ── Noop mode ─────────────────────────────────────────────────

  describe("noop mode", () => {
    it("should not write files in noop mode", async () => {
      await createLocalSkill(".claude/skills", "my-skill", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash2 }]);

      await updateSkills({
        noop: true,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Update available");
      expect(output).toContain("1 update available");
      expect(output).toContain("Dry run complete");

      const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
      const parsed = matter(skillMd);
      expect(parsed.data._from).toBe(`owner/repo@${treeHash1}`);
    });
  });

  // ── Not found / errors ────────────────────────────────────────

  describe("not found in remote", () => {
    it("should show warning when skill not found in remote repo", async () => {
      await createLocalSkill(".claude/skills", "my-skill", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([]);

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Not found in remote");
      expect(output).toContain("1 not found");
    });
  });

  describe("API errors", () => {
    it("should handle repo-level API error gracefully", async () => {
      await createLocalSkill(".claude/skills", "my-skill", `owner/repo@${treeHash1}`);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
      } as Response);

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Error");
      expect(output).toContain("1 error");
    });
  });

  // ── Multiple repos ────────────────────────────────────────────

  describe("multiple repos", () => {
    it("should group skills by owner/repo and batch API calls", async () => {
      await createLocalSkill(".claude/skills", "skill-a", `owner/repo-a@${treeHash1}`);
      await createLocalSkill(".claude/skills", "skill-b", `other/repo-b@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "skill-a", path: ".claude/skills/skill-a", treeHash: treeHash1 }]);

      mockDefaultBranch();
      mockTreeScan([{ name: "skill-b", path: ".claude/skills/skill-b", treeHash: treeHash2 }]);
      mockSkillRawDownload();

      await updateSkills({
        noop: false,
        global: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("owner/repo-a");
      expect(output).toContain("other/repo-b");
      expect(output).toContain("No upstream changes");
      expect(output).toContain("Updated");
    });
  });

  // ── Verbose mode ──────────────────────────────────────────────

  describe("verbose mode", () => {
    it("should show debug info in verbose mode", async () => {
      await createLocalSkill(".claude/skills", "my-skill", `owner/repo@${treeHash1}`);

      mockDefaultBranch();
      mockTreeScan([{ name: "my-skill", path: ".claude/skills/my-skill", treeHash: treeHash1 }]);

      await updateSkills({
        noop: false,
        global: false,
        verbose: true,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("DEBUG:");
    });
  });
});
