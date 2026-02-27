import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DownloadedFile,
  type GitHubContentItem,
  type ParsedGitHubUrl,
  extractSkillName,
  fetchDefaultBranch,
  fetchSkillDirectory,
  parseGitHubUrl,
  scanRepositoryForSkills,
  tryParseRepoUrl,
} from "../../src/utils/github-utils.js";

describe("github-utils", () => {
  describe("parseGitHubUrl", () => {
    it("should parse a standard tree URL", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/tree/main/.claude/skills/my-skill");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: "main",
        path: ".claude/skills/my-skill",
      });
    });

    it("should parse a blob URL pointing to SKILL.md and use parent directory", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/blob/main/.claude/skills/my-skill/SKILL.md");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: "main",
        path: ".claude/skills/my-skill",
      });
    });

    it("should parse a tree URL pointing to SKILL.md and use parent directory", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/tree/main/.claude/skills/my-skill/SKILL.md");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: "main",
        path: ".claude/skills/my-skill",
      });
    });

    it("should handle tag refs", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/tree/v1.0.0/.claude/skills/my-skill");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: "v1.0.0",
        path: ".claude/skills/my-skill",
      });
    });

    it("should handle deep paths", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/tree/main/deep/nested/path/skills/my-skill");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: "main",
        path: "deep/nested/path/skills/my-skill",
      });
    });

    it("should strip trailing slashes", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/tree/main/.claude/skills/my-skill/");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        ref: "main",
        path: ".claude/skills/my-skill",
      });
    });

    it("should throw for non-GitHub URLs", () => {
      expect(() => parseGitHubUrl("https://gitlab.com/owner/repo/tree/main/path")).toThrow("Only GitHub URLs");
    });

    it("should throw for invalid URLs", () => {
      expect(() => parseGitHubUrl("not-a-url")).toThrow("Invalid URL");
    });

    it("should throw for bare repository URLs", () => {
      expect(() => parseGitHubUrl("https://github.com/owner/repo")).toThrow("expected /tree/ or /blob/");
    });

    it("should throw for URLs without path", () => {
      expect(() => parseGitHubUrl("https://github.com/owner/repo/tree/main")).toThrow("missing path");
    });

    it("should throw for URLs with missing owner/repo", () => {
      expect(() => parseGitHubUrl("https://github.com/owner")).toThrow("missing owner/repo");
    });

    it("should throw when SKILL.md is at repository root", () => {
      expect(() => parseGitHubUrl("https://github.com/owner/repo/blob/main/SKILL.md")).toThrow(
        "cannot be at repository root",
      );
    });
  });

  describe("extractSkillName", () => {
    it("should extract the last path segment", () => {
      const parsed: ParsedGitHubUrl = { owner: "o", repo: "r", ref: "main", path: ".claude/skills/my-skill" };
      expect(extractSkillName(parsed)).toBe("my-skill");
    });

    it("should handle single-segment paths", () => {
      const parsed: ParsedGitHubUrl = { owner: "o", repo: "r", ref: "main", path: "my-skill" };
      expect(extractSkillName(parsed)).toBe("my-skill");
    });

    it("should handle deeply nested paths", () => {
      const parsed: ParsedGitHubUrl = { owner: "o", repo: "r", ref: "main", path: "a/b/c/skill-name" };
      expect(extractSkillName(parsed)).toBe("skill-name");
    });
  });

  describe("fetchSkillDirectory", () => {
    let originalFetch: typeof globalThis.fetch;
    let mockFetch: Mock;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      mockFetch = vi.fn();
      globalThis.fetch = mockFetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    const parsed: ParsedGitHubUrl = {
      owner: "owner",
      repo: "repo",
      ref: "main",
      path: ".claude/skills/my-skill",
    };

    function mockDirectoryResponse(items: Partial<GitHubContentItem>[]): Response {
      return {
        ok: true,
        status: 200,
        json: async () =>
          items.map((item) => ({
            name: item.name ?? "file.txt",
            path: item.path ?? `${parsed.path}/${item.name}`,
            type: item.type ?? "file",
            size: item.size ?? 100,
            sha: item.sha ?? "abc123",
            download_url:
              item.download_url ?? `https://raw.githubusercontent.com/owner/repo/main/${parsed.path}/${item.name}`,
            ...item,
          })),
        headers: new Headers(),
      } as Response;
    }

    function mockFileResponse(content: string): Response {
      return {
        ok: true,
        status: 200,
        text: async () => content,
        arrayBuffer: async () => new TextEncoder().encode(content).buffer,
        headers: new Headers(),
      } as Response;
    }

    it("should fetch a skill directory with SKILL.md and support files", async () => {
      mockFetch
        // First call: directory listing
        .mockResolvedValueOnce(
          mockDirectoryResponse([
            { name: "SKILL.md", type: "file" },
            { name: "helper.ts", type: "file" },
          ]),
        )
        // Second call: SKILL.md content
        .mockResolvedValueOnce(mockFileResponse("# My Skill\nDescription here"))
        // Third call: helper.ts content
        .mockResolvedValueOnce(mockFileResponse("export function helper() {}"));

      const files = await fetchSkillDirectory(parsed);

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        relativePath: "SKILL.md",
        content: "# My Skill\nDescription here",
        isBinary: false,
      });
      expect(files[1]).toEqual({
        relativePath: "helper.ts",
        content: "export function helper() {}",
        isBinary: false,
      });
    });

    it("should recursively fetch subdirectories", async () => {
      mockFetch
        // Root directory listing
        .mockResolvedValueOnce(
          mockDirectoryResponse([
            { name: "SKILL.md", type: "file" },
            { name: "subdir", type: "dir", path: `${parsed.path}/subdir`, download_url: null },
          ]),
        )
        // SKILL.md content
        .mockResolvedValueOnce(mockFileResponse("# Skill"))
        // Subdirectory listing
        .mockResolvedValueOnce(
          mockDirectoryResponse([{ name: "nested.ts", type: "file", path: `${parsed.path}/subdir/nested.ts` }]),
        )
        // nested.ts content
        .mockResolvedValueOnce(mockFileResponse("nested content"));

      const files = await fetchSkillDirectory(parsed);

      expect(files).toHaveLength(2);
      expect(files[0].relativePath).toBe("SKILL.md");
      expect(files[1].relativePath).toBe("subdir/nested.ts");
      expect(files[1].content).toBe("nested content");
    });

    it("should handle binary files", async () => {
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header

      mockFetch
        .mockResolvedValueOnce(
          mockDirectoryResponse([
            { name: "SKILL.md", type: "file" },
            { name: "image.png", type: "file" },
          ]),
        )
        .mockResolvedValueOnce(mockFileResponse("# Skill"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => binaryData.buffer,
          headers: new Headers(),
        } as Response);

      const files = await fetchSkillDirectory(parsed);

      expect(files).toHaveLength(2);
      expect(files[1].relativePath).toBe("image.png");
      expect(files[1].isBinary).toBe(true);
      expect(Buffer.isBuffer(files[1].content)).toBe(true);
    });

    it("should throw when SKILL.md is not found", async () => {
      mockFetch.mockResolvedValueOnce(
        mockDirectoryResponse([
          { name: "README.md", type: "file" },
          { name: "helper.ts", type: "file" },
        ]),
      );

      // Mock file downloads (needed before the SKILL.md check)
      mockFetch.mockResolvedValueOnce(mockFileResponse("readme")).mockResolvedValueOnce(mockFileResponse("helper"));

      await expect(fetchSkillDirectory(parsed)).rejects.toThrow("SKILL.md not found");
    });

    it("should throw on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
      } as Response);

      await expect(fetchSkillDirectory(parsed)).rejects.toThrow("Not found");
    });

    it("should throw with helpful message on rate limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers({ "X-RateLimit-Remaining": "0" }),
      } as Response);

      await expect(fetchSkillDirectory(parsed)).rejects.toThrow("rate limit exceeded");
    });

    it("should throw on 403 without rate limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: new Headers(),
      } as Response);

      await expect(fetchSkillDirectory(parsed)).rejects.toThrow("Access denied");
    });

    it("should include Authorization header when token is provided", async () => {
      mockFetch
        .mockResolvedValueOnce(mockDirectoryResponse([{ name: "SKILL.md", type: "file" }]))
        .mockResolvedValueOnce(mockFileResponse("# Skill"));

      await fetchSkillDirectory(parsed, "my-token");

      // First call should have Authorization header
      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[1].headers.Authorization).toBe("token my-token");
    });

    it("should not include Authorization header when no token is provided", async () => {
      mockFetch
        .mockResolvedValueOnce(mockDirectoryResponse([{ name: "SKILL.md", type: "file" }]))
        .mockResolvedValueOnce(mockFileResponse("# Skill"));

      await fetchSkillDirectory(parsed);

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[1].headers.Authorization).toBeUndefined();
    });

    it("should handle large files via Blobs API when download_url is null", async () => {
      const base64Content = Buffer.from("large file content").toString("base64");

      mockFetch
        .mockResolvedValueOnce(
          mockDirectoryResponse([
            { name: "SKILL.md", type: "file" },
            { name: "large.txt", type: "file", download_url: null, sha: "blob-sha-123" },
          ]),
        )
        .mockResolvedValueOnce(mockFileResponse("# Skill"))
        // Blob API response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ content: base64Content, encoding: "base64" }),
          headers: new Headers(),
        } as Response);

      const files = await fetchSkillDirectory(parsed);

      expect(files).toHaveLength(2);
      expect(files[1].relativePath).toBe("large.txt");
      expect(files[1].content).toBe("large file content");
      expect(files[1].isBinary).toBe(false);

      // Check that Blob API was called
      const blobCall = mockFetch.mock.calls[2];
      expect(blobCall[0]).toContain("/git/blobs/blob-sha-123");
    });
  });

  describe("tryParseRepoUrl", () => {
    it("should parse bare repo URL", () => {
      const result = tryParseRepoUrl("https://github.com/owner/repo");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: undefined });
    });

    it("should parse repo URL with trailing slash", () => {
      const result = tryParseRepoUrl("https://github.com/owner/repo/");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: undefined });
    });

    it("should parse tree root URL", () => {
      const result = tryParseRepoUrl("https://github.com/owner/repo/tree/main");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: "main" });
    });

    it("should parse tree root with tag ref", () => {
      const result = tryParseRepoUrl("https://github.com/owner/repo/tree/v2.0.0");
      expect(result).toEqual({ owner: "owner", repo: "repo", ref: "v2.0.0" });
    });

    it("should return null for specific-path URL", () => {
      expect(tryParseRepoUrl("https://github.com/owner/repo/tree/main/.claude/skills/my-skill")).toBeNull();
    });

    it("should return null for blob URL with path", () => {
      expect(tryParseRepoUrl("https://github.com/owner/repo/blob/main/SKILL.md")).toBeNull();
    });

    it("should return null for non-GitHub URL", () => {
      expect(tryParseRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
    });

    it("should return null for invalid URL", () => {
      expect(tryParseRepoUrl("not-a-url")).toBeNull();
    });

    it("should return null for URL with only owner", () => {
      expect(tryParseRepoUrl("https://github.com/owner")).toBeNull();
    });
  });

  describe("fetchDefaultBranch", () => {
    let originalFetch: typeof globalThis.fetch;
    let mockFetch: Mock;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      mockFetch = vi.fn();
      globalThis.fetch = mockFetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("should fetch the default branch name", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ default_branch: "main" }),
        headers: new Headers(),
      } as Response);

      const branch = await fetchDefaultBranch("owner", "repo");
      expect(branch).toBe("main");
      expect(mockFetch.mock.calls[0][0]).toBe("https://api.github.com/repos/owner/repo");
    });

    it("should pass token when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ default_branch: "develop" }),
        headers: new Headers(),
      } as Response);

      await fetchDefaultBranch("owner", "repo", "my-token");
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("token my-token");
    });

    it("should throw on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
      } as Response);

      await expect(fetchDefaultBranch("owner", "repo")).rejects.toThrow("Not found");
    });
  });

  describe("scanRepositoryForSkills", () => {
    let originalFetch: typeof globalThis.fetch;
    let mockFetch: Mock;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      mockFetch = vi.fn();
      globalThis.fetch = mockFetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("should find skills containing SKILL.md", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sha: "abc",
          url: "...",
          tree: [
            { path: ".claude/skills/my-skill/SKILL.md", type: "blob", mode: "100644", sha: "s1", url: "" },
            { path: ".claude/skills/my-skill/helper.ts", type: "blob", mode: "100644", sha: "s2", url: "" },
            { path: ".gemini/skills/other-skill/SKILL.md", type: "blob", mode: "100644", sha: "s3", url: "" },
            { path: "README.md", type: "blob", mode: "100644", sha: "s4", url: "" },
          ],
          truncated: false,
        }),
        headers: new Headers(),
      } as Response);

      const { skills, truncated } = await scanRepositoryForSkills("owner", "repo", "main");
      expect(truncated).toBe(false);
      expect(skills).toEqual([
        {
          path: ".claude/skills/my-skill",
          name: "my-skill",
          files: [".claude/skills/my-skill/SKILL.md", ".claude/skills/my-skill/helper.ts"],
        },
        {
          path: ".gemini/skills/other-skill",
          name: "other-skill",
          files: [".gemini/skills/other-skill/SKILL.md"],
        },
      ]);
    });

    it("should skip SKILL.md at repository root", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sha: "abc",
          url: "...",
          tree: [
            { path: "SKILL.md", type: "blob", mode: "100644", sha: "s1", url: "" },
            { path: "skills/valid-skill/SKILL.md", type: "blob", mode: "100644", sha: "s2", url: "" },
          ],
          truncated: false,
        }),
        headers: new Headers(),
      } as Response);

      const { skills } = await scanRepositoryForSkills("owner", "repo", "main");
      expect(skills).toEqual([
        { path: "skills/valid-skill", name: "valid-skill", files: ["skills/valid-skill/SKILL.md"] },
      ]);
    });

    it("should report truncated flag", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sha: "abc",
          url: "...",
          tree: [{ path: "skills/a/SKILL.md", type: "blob", mode: "100644", sha: "s1", url: "" }],
          truncated: true,
        }),
        headers: new Headers(),
      } as Response);

      const { skills, truncated } = await scanRepositoryForSkills("owner", "repo", "main");
      expect(truncated).toBe(true);
      expect(skills).toHaveLength(1);
    });

    it("should return empty array when no skills found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sha: "abc",
          url: "...",
          tree: [
            { path: "README.md", type: "blob", mode: "100644", sha: "s1", url: "" },
            { path: "src/index.ts", type: "blob", mode: "100644", sha: "s2", url: "" },
          ],
          truncated: false,
        }),
        headers: new Headers(),
      } as Response);

      const { skills } = await scanRepositoryForSkills("owner", "repo", "main");
      expect(skills).toEqual([]);
    });

    it("should pass token to API request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sha: "abc", url: "...", tree: [], truncated: false }),
        headers: new Headers(),
      } as Response);

      await scanRepositoryForSkills("owner", "repo", "main", "my-token");
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("token my-token");
    });

    it("should use correct API URL with recursive parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sha: "abc", url: "...", tree: [], truncated: false }),
        headers: new Headers(),
      } as Response);

      await scanRepositoryForSkills("owner", "repo", "v1.0.0");
      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://api.github.com/repos/owner/repo/git/trees/v1.0.0?recursive=1",
      );
    });
  });
});
