import { writeFile as fsWriteFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadSkill } from "../../src/cli/download.js";
import type { DownloadedFile, GitHubContentItem } from "../../src/utils/github-utils.js";

describe("download command", () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: Mock;
  let tempDir: string;
  let consoleOutput: string[];

  beforeEach(async () => {
    // Clear gray-matter cache to prevent cross-test pollution
    (matter as unknown as { clearCache: () => void }).clearCache();

    // Set up temp directory
    tempDir = join(tmpdir(), `download-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tempDir, { recursive: true });

    // Mock fetch
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    // Capture console output
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

  const testUrl = "https://github.com/owner/repo/tree/main/.claude/skills/my-skill";

  function mockDirectoryListing(items: Partial<GitHubContentItem>[]): Response {
    return {
      ok: true,
      status: 200,
      json: async () =>
        items.map((item) => ({
          name: item.name ?? "file.txt",
          path: item.path ?? `.claude/skills/my-skill/${item.name}`,
          type: item.type ?? "file",
          size: item.size ?? 100,
          sha: item.sha ?? "abc123",
          download_url:
            item.download_url ??
            `https://raw.githubusercontent.com/owner/repo/main/.claude/skills/my-skill/${item.name}`,
          ...item,
        })),
      headers: new Headers(),
    } as Response;
  }

  function mockFileContent(content: string): Response {
    return {
      ok: true,
      status: 200,
      text: async () => content,
      arrayBuffer: async () => new TextEncoder().encode(content).buffer,
      headers: new Headers(),
    } as Response;
  }

  /** Mock response for the parent directory fetch (tree hash retrieval) */
  function mockParentDirResponse(treeHash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"): Response {
    return mockDirectoryListing([
      { name: "my-skill", type: "dir", path: ".claude/skills/my-skill", sha: treeHash, download_url: null },
    ]);
  }

  function setupBasicMocks() {
    mockFetch
      .mockResolvedValueOnce(
        mockDirectoryListing([
          { name: "SKILL.md", type: "file" },
          { name: "helper.ts", type: "file" },
        ]),
      )
      .mockResolvedValueOnce(mockFileContent("---\ndescription: My Skill\n---\n# My Skill"))
      .mockResolvedValueOnce(mockFileContent("export function helper() {}"))
      // Parent directory fetch (for tree hash)
      .mockResolvedValueOnce(mockParentDirResponse());
  }

  it("should download skill to project-level path based on URL (default)", async () => {
    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    // Check files were created at the URL path relative to gitRoot
    const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
    // SKILL.md should have _from injected with owner/repo format
    expect(skillMd).toContain("_from:");
    expect(skillMd).toContain("owner/repo");
    expect(skillMd).toContain("description: My Skill");

    const helperTs = await readFile(join(tempDir, ".claude/skills/my-skill/helper.ts"), "utf-8");
    expect(helperTs).toBe("export function helper() {}");
  });

  it("should download skill to agent-specific directory with -d option", async () => {
    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      destination: "gemini",
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
      customDirs: { gemini: tempDir },
    });

    // With -d gemini and customDir=tempDir, files go to tempDir/skills/my-skill/
    const skillMd = await readFile(join(tempDir, "skills/my-skill/SKILL.md"), "utf-8");
    expect(skillMd).toContain("description: My Skill");
    expect(skillMd).toContain("owner/repo");
  });

  it("should not write files in noop mode", async () => {
    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: true,
      verbose: false,
      gitRoot: tempDir,
    });

    // Directory should not exist
    const { fileExists } = await import("../../src/utils/file-utils.js");
    expect(await fileExists(join(tempDir, ".claude/skills/my-skill/SKILL.md"))).toBe(false);

    // Should show dry run messages
    const output = consoleOutput.join("\n");
    expect(output).toContain("would create");
    expect(output).toContain("Dry run complete");
  });

  it("should show [A] for new files", async () => {
    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    const output = consoleOutput.join("\n");
    expect(output).toContain("Created");
    expect(output).toContain("2 files created");
    expect(output).toContain("1 skill created");
  });

  it("should show [M] for modified files", async () => {
    // Pre-create existing file with different content
    const skillDir = join(tempDir, ".claude/skills/my-skill");
    await mkdir(skillDir, { recursive: true });
    await fsWriteFile(join(skillDir, "SKILL.md"), "old content", "utf-8");
    await fsWriteFile(join(skillDir, "helper.ts"), "old helper", "utf-8");

    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    const output = consoleOutput.join("\n");
    expect(output).toContain("Updated");
    expect(output).toContain("2 files updated");
    expect(output).toContain("1 skill updated");
  });

  it("should inject _from with owner/repo format", async () => {
    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
    // Verify _from contains owner/repo (not full URL)
    const parsed = matter(skillMd);
    expect(parsed.data._from).toBe("owner/repo@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
  });

  it("should not inject _from when noProvenance is true", async () => {
    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
      noProvenance: true,
    });

    const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
    // Verify raw content doesn't contain _from (avoid gray-matter cache pollution from prior tests)
    expect(skillMd).not.toContain("_from");
  });

  it("should always update _from to latest source", async () => {
    const existingFrom = "original-owner/original-repo";
    const newUrl = "https://github.com/other/repo/tree/main/.claude/skills/other-skill";

    const otherTreeHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    mockFetch
      .mockResolvedValueOnce(mockDirectoryListing([{ name: "SKILL.md", type: "file" }]))
      .mockResolvedValueOnce(mockFileContent(`---\ndescription: My Skill\n_from: ${existingFrom}\n---\n# My Skill`))
      // Parent directory fetch (for tree hash)
      .mockResolvedValueOnce(
        mockDirectoryListing([
          {
            name: "other-skill",
            type: "dir",
            path: ".claude/skills/other-skill",
            sha: otherTreeHash,
            download_url: null,
          },
        ]),
      );

    await downloadSkill({
      url: newUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    const skillMd = await readFile(join(tempDir, ".claude/skills/other-skill/SKILL.md"), "utf-8");
    const parsed = matter(skillMd);
    // Should always update to the new source (with tree hash)
    expect(parsed.data._from).toBe(`other/repo@${otherTreeHash}`);
    expect(skillMd).not.toContain(existingFrom);
  });

  it("should show [=] for unchanged files", async () => {
    // Pre-create existing file with same content (including _from)
    const skillDir = join(tempDir, ".claude/skills/my-skill");
    await mkdir(skillDir, { recursive: true });
    // The SKILL.md needs to already include _from (with tree hash) to be truly unchanged after injection
    const expectedContent = matter.stringify("# My Skill", {
      description: "My Skill",
      _from: "owner/repo@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    });
    await fsWriteFile(join(skillDir, "SKILL.md"), expectedContent, "utf-8");
    await fsWriteFile(join(skillDir, "helper.ts"), "export function helper() {}", "utf-8");

    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    const output = consoleOutput.join("\n");
    expect(output).toContain("Unchanged");
    expect(output).toContain("2 files unchanged");
    expect(output).toContain("1 skill unchanged");
  });

  it("should handle binary files", async () => {
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header

    mockFetch
      .mockResolvedValueOnce(
        mockDirectoryListing([
          { name: "SKILL.md", type: "file" },
          { name: "icon.png", type: "file" },
        ]),
      )
      .mockResolvedValueOnce(mockFileContent("# Skill with icon"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => binaryData.buffer,
        headers: new Headers(),
      } as Response)
      // Parent directory fetch (for tree hash)
      .mockResolvedValueOnce(mockParentDirResponse());

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    // Check text file (SKILL.md gets _from injected with owner/repo@treeHash)
    const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
    expect(skillMd).toContain("# Skill with icon");
    expect(skillMd).toContain("owner/repo");

    // Check binary file
    const iconPng = await readFile(join(tempDir, ".claude/skills/my-skill/icon.png"));
    expect(Buffer.from(iconPng).slice(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("should display verbose debug information when -v is set", async () => {
    setupBasicMocks();

    await downloadSkill({
      url: testUrl,
      global: false,
      noop: false,
      verbose: true,
      gitRoot: tempDir,
    });

    const output = consoleOutput.join("\n");
    expect(output).toContain("DEBUG:");
  });

  it("should throw when -g is used without -d", async () => {
    await expect(
      downloadSkill({
        url: testUrl,
        global: true,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
      }),
    ).rejects.toThrow("acs download with -g/--global requires [to] argument");
  });

  it("should throw for invalid GitHub URLs", async () => {
    await expect(
      downloadSkill({
        url: "https://gitlab.com/owner/repo",
        global: false,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
      }),
    ).rejects.toThrow("Only GitHub URLs");
  });

  it("should propagate API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers(),
    } as Response);

    await expect(
      downloadSkill({
        url: testUrl,
        global: false,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
      }),
    ).rejects.toThrow("Not found");
  });

  it("should handle blob URL pointing to SKILL.md", async () => {
    const blobUrl = "https://github.com/owner/repo/blob/main/.claude/skills/my-skill/SKILL.md";

    setupBasicMocks();

    await downloadSkill({
      url: blobUrl,
      global: false,
      noop: false,
      verbose: false,
      gitRoot: tempDir,
    });

    // Should still download to the skill directory (parent of SKILL.md)
    const skillMd = await readFile(join(tempDir, ".claude/skills/my-skill/SKILL.md"), "utf-8");
    expect(skillMd).toContain("description: My Skill");
    expect(skillMd).toContain("owner/repo");
  });

  describe("repository-level download", () => {
    const repoUrl = "https://github.com/owner/repo";
    const repoTreeUrl = "https://github.com/owner/repo/tree/main";

    function mockRepoApiResponse() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ default_branch: "main" }),
        headers: new Headers(),
      } as Response);
    }

    function mockTreeScanResponse(skillPaths: string[], truncated = false) {
      const treeItems: { path: string; type: string; mode: string; sha: string; url: string }[] = [];
      for (const skillPath of skillPaths) {
        // Add tree entry for the skill directory (provides tree hash)
        treeItems.push({
          path: skillPath,
          type: "tree",
          mode: "040000",
          sha: `tree-${skillPath.split("/").pop()}`,
          url: "",
        });
        treeItems.push(
          { path: `${skillPath}/SKILL.md`, type: "blob", mode: "100644", sha: "s1", url: "" },
          { path: `${skillPath}/helper.ts`, type: "blob", mode: "100644", sha: "s2", url: "" },
        );
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sha: "abc", url: "...", tree: treeItems, truncated }),
        headers: new Headers(),
      } as Response);
    }

    function mockSkillRawDownload() {
      // fetchSkillFromTree downloads each file from raw.githubusercontent.com
      mockFetch
        .mockResolvedValueOnce(mockFileContent("---\ndescription: Skill\n---\n# Skill"))
        .mockResolvedValueOnce(mockFileContent("export function helper() {}"));
    }

    it("should scan and download all skills from bare repo URL", async () => {
      mockRepoApiResponse();
      mockTreeScanResponse([".claude/skills/skill-a", ".claude/skills/skill-b"]);
      mockSkillRawDownload();
      mockSkillRawDownload();

      await downloadSkill({
        url: repoUrl,
        global: false,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const skillA = await readFile(join(tempDir, ".claude/skills/skill-a/SKILL.md"), "utf-8");
      expect(skillA).toContain("_from:");
      expect(skillA).toContain("owner/repo");

      const skillB = await readFile(join(tempDir, ".claude/skills/skill-b/SKILL.md"), "utf-8");
      expect(skillB).toContain("_from:");

      const output = consoleOutput.join("\n");
      expect(output).toContain("4 files created");
      expect(output).toContain("2 skills created");
    });

    it("should use ref from tree URL instead of fetching default branch", async () => {
      // No fetchDefaultBranch call — tree URL already has ref
      mockTreeScanResponse(["skills/my-skill"]);
      mockSkillRawDownload();

      await downloadSkill({
        url: repoTreeUrl,
        global: false,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("2 files created");
      expect(output).toContain("1 skill created");
    });

    it("should throw when no skills found in repo", async () => {
      mockRepoApiResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sha: "abc",
          url: "...",
          tree: [{ path: "README.md", type: "blob", mode: "100644", sha: "s1", url: "" }],
          truncated: false,
        }),
        headers: new Headers(),
      } as Response);

      await expect(
        downloadSkill({ url: repoUrl, global: false, noop: false, verbose: false, gitRoot: tempDir }),
      ).rejects.toThrow("No skills found");
    });

    it("should warn when tree is truncated", async () => {
      mockRepoApiResponse();
      mockTreeScanResponse(["skills/a"], true);
      mockSkillRawDownload();

      await downloadSkill({
        url: repoUrl,
        global: false,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("truncated");
    });

    it("should work in noop mode", async () => {
      mockRepoApiResponse();
      mockTreeScanResponse(["skills/a"]);
      mockSkillRawDownload();

      await downloadSkill({
        url: repoUrl,
        global: false,
        noop: true,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("would create");
      expect(output).toContain("Dry run complete");
    });

    it("should place skills in agent directory when destination is specified", async () => {
      mockRepoApiResponse();
      mockTreeScanResponse([".claude/skills/skill-a"]);
      mockSkillRawDownload();

      await downloadSkill({
        url: repoUrl,
        destination: "gemini",
        global: false,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
        customDirs: { gemini: tempDir },
      });

      const skillMd = await readFile(join(tempDir, "skills/skill-a/SKILL.md"), "utf-8");
      expect(skillMd).toContain("description: Skill");
    });

    it("should continue downloading when one skill fails", async () => {
      mockRepoApiResponse();
      mockTreeScanResponse(["skills/bad-skill", "skills/good-skill"]);
      // bad-skill: 404 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
      } as Response);
      // good-skill: success
      mockSkillRawDownload();

      await downloadSkill({
        url: repoUrl,
        global: false,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const output = consoleOutput.join("\n");
      expect(output).toContain("Skipped");

      const goodSkill = await readFile(join(tempDir, "skills/good-skill/SKILL.md"), "utf-8");
      expect(goodSkill).toContain("description: Skill");
    });

    it("should inject owner/repo provenance format", async () => {
      mockRepoApiResponse();
      mockTreeScanResponse([".claude/skills/skill-a"]);
      mockSkillRawDownload();

      await downloadSkill({
        url: repoUrl,
        global: false,
        noop: false,
        verbose: false,
        gitRoot: tempDir,
      });

      const skillMd = await readFile(join(tempDir, ".claude/skills/skill-a/SKILL.md"), "utf-8");
      expect(skillMd).toContain("_from:");
      expect(skillMd).toContain("owner/repo");
      expect(skillMd).not.toContain("https://github.com");
    });
  });
});
