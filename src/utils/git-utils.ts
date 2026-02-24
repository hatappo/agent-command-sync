/**
 * Git repository utilities
 */

import { stat } from "node:fs/promises";
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
