/**
 * Git repository utilities
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join, parse } from "node:path";

/**
 * Find git repository root by walking up from startDir (or cwd).
 * Pure Node.js implementation — no git binary dependency.
 * Handles both normal repos (.git directory) and worktrees/submodules (.git file).
 * Returns null if not inside a git repository.
 */
export async function findGitRoot(startDir?: string): Promise<string | null> {
  let current = startDir ?? process.cwd();
  const { root } = parse(current);

  while (true) {
    try {
      const gitPath = join(current, ".git");
      const stats = await stat(gitPath);
      if (stats.isDirectory() || stats.isFile()) {
        return current;
      }
    } catch {
      // .git not found at this level, continue walking up
    }

    if (current === root) break;
    current = dirname(current);
  }

  return null;
}

/**
 * Resolve the actual .git directory path.
 * Handles worktrees/submodules where .git is a file containing "gitdir: <path>".
 */
export async function resolveGitDir(gitRoot: string): Promise<string | null> {
  const gitPath = join(gitRoot, ".git");
  try {
    const stats = await stat(gitPath);
    if (stats.isDirectory()) {
      return gitPath;
    }
    if (stats.isFile()) {
      const content = await readFile(gitPath, "utf-8");
      const match = content.match(/^gitdir:\s*(.+)/);
      if (match) {
        const gitdir = match[1].trim();
        // Resolve relative paths
        return gitdir.startsWith("/") ? gitdir : join(gitRoot, gitdir);
      }
    }
  } catch {
    // .git not found
  }
  return null;
}

/**
 * Get the current branch name from .git/HEAD.
 * Returns the branch name for normal refs, or a short SHA for detached HEAD.
 * Returns null if not in a git repository.
 */
export async function getCurrentBranch(gitRoot: string): Promise<string | null> {
  const gitDir = await resolveGitDir(gitRoot);
  if (!gitDir) return null;

  let head: string;
  try {
    head = await readFile(join(gitDir, "HEAD"), "utf-8");
  } catch {
    return null;
  }

  const refMatch = head.trim().match(/^ref: refs\/heads\/(.+)$/);
  if (refMatch) return refMatch[1];

  // Detached HEAD: return short SHA
  const sha = head.trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha.slice(0, 7) : null;
}

/**
 * Parse .git/config to extract the origin remote URL.
 * If the origin points to github.com, normalizes to HTTPS repository URL.
 * Returns null for non-GitHub remotes or if no origin is found.
 *
 * Normalization:
 * - `git@github.com:owner/repo.git` → `https://github.com/owner/repo`
 * - `https://github.com/owner/repo.git` → `https://github.com/owner/repo`
 */
export async function getGitHubRemoteUrl(gitRoot: string): Promise<string | null> {
  const gitDir = await resolveGitDir(gitRoot);
  if (!gitDir) return null;

  let configContent: string;
  try {
    configContent = await readFile(join(gitDir, "config"), "utf-8");
  } catch {
    return null;
  }

  // Parse .git/config for [remote "origin"] section
  const originUrl = parseOriginUrl(configContent);
  if (!originUrl) return null;

  return normalizeGitHubUrl(originUrl);
}

/**
 * Extract the URL from [remote "origin"] section in git config.
 */
function parseOriginUrl(configContent: string): string | null {
  const lines = configContent.split("\n");
  let inOriginSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[")) {
      inOriginSection = /^\[remote\s+"origin"\]$/i.test(trimmed);
      continue;
    }

    if (inOriginSection) {
      const match = trimmed.match(/^url\s*=\s*(.+)$/);
      if (match) {
        return match[1].trim();
      }
    }
  }

  return null;
}

/**
 * Normalize a git remote URL to HTTPS GitHub URL.
 * Returns null if the URL is not a GitHub URL.
 */
function normalizeGitHubUrl(url: string): string | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}`;
  }

  // HTTPS format: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = url.match(/^https?:\/\/github\.com\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return `https://github.com/${httpsMatch[1]}`;
  }

  return null;
}
