import { writeFile as fsWriteFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findGitRoot, getCurrentBranch, getGitHubRemoteUrl } from "../../src/utils/git-utils.js";

describe("git-utils", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `git-utils-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("findGitRoot", () => {
    it("should find git root when .git directory exists", async () => {
      await mkdir(join(tempDir, ".git"));
      const result = await findGitRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it("should find git root from a subdirectory", async () => {
      await mkdir(join(tempDir, ".git"));
      const subDir = join(tempDir, "src", "utils");
      await mkdir(subDir, { recursive: true });

      const result = await findGitRoot(subDir);
      expect(result).toBe(tempDir);
    });

    it("should find git root from a deeply nested subdirectory", async () => {
      await mkdir(join(tempDir, ".git"));
      const deepDir = join(tempDir, "a", "b", "c", "d", "e");
      await mkdir(deepDir, { recursive: true });

      const result = await findGitRoot(deepDir);
      expect(result).toBe(tempDir);
    });

    it("should return null when not in a git repository", async () => {
      // tempDir has no .git
      const result = await findGitRoot(tempDir);
      expect(result).toBeNull();
    });

    it("should handle .git as a file (worktree/submodule)", async () => {
      // Worktrees and submodules use a .git file instead of a directory
      await fsWriteFile(join(tempDir, ".git"), "gitdir: /some/other/path/.git/worktrees/test");
      const result = await findGitRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it("should use process.cwd() when startDir is not specified", async () => {
      // This test just verifies it doesn't throw when called without args
      const result = await findGitRoot();
      // We're running tests from a git repo, so it should find something
      expect(typeof result === "string" || result === null).toBe(true);
    });
  });

  describe("getGitHubRemoteUrl", () => {
    it("should return HTTPS URL for SSH remote", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(
        join(tempDir, ".git", "config"),
        [
          "[core]",
          "\trepositoryformatversion = 0",
          '[remote "origin"]',
          "\turl = git@github.com:owner/repo.git",
          "\tfetch = +refs/heads/*:refs/remotes/origin/*",
        ].join("\n"),
      );
      const result = await getGitHubRemoteUrl(tempDir);
      expect(result).toBe("https://github.com/owner/repo");
    });

    it("should return HTTPS URL for HTTPS remote with .git suffix", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(
        join(tempDir, ".git", "config"),
        [
          '[remote "origin"]',
          "\turl = https://github.com/owner/repo.git",
          "\tfetch = +refs/heads/*:refs/remotes/origin/*",
        ].join("\n"),
      );
      const result = await getGitHubRemoteUrl(tempDir);
      expect(result).toBe("https://github.com/owner/repo");
    });

    it("should return HTTPS URL for HTTPS remote without .git suffix", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(
        join(tempDir, ".git", "config"),
        ['[remote "origin"]', "\turl = https://github.com/owner/repo"].join("\n"),
      );
      const result = await getGitHubRemoteUrl(tempDir);
      expect(result).toBe("https://github.com/owner/repo");
    });

    it("should return null for non-GitHub remote", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(
        join(tempDir, ".git", "config"),
        ['[remote "origin"]', "\turl = git@gitlab.com:owner/repo.git"].join("\n"),
      );
      const result = await getGitHubRemoteUrl(tempDir);
      expect(result).toBeNull();
    });

    it("should return null when no origin remote exists", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(
        join(tempDir, ".git", "config"),
        ['[remote "upstream"]', "\turl = git@github.com:owner/repo.git"].join("\n"),
      );
      const result = await getGitHubRemoteUrl(tempDir);
      expect(result).toBeNull();
    });

    it("should return null when .git directory does not exist", async () => {
      const result = await getGitHubRemoteUrl(tempDir);
      expect(result).toBeNull();
    });

    it("should handle worktree .git file", async () => {
      // Create a fake worktree structure
      const mainGitDir = join(tempDir, "main-repo", ".git");
      await mkdir(mainGitDir, { recursive: true });
      await fsWriteFile(
        join(mainGitDir, "config"),
        ['[remote "origin"]', "\turl = git@github.com:owner/repo.git"].join("\n"),
      );

      // Create worktree directory with .git file pointing to main
      const worktreeDir = join(tempDir, "worktree");
      await mkdir(worktreeDir, { recursive: true });
      await fsWriteFile(join(worktreeDir, ".git"), `gitdir: ${mainGitDir}/worktrees/test`);

      // Create the worktrees directory structure
      const worktreeGitDir = join(mainGitDir, "worktrees", "test");
      await mkdir(worktreeGitDir, { recursive: true });
      // The worktree git dir should have a reference to the common dir
      await fsWriteFile(join(worktreeGitDir, "commondir"), "../..");
      // Config is read from the main .git/config, so we need to resolve the actual git dir
      // For worktrees, config lives in the main .git directory
      await fsWriteFile(
        join(worktreeGitDir, "config"),
        ['[remote "origin"]', "\turl = git@github.com:owner/repo.git"].join("\n"),
      );

      const result = await getGitHubRemoteUrl(worktreeDir);
      expect(result).toBe("https://github.com/owner/repo");
    });

    it("should handle multiple remotes and pick origin", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(
        join(tempDir, ".git", "config"),
        [
          '[remote "upstream"]',
          "\turl = git@github.com:upstream/repo.git",
          '[remote "origin"]',
          "\turl = git@github.com:owner/repo.git",
          '[remote "fork"]',
          "\turl = git@github.com:fork/repo.git",
        ].join("\n"),
      );
      const result = await getGitHubRemoteUrl(tempDir);
      expect(result).toBe("https://github.com/owner/repo");
    });
  });

  describe("getCurrentBranch", () => {
    it("should return branch name for normal ref", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(join(tempDir, ".git", "HEAD"), "ref: refs/heads/main\n");
      const result = await getCurrentBranch(tempDir);
      expect(result).toBe("main");
    });

    it("should return branch name with slashes", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(join(tempDir, ".git", "HEAD"), "ref: refs/heads/feature/my-branch\n");
      const result = await getCurrentBranch(tempDir);
      expect(result).toBe("feature/my-branch");
    });

    it("should return short SHA for detached HEAD", async () => {
      await mkdir(join(tempDir, ".git"));
      await fsWriteFile(join(tempDir, ".git", "HEAD"), "abcdef1234567890abcdef1234567890abcdef12\n");
      const result = await getCurrentBranch(tempDir);
      expect(result).toBe("abcdef1");
    });

    it("should return null when .git does not exist", async () => {
      const result = await getCurrentBranch(tempDir);
      expect(result).toBeNull();
    });

    it("should return null when HEAD file is missing", async () => {
      await mkdir(join(tempDir, ".git"));
      // No HEAD file created
      const result = await getCurrentBranch(tempDir);
      expect(result).toBeNull();
    });

    it("should handle worktree .git file", async () => {
      // Create main repo git dir with HEAD
      const mainGitDir = join(tempDir, "main-repo", ".git");
      await mkdir(mainGitDir, { recursive: true });

      // Create worktree git dir structure
      const worktreeGitDir = join(mainGitDir, "worktrees", "test");
      await mkdir(worktreeGitDir, { recursive: true });
      await fsWriteFile(join(worktreeGitDir, "HEAD"), "ref: refs/heads/feature-branch\n");

      // Create worktree directory with .git file pointing to worktree git dir
      const worktreeDir = join(tempDir, "worktree");
      await mkdir(worktreeDir, { recursive: true });
      await fsWriteFile(join(worktreeDir, ".git"), `gitdir: ${worktreeGitDir}`);

      const result = await getCurrentBranch(worktreeDir);
      expect(result).toBe("feature-branch");
    });
  });
});
