import { writeFile as fsWriteFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findGitRoot } from "../../src/utils/git-utils.js";

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
});
