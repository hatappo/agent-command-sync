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
    getSkillAtPath: vi.fn(),
    listSkillsAtRef: vi.fn(),
    readSkillFilesAtCommit: vi.fn(),
    resolveCommitForPath: vi.fn(),
    resolveDefaultBranch: vi.fn(),
    resolveTreeHashAtCommit: vi.fn(),
  };
});

import { downloadSkill } from "../../src/cli/download.js";
import {
  ensureGitHubRepoCache,
  getSkillAtPath,
  listSkillsAtRef,
  readSkillFilesAtCommit,
  resolveCommitForPath,
  resolveDefaultBranch,
  resolveTreeHashAtCommit,
} from "../../src/utils/git-repo-cache.js";

describe("download command", () => {
  let tempDir: string;
  let consoleOutput: string[];
  let originalHome: string | undefined;

  beforeEach(async () => {
    (matter as unknown as { clearCache: () => void }).clearCache();

    tempDir = join(tmpdir(), `download-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    consoleOutput = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.join(" "));
    });

    originalHome = process.env.HOME;

    vi.mocked(ensureGitHubRepoCache).mockResolvedValue({ owner: "owner", repo: "repo", dir: "/cache/repo.git" });
    vi.mocked(resolveDefaultBranch).mockResolvedValue("main");
    vi.mocked(resolveCommitForPath).mockResolvedValue("commit-1");
    vi.mocked(resolveTreeHashAtCommit).mockResolvedValue("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
    vi.mocked(readSkillFilesAtCommit).mockResolvedValue([
      { relativePath: "SKILL.md", content: "---\ndescription: My Skill\n---\n# My Skill", isBinary: false },
      { relativePath: "helper.ts", content: "export function helper() {}", isBinary: false },
    ]);
    vi.mocked(getSkillAtPath).mockResolvedValue({
      name: "my-skill",
      path: ".claude/skills/my-skill",
      files: [".claude/skills/my-skill/SKILL.md", ".claude/skills/my-skill/helper.ts"],
      treeHash: "headtree",
    });
    vi.mocked(listSkillsAtRef).mockResolvedValue([
      {
        name: "my-skill",
        path: ".claude/skills/my-skill",
        files: [".claude/skills/my-skill/SKILL.md", ".claude/skills/my-skill/helper.ts"],
        treeHash: "headtree",
      },
    ]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalHome === undefined) {
      process.env.HOME = undefined;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  const testUrl = "https://github.com/owner/repo/tree/main/.claude/skills/my-skill";

  it("should download a single skill to the project-level path by default", async () => {
    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
    const parsed = matter(skillMd);
    expect(parsed.data._from).toBe("owner/repo@a1b2c3d");

    const helperTs = await readFile(join(tempDir, ".claude/skills/my-skill/helper.ts"), "utf-8");
    expect(helperTs).toBe("export function helper() {}");
  });

  it("should use the destination agent directory outside a git repository", async () => {
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      await downloadSkill({
        url: testUrl,
        destination: "gemini",
        global: false,
        noop: false,
        verbose: false,
        gitRoot: null,
      });
    } finally {
      process.chdir(originalCwd);
    }

    const skillMd = await readFile(join(tempDir, ".gemini/skills/my-skill/SKILL.md"), "utf-8");
    expect(skillMd).toContain("description: My Skill");
  });

  it("should not write files in noop mode", async () => {
    await downloadSkill({
      url: testUrl,
      global: false,
      noop: true,
      verbose: false,
      gitRoot: tempDir,
    });

    await expect(readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8")).rejects.toThrow();
    expect(consoleOutput.join("\n")).toContain("would create");
  });

  it("should skip a single skill when no eligible version exists for min-age", async () => {
    vi.mocked(resolveCommitForPath).mockResolvedValue(null);

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
      minAge: 30,
    });

    expect(consoleOutput.join("\n")).toContain("no eligible version found");
    await expect(readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8")).rejects.toThrow();
  });

  it("should download repo skills and skip only the ones without an eligible version", async () => {
    const repoUrl = "https://github.com/owner/repo";
    const repoSkills: DiscoveredSkill[] = [
      {
        name: "my-skill",
        path: ".claude/skills/my-skill",
        files: [".claude/skills/my-skill/SKILL.md"],
        treeHash: "headtree-1",
      },
      {
        name: "other-skill",
        path: ".claude/skills/other-skill",
        files: [".claude/skills/other-skill/SKILL.md"],
        treeHash: "headtree-2",
      },
    ];

    vi.mocked(listSkillsAtRef).mockResolvedValue(repoSkills);
    vi.mocked(resolveCommitForPath).mockImplementation(async (_repoDir, _ref, skillPath) =>
      skillPath.includes("other-skill") ? null : "commit-1",
    );
    vi.mocked(resolveTreeHashAtCommit).mockResolvedValue("feedbeef0123456789abcdef0123456789abcdef");
    vi.mocked(readSkillFilesAtCommit).mockImplementation(async (_repoDir, _commitSha, skillPath) => [
      {
        relativePath: "SKILL.md",
        content: `---\ndescription: ${skillPath.split("/").pop()}\n---\n# Skill`,
        isBinary: false,
      },
    ]);

    await downloadSkill({
      url: repoUrl,
      destination: "gemini",
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
      minAge: 14,
    });

    const created = await readFile(join(tempDir, ".gemini/skills/my-skill/SKILL.md"), "utf-8");
    expect(created).toContain("_from: owner/repo@feedbee");
    await expect(readFile(join(tempDir, ".gemini/skills/other-skill/SKILL.md"), "utf-8")).rejects.toThrow();
    expect(consoleOutput.join("\n")).toContain("other-skill -");
    expect(consoleOutput.join("\n")).toContain("no eligible version found");
  });

  it("should omit _from when noProvenance is true", async () => {
    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
      noProvenance: true,
    });

    const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
    expect(skillMd).not.toContain("_from");
  });
});
