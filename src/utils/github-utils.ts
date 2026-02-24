import { extname } from "node:path";
import { BINARY_EXTENSIONS } from "./constants.js";

// ── Types ───────────────────────────────────────────────────────

/**
 * Parsed GitHub URL information
 */
export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

/**
 * GitHub Contents API response item
 */
export interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  sha: string;
  download_url: string | null;
}

/**
 * Downloaded file
 */
export interface DownloadedFile {
  relativePath: string;
  content: string | Buffer;
  isBinary: boolean;
}

// ── URL Parsing ─────────────────────────────────────────────────

/**
 * Parse a GitHub URL into owner, repo, ref, and path components.
 *
 * Supported formats:
 *   - https://github.com/{owner}/{repo}/tree/{ref}/{path}
 *   - https://github.com/{owner}/{repo}/blob/{ref}/{path}
 *
 * If the path ends with SKILL.md, the parent directory is used.
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.hostname !== "github.com") {
    throw new Error(`Only GitHub URLs are supported. Got: ${parsed.hostname}`);
  }

  // Remove leading slash and split
  const segments = parsed.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");

  if (segments.length < 2) {
    throw new Error(`Invalid GitHub URL: missing owner/repo. URL: ${url}`);
  }

  const [owner, repo, action, ref, ...pathParts] = segments;

  if (!action || (action !== "tree" && action !== "blob")) {
    throw new Error(
      `Invalid GitHub URL: expected /tree/ or /blob/ segment. URL: ${url}\nExample: https://github.com/owner/repo/tree/main/.claude/skills/my-skill`,
    );
  }

  if (!ref) {
    throw new Error(`Invalid GitHub URL: missing branch/tag reference. URL: ${url}`);
  }

  if (pathParts.length === 0) {
    throw new Error(
      `Invalid GitHub URL: missing path to skill directory. URL: ${url}\nExample: https://github.com/owner/repo/tree/main/.claude/skills/my-skill`,
    );
  }

  let path = pathParts.join("/");

  // If path ends with SKILL.md, use parent directory
  if (path.endsWith("SKILL.md")) {
    const parentParts = pathParts.slice(0, -1);
    if (parentParts.length === 0) {
      throw new Error(`Invalid GitHub URL: SKILL.md cannot be at repository root. URL: ${url}`);
    }
    path = parentParts.join("/");
  }

  return { owner, repo, ref, path };
}

/**
 * Extract skill name (last path segment) from a parsed GitHub URL
 */
export function extractSkillName(parsed: ParsedGitHubUrl): string {
  const segments = parsed.path.split("/");
  return segments[segments.length - 1];
}

// ── GitHub API ──────────────────────────────────────────────────

function isBinaryFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return (BINARY_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Make a request to the GitHub API
 */
async function githubApiRequest(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "agent-command-sync",
  };

  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 404) {
    throw new Error(`Not found: ${url}`);
  }

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
    if (rateLimitRemaining === "0") {
      throw new Error(
        "GitHub API rate limit exceeded. Set GITHUB_TOKEN env var for higher limits.",
      );
    }
    throw new Error("Access denied. For private repositories, set GITHUB_TOKEN env var.");
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

/**
 * Fetch a skill directory from GitHub, recursively downloading all files.
 *
 * @param parsed - Parsed GitHub URL
 * @param token - Optional GitHub personal access token
 * @returns Array of downloaded files with their relative paths
 * @throws Error if SKILL.md is not found, or on API errors
 */
export async function fetchSkillDirectory(parsed: ParsedGitHubUrl, token?: string): Promise<DownloadedFile[]> {
  const files: DownloadedFile[] = [];

  async function fetchDirectory(dirPath: string, relativeBase: string): Promise<void> {
    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${dirPath}?ref=${parsed.ref}`;
    const response = await githubApiRequest(apiUrl, token);
    const items: GitHubContentItem[] = await response.json();

    for (const item of items) {
      const relativePath = relativeBase ? `${relativeBase}/${item.name}` : item.name;

      if (item.type === "dir") {
        await fetchDirectory(item.path, relativePath);
      } else if (item.type === "file") {
        const binary = isBinaryFile(item.name);

        if (!item.download_url) {
          // For large files (>1MB), download_url may be null. Use Blobs API.
          const blobUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/blobs/${item.sha}`;
          const blobResponse = await githubApiRequest(blobUrl, token);
          const blob: { content: string; encoding: string } = await blobResponse.json();

          if (blob.encoding === "base64") {
            const buffer = Buffer.from(blob.content, "base64");
            files.push({
              relativePath,
              content: binary ? buffer : buffer.toString("utf-8"),
              isBinary: binary,
            });
          }
        } else {
          // Download from raw URL
          const fileResponse = await fetch(item.download_url);
          if (!fileResponse.ok) {
            throw new Error(`Failed to download ${item.name}: ${fileResponse.status} ${fileResponse.statusText}`);
          }

          if (binary) {
            const buffer = Buffer.from(await fileResponse.arrayBuffer());
            files.push({ relativePath, content: buffer, isBinary: true });
          } else {
            const text = await fileResponse.text();
            files.push({ relativePath, content: text, isBinary: false });
          }
        }
      }
    }
  }

  await fetchDirectory(parsed.path, "");

  // Validate that SKILL.md exists
  const hasSkillMd = files.some((f) => f.relativePath === "SKILL.md");
  if (!hasSkillMd) {
    throw new Error(
      `SKILL.md not found in ${parsed.path}. Make sure the URL points to a valid skill directory containing SKILL.md.`,
    );
  }

  return files;
}
