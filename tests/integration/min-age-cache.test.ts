import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadSkill } from "../../src/cli/download.js";
import { updateSkills } from "../../src/cli/update.js";
import { getRepoCacheDir, resolveTreeHashAtCommit } from "../../src/utils/git-repo-cache.js";

const execFileAsync = promisify(execFile);

describe("min-age cache integration", () => {
  let tempDir: string;
  let workRepoDir: string;
  let remoteRootDir: string;
  let bareRemoteDir: string;
  let homeDir: string;
  let cacheDir: string;
  let projectDir: string;
  let gitConfigPath: string;
  let originalHome: string | undefined;
  let originalXdgCacheHome: string | undefined;
  let originalGitConfigGlobal: string | undefined;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-25T00:00:00Z"));

    tempDir = join(tmpdir(), `min-age-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    workRepoDir = join(tempDir, "work-repo");
    remoteRootDir = join(tempDir, "remote-root");
    bareRemoteDir = join(remoteRootDir, "owner", "repo.git");
    homeDir = join(tempDir, "home");
    cacheDir = join(tempDir, "cache");
    projectDir = join(tempDir, "project");
    gitConfigPath = join(homeDir, ".gitconfig");

    await mkdir(workRepoDir, { recursive: true });
    await mkdir(join(remoteRootDir, "owner"), { recursive: true });
    await mkdir(homeDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });

    originalHome = process.env.HOME;
    originalXdgCacheHome = process.env.XDG_CACHE_HOME;
    originalGitConfigGlobal = process.env.GIT_CONFIG_GLOBAL;
    process.env.HOME = homeDir;
    process.env.XDG_CACHE_HOME = cacheDir;
    process.env.GIT_CONFIG_GLOBAL = gitConfigPath;

    await execFileAsync("git", ["init", "-b", "main"], { cwd: workRepoDir });
    await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: workRepoDir });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: workRepoDir });
    await execFileAsync(
      "git",
      ["config", "--global", `url.file://${remoteRootDir}/.insteadOf`, "https://github.com/"],
      {
        cwd: workRepoDir,
        env: process.env,
      },
    );

    await writeSkillVersion("v1", "2024-01-01T00:00:00Z");
    await writeSkillVersion("v2", "2024-01-10T00:00:00Z");
    await writeSkillVersion("v3", "2024-01-20T00:00:00Z");

    await execFileAsync("git", ["clone", "--bare", workRepoDir, bareRemoteDir]);
  });

  afterEach(async () => {
    vi.useRealTimers();

    if (originalHome === undefined) {
      process.env.HOME = undefined;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalXdgCacheHome === undefined) {
      process.env.XDG_CACHE_HOME = undefined;
    } else {
      process.env.XDG_CACHE_HOME = originalXdgCacheHome;
    }

    if (originalGitConfigGlobal === undefined) {
      process.env.GIT_CONFIG_GLOBAL = undefined;
    } else {
      process.env.GIT_CONFIG_GLOBAL = originalGitConfigGlobal;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  async function writeSkillVersion(version: string, isoDate: string): Promise<void> {
    const skillDir = join(workRepoDir, ".claude", "skills", "demo");
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), `---\ndescription: ${version}\n---\n# Demo ${version}\n`, "utf-8");
    await writeFile(join(skillDir, "helper.ts"), `export const version = "${version}";\n`, "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: workRepoDir });
    await execFileAsync("git", ["commit", "-m", `feat: ${version}`], {
      cwd: workRepoDir,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: isoDate,
        GIT_COMMITTER_DATE: isoDate,
      },
    });
  }

  it("should add from HEAD through the bare cache and re-pin on update --min-age", async () => {
    const skillUrl = "https://github.com/owner/repo/tree/main/.claude/skills/demo";

    await downloadSkill({
      url: skillUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: projectDir,
    });

    const skillMdPath = join(projectDir, ".claude", "skills", "demo", "SKILL.md");
    const helperPath = join(projectDir, ".claude", "skills", "demo", "helper.ts");
    const initialSkill = matter(await readFile(skillMdPath, "utf-8"));
    expect(initialSkill.data._from).toBeDefined();
    expect(String(initialSkill.data._from)).toMatch(/^owner\/repo@[0-9a-f]{7}$/);
    expect(await readFile(helperPath, "utf-8")).toContain('version = "v3"');

    const headCommit = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: workRepoDir })).stdout.trim();
    const olderCommit = (
      await execFileAsync("git", ["rev-list", "--max-count=1", "--before=2024-01-16T00:00:00Z", "HEAD"], {
        cwd: workRepoDir,
      })
    ).stdout.trim();
    const expectedHeadTree = await resolveTreeHashAtCommit(workRepoDir, headCommit, ".claude/skills/demo");
    const expectedEligibleTree = await resolveTreeHashAtCommit(workRepoDir, olderCommit, ".claude/skills/demo");

    expect(initialSkill.data._from).toBe(`owner/repo@${expectedHeadTree?.slice(0, 7)}`);

    const cacheRepoDir = getRepoCacheDir("owner", "repo");
    expect(cacheRepoDir).toBe(join(cacheDir, "agent-skill-porter", "repos", "owner_repo.git"));
    await expect(readFile(join(cacheRepoDir, "HEAD"), "utf-8")).resolves.toContain("refs");

    await updateSkills({
      noop: false,
      global: false,
      verbose: false,
      gitRoot: projectDir,
      minAge: 10,
    });

    const updatedSkill = matter(await readFile(skillMdPath, "utf-8"));
    expect(updatedSkill.data._from).toBe(`owner/repo@${expectedEligibleTree?.slice(0, 7)}`);
    expect(await readFile(helperPath, "utf-8")).toContain('version = "v2"');
  });
});
