/**
 * Skill-specific utility functions
 */

import { readdir, stat } from "node:fs/promises";
import { extname, join, basename } from "node:path";
import type { SupportFile } from "../types/skill.js";
import { BINARY_EXTENSIONS, CONFIG_FILES, SKILL_CONSTANTS } from "./constants.js";

/**
 * Classify a file based on its extension and name
 */
export function classifySupportFile(relativePath: string): SupportFile["type"] {
  const ext = extname(relativePath).toLowerCase();
  const filename = basename(relativePath);

  if (BINARY_EXTENSIONS.includes(ext as (typeof BINARY_EXTENSIONS)[number])) {
    return "binary";
  }
  if (CONFIG_FILES.includes(filename as (typeof CONFIG_FILES)[number])) {
    return "config";
  }
  return "text";
}

/**
 * Collect support files from a skill directory
 */
export async function collectSupportFiles(
  skillDir: string,
  excludePatterns: string[] = [SKILL_CONSTANTS.SKILL_FILE_NAME],
): Promise<SupportFile[]> {
  const supportFiles: SupportFile[] = [];

  async function walk(dir: string, prefix = ""): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = prefix ? join(prefix, entry.name) : entry.name;
      const fullPath = join(dir, entry.name);

      // Skip excluded patterns
      if (excludePatterns.some((p) => relativePath.includes(p) || entry.name === p)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
      } else if (entry.isFile()) {
        const type = classifySupportFile(relativePath);
        supportFiles.push({
          relativePath,
          type,
          // Content will be loaded later if needed
        });
      }
    }
  }

  await walk(skillDir);
  return supportFiles;
}

/**
 * Check if a directory is a valid skill directory
 */
export async function isSkillDirectory(dirPath: string): Promise<boolean> {
  const skillFilePath = join(dirPath, SKILL_CONSTANTS.SKILL_FILE_NAME);
  try {
    const stats = await stat(skillFilePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Find all skill directories in a given path
 */
export async function findSkillDirectories(basePath: string): Promise<string[]> {
  const skillDirs: string[] = [];

  try {
    const entries = await readdir(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = join(basePath, entry.name);
        if (await isSkillDirectory(dirPath)) {
          skillDirs.push(dirPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skillDirs;
}

/**
 * Get skill name from directory path
 */
export function getSkillName(dirPath: string): string {
  return basename(dirPath);
}
