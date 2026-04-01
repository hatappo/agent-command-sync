import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRepoCacheDir,
  listSkillsAtRef,
  readSkillFilesAtCommit,
  resolveCommitForPath,
  resolveTreeHashAtCommit,
} from "../../src/utils/git-repo-cache.js";

const execFileAsync = promisify(execFile);

describe("git-repo-cache", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = join(tmpdir(), `git-repo-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(repoDir, { recursive: true });

    await execFileAsync("git", ["init", "-b", "main"], { cwd: repoDir });
    await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: repoDir });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: repoDir });

    await writeRepoFile(".claude/skills/demo/SKILL.md", "---\ndescription: v1\n---\n# Demo");
    await writeRepoFile(".claude/skills/demo/helper.ts", "export const version = 1;\n");
    await commitAll("2024-01-01T00:00:00Z", "feat: initial skill");

    await writeRepoFile(".claude/skills/demo/SKILL.md", "---\ndescription: v2\n---\n# Demo");
    await writeRepoFile(".claude/skills/demo/helper.ts", "export const version = 2;\n");
    await commitAll("2024-01-15T00:00:00Z", "feat: update skill");
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(repoDir, { recursive: true, force: true });
  });

  async function writeRepoFile(relativePath: string, content: string): Promise<void> {
    const filePath = join(repoDir, relativePath);
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, content, "utf-8");
  }

  async function commitAll(isoDate: string, message: string): Promise<void> {
    await execFileAsync("git", ["add", "."], { cwd: repoDir });
    await execFileAsync("git", ["commit", "-m", message], {
      cwd: repoDir,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: isoDate,
        GIT_COMMITTER_DATE: isoDate,
      },
    });
  }

  it("should normalize owner and repo names in the cache directory key", () => {
    const cacheDir = getRepoCacheDir("Owner", "Repo");
    expect(cacheDir).toContain("owner_repo.git");
  });

  it("should list skills at a ref with tree hashes", async () => {
    const skills = await listSkillsAtRef(repoDir, "HEAD");

    expect(skills).toHaveLength(1);
    expect(skills[0].path).toBe(".claude/skills/demo");
    expect(skills[0].files).toContain(".claude/skills/demo/SKILL.md");
    expect(skills[0].treeHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("should resolve eligible commits using committer date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-20T00:00:00Z"));

    const recentEligible = await resolveCommitForPath(repoDir, "HEAD", ".claude/skills/demo", 3);
    const olderEligible = await resolveCommitForPath(repoDir, "HEAD", ".claude/skills/demo", 10);

    expect(recentEligible).toMatch(/^[0-9a-f]{40}$/);
    expect(olderEligible).toMatch(/^[0-9a-f]{40}$/);
    expect(recentEligible).not.toBe(olderEligible);
  });

  it("should resolve the tree hash for a specific commit and path", async () => {
    const commit = await resolveCommitForPath(repoDir, "HEAD", ".claude/skills/demo");
    const treeHash = await resolveTreeHashAtCommit(repoDir, commit ?? "", ".claude/skills/demo");

    expect(treeHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("should read skill files from an older eligible commit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-20T00:00:00Z"));

    const olderCommit = await resolveCommitForPath(repoDir, "HEAD", ".claude/skills/demo", 10);
    const files = await readSkillFilesAtCommit(repoDir, olderCommit ?? "", ".claude/skills/demo");
    const skillFile = files.find((file) => file.relativePath === "SKILL.md");

    expect(skillFile).toBeDefined();
    expect(typeof skillFile?.content).toBe("string");
    expect(String(skillFile?.content)).toContain("description: v1");

    const helperPath = join(repoDir, ".claude/skills/demo/helper.ts");
    const currentContent = await readFile(helperPath, "utf-8");
    expect(currentContent).toContain("version = 2");
  });
});
