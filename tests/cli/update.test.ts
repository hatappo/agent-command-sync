import { writeFile as fsWriteFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveredSkill } from "../../src/utils/github-utils.js";

vi.mock("../../src/utils/git-repo-cache.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils/git-repo-cache.js")>();
  return {
    ...actual,
    ensureGitHubRepoCache: vi.fn(),
    listSkillsAtRef: vi.fn(),
    readSkillFilesAtCommit: vi.fn(),
    resolveCommitForPath: vi.fn(),
    resolveDefaultBranch: vi.fn(),
    resolveTreeHashAtCommit: vi.fn(),
  };
});

import { hashesMatch, parseFromValue, updateSkills } from "../../src/cli/update.js";
import {
  ensureGitHubRepoCache,
  listSkillsAtRef,
  readSkillFilesAtCommit,
  resolveCommitForPath,
  resolveDefaultBranch,
  resolveTreeHashAtCommit,
} from "../../src/utils/git-repo-cache.js";

describe("update command", () => {
  let tempDir: string;
  let consoleOutput: string[];

  beforeEach(async () => {
    (matter as unknown as { clearCache: () => void }).clearCache();

    tempDir = join(tmpdir(), `update-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    consoleOutput = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.join(" "));
    });

    vi.mocked(ensureGitHubRepoCache).mockResolvedValue({ owner: "owner", repo: "repo", dir: "/cache/repo.git" });
    vi.mocked(resolveDefaultBranch).mockResolvedValue("main");
    vi.mocked(resolveCommitForPath).mockResolvedValue("eligible-commit");
    vi.mocked(resolveTreeHashAtCommit).mockImplementation(async (_repoDir, commitSha) =>
      commitSha === "eligible-commit"
        ? "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        : "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    vi.mocked(readSkillFilesAtCommit).mockResolvedValue([
      { relativePath: "SKILL.md", content: "---\ndescription: Updated Skill\n---\n# Updated", isBinary: false },
      { relativePath: "helper.ts", content: "export const updated = true;", isBinary: false },
    ]);
    vi.mocked(listSkillsAtRef).mockResolvedValue([
      {
        name: "my-skill",
        path: ".claude/skills/my-skill",
        files: [".claude/skills/my-skill/SKILL.md", ".claude/skills/my-skill/helper.ts"],
        treeHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    ]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function createLocalSkill(relativePath: string, skillName: string, fromValue?: string): Promise<string> {
    const skillDir = join(tempDir, relativePath, skillName);
    await mkdir(skillDir, { recursive: true });
    const frontmatter: Record<string, unknown> = { description: "Test Skill" };
    if (fromValue !== undefined) {
      frontmatter._from = fromValue;
    }
    const content = matter.stringify(`# ${skillName}`, frontmatter);
    await fsWriteFile(join(skillDir, "SKILL.md"), content, "utf-8");
    return skillDir;
  }

  describe("parseFromValue", () => {
    it("should parse owner/repo@treeHash format", () => {
      expect(parseFromValue("owner/repo@abc123")).toEqual({ ownerRepo: "owner/repo", treeHash: "abc123" });
    });

    it("should treat non-hex suffixes as part of owner/repo", () => {
      expect(parseFromValue("owner/repo@not-a-hash")).toEqual({ ownerRepo: "owner/repo@not-a-hash", treeHash: "" });
    });
  });

  describe("hashesMatch", () => {
    it("should match short and full hashes by prefix", () => {
      expect(hashesMatch("aaaaaaa", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    });

    it("should return false for empty hashes", () => {
      expect(hashesMatch("", "aaaaaaaa")).toBe(false);
    });
  });

  it("should show a message when no skills with _from exist", async () => {
    await updateSkills({
      noop: false,
      global: false,
      verbose: false,
      gitRoot: tempDir,
    });

    expect(consoleOutput.join("\n")).toContain("No skills with _from provenance found");
  });

  it("should report already eligible when the local tree already matches the eligible tree", async () => {
    await createLocalSkill(".claude/skills", "my-skill", "owner/repo@bbbbbbb");

    await updateSkills({
      noop: false,
      global: false,
      verbose: false,
      gitRoot: tempDir,
    });

    expect(consoleOutput.join("\n")).toContain("Already eligible");
  });

  it("should update the skill and refresh _from when the eligible tree changed", async () => {
    await createLocalSkill(".claude/skills", "my-skill", "owner/repo@aaaaaaa");
    vi.mocked(listSkillsAtRef).mockResolvedValue([
      {
        name: "my-skill",
        path: ".claude/skills/my-skill",
        files: [".claude/skills/my-skill/SKILL.md", ".claude/skills/my-skill/helper.ts"],
        treeHash: "cccccccccccccccccccccccccccccccccccccccc",
      },
    ]);

    await updateSkills({
      noop: false,
      global: false,
      verbose: false,
      gitRoot: tempDir,
    });

    const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
    const helper = await readFile(join(tempDir, ".claude/skills/my-skill/helper.ts"), "utf-8");
    const parsed = matter(skillMd);

    expect(parsed.data._from).toBe("owner/repo@bbbbbbb");
    expect(helper).toBe("export const updated = true;");
    expect(consoleOutput.join("\n")).toContain("Updated");
  });

  it("should report re-pinned when local matches HEAD but min-age selects an older eligible tree", async () => {
    await createLocalSkill(".claude/skills", "my-skill", "owner/repo@aaaaaaa");
    vi.mocked(resolveCommitForPath).mockImplementation(async (_repoDir, _ref, _path, minAge) =>
      minAge === undefined ? "head-commit" : "eligible-commit",
    );

    await updateSkills({
      noop: false,
      global: false,
      verbose: false,
      gitRoot: tempDir,
      minAge: 14,
    });

    expect(consoleOutput.join("\n")).toContain("Re-pinned");
  });

  it("should skip with a warning when no eligible version exists", async () => {
    await createLocalSkill(".claude/skills", "my-skill", "owner/repo@aaaaaaa");
    vi.mocked(resolveCommitForPath).mockResolvedValue(null);

    await updateSkills({
      noop: false,
      global: false,
      verbose: false,
      gitRoot: tempDir,
      minAge: 30,
    });

    expect(consoleOutput.join("\n")).toContain("no eligible version found");
  });

  it("should skip duplicate remote skill names because path provenance is not stored", async () => {
    await createLocalSkill(".claude/skills", "my-skill", "owner/repo@aaaaaaa");
    const duplicateSkills: DiscoveredSkill[] = [
      {
        name: "my-skill",
        path: ".claude/skills/my-skill",
        files: [".claude/skills/my-skill/SKILL.md"],
        treeHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        name: "my-skill",
        path: ".gemini/skills/my-skill",
        files: [".gemini/skills/my-skill/SKILL.md"],
        treeHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ];
    vi.mocked(listSkillsAtRef).mockResolvedValue(duplicateSkills);

    await updateSkills({
      noop: false,
      global: false,
      verbose: false,
      gitRoot: tempDir,
    });

    expect(consoleOutput.join("\n")).toContain("multiple remote skills share this name");
  });

  it("should resolve skillPath relative to cwd when gitRoot is null", async () => {
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      await createLocalSkill(".claude/skills", "my-skill", "owner/repo@bbbbbbb");

      await updateSkills({
        skillPath: ".claude/skills/my-skill",
        noop: false,
        global: false,
        verbose: false,
        gitRoot: null,
      });
    } finally {
      process.chdir(originalCwd);
    }

    expect(consoleOutput.join("\n")).toContain("Already eligible");
  });
});
