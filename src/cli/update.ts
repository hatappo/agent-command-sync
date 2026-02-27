import { promises as fs } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import matter from "gray-matter";
import picocolors from "picocolors";
import { AGENT_REGISTRY } from "../agents/registry.js";
import { PRODUCT_TYPES, type ProductType } from "../types/intermediate.js";
import { SKILL_CONSTANTS } from "../utils/constants.js";
import { type DirResolutionContext, fileExists, findAgentSkills, readFile } from "../utils/file-utils.js";
import { fetchDefaultBranch, fetchSkillFromTree, scanRepositoryForSkills } from "../utils/github-utils.js";
import { formatFromValue, injectFromUrl, writeDownloadedFile } from "./download.js";

// ── Types ───────────────────────────────────────────────────────

export interface UpdateOptions {
  skillPath?: string;
  noop: boolean;
  global: boolean;
  verbose: boolean;
  gitRoot?: string | null;
  customDirs?: Partial<Record<ProductType, string>>;
}

interface LocalSkillInfo {
  skillDir: string;
  skillName: string;
  ownerRepo: string;
  localTreeHash: string; // "" = no hash (legacy) → always mismatches remote → force download
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Parse _from value: "owner/repo@treeHash" or "owner/repo".
 * Accepts any hex string after @ (not just 40-char) to handle truncated or
 * non-standard hashes gracefully — they simply won't match the remote hash
 * and will trigger a re-download.
 * When no tree hash is present, returns "" so it always mismatches remote hash.
 */
export function parseFromValue(from: string): { ownerRepo: string; treeHash: string } {
  const atIndex = from.lastIndexOf("@");
  if (atIndex > 0) {
    const candidate = from.slice(atIndex + 1);
    if (/^[0-9a-f]+$/.test(candidate)) {
      return { ownerRepo: from.slice(0, atIndex), treeHash: candidate };
    }
  }
  return { ownerRepo: from, treeHash: "" };
}

/**
 * Read a skill directory's SKILL.md and extract _from provenance info.
 */
async function readSkillFrom(skillDir: string): Promise<LocalSkillInfo | null> {
  try {
    const skillMdPath = join(skillDir, SKILL_CONSTANTS.SKILL_FILE_NAME);
    const content = await readFile(skillMdPath);
    const parsed = matter(content);

    const fromValue = parsed.data._from;
    if (!fromValue || typeof fromValue !== "string") return null;

    const { ownerRepo, treeHash } = parseFromValue(fromValue);

    return {
      skillDir,
      skillName: basename(skillDir),
      ownerRepo,
      localTreeHash: treeHash,
    };
  } catch {
    return null;
  }
}

/**
 * Find skill directories under a given path.
 * If the path itself is a skill directory (contains SKILL.md), return it.
 * Otherwise, scan its immediate subdirectories for skill directories.
 */
async function findSkillsUnderPath(dirPath: string): Promise<string[]> {
  // Check if dirPath itself is a skill directory
  if (await fileExists(join(dirPath, SKILL_CONSTANTS.SKILL_FILE_NAME))) {
    return [dirPath];
  }

  // Scan immediate subdirectories for skill directories
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = join(dirPath, entry.name);
      if (await fileExists(join(subDir, SKILL_CONSTANTS.SKILL_FILE_NAME))) {
        results.push(subDir);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return results.sort();
}

/**
 * Scan all agent skill directories for skills with _from provenance.
 */
async function scanAgentSkillDirs(options: UpdateOptions): Promise<LocalSkillInfo[]> {
  const results: LocalSkillInfo[] = [];
  for (const agentName of PRODUCT_TYPES) {
    const agent = AGENT_REGISTRY[agentName];
    const context: DirResolutionContext = {
      customDir: options.customDirs?.[agentName],
      gitRoot: options.gitRoot,
      global: options.global,
    };
    const skillDirs = await findAgentSkills(agent, undefined, context);
    for (const dir of skillDirs) {
      const info = await readSkillFrom(dir);
      if (info) results.push(info);
    }
  }
  return results;
}

/**
 * Discover local skills that have _from provenance.
 * - With skillPath: scan the specified directory for skills
 * - Without skillPath: scan all agent skill directories
 */
async function discoverLocalSkills(options: UpdateOptions): Promise<LocalSkillInfo[]> {
  if (options.skillPath) {
    // Resolve path relative to gitRoot (or cwd)
    const baseDir = options.gitRoot ?? process.cwd();
    const resolvedPath = resolve(baseDir, options.skillPath);

    const skillDirs = await findSkillsUnderPath(resolvedPath);
    const results: LocalSkillInfo[] = [];
    for (const dir of skillDirs) {
      const info = await readSkillFrom(dir);
      if (info) results.push(info);
    }
    return results;
  }

  // No path specified: scan all agent directories
  return scanAgentSkillDirs(options);
}

function getDisplayPath(skill: LocalSkillInfo, options: UpdateOptions): string {
  const baseDir = options.gitRoot && !options.global ? options.gitRoot : process.cwd();
  return relative(baseDir, skill.skillDir);
}

// ── Main ────────────────────────────────────────────────────────

/**
 * Check for and apply upstream updates to downloaded skills.
 */
export async function updateSkills(options: UpdateOptions): Promise<void> {
  const dryRunLabel = options.noop ? picocolors.dim(" (dry run)") : "";
  console.log(`\nChecking for skill updates...${dryRunLabel}`);

  // 1. Discover local skills with _from
  const localSkills = await discoverLocalSkills(options);

  if (localSkills.length === 0) {
    if (options.skillPath) {
      console.log(`\nNo skills with _from provenance found under "${options.skillPath}".`);
    } else {
      console.log("\nNo skills with _from provenance found.");
    }
    return;
  }

  if (options.verbose) {
    console.log(`DEBUG: Found ${localSkills.length} skill(s) with _from provenance`);
  }

  // 2. Group by owner/repo
  const byRepo = new Map<string, LocalSkillInfo[]>();
  for (const skill of localSkills) {
    const existing = byRepo.get(skill.ownerRepo) ?? [];
    existing.push(skill);
    byRepo.set(skill.ownerRepo, existing);
  }

  // 3. Process each repo
  const token = process.env.GITHUB_TOKEN;
  const stats = { updated: 0, upToDate: 0, notFound: 0, error: 0 };

  for (const [ownerRepo, skills] of byRepo) {
    const [owner, repo] = ownerRepo.split("/");

    console.log(`\n  ${picocolors.cyan(ownerRepo)}:`);

    try {
      const defaultBranch = await fetchDefaultBranch(owner, repo, token);

      if (options.verbose) {
        console.log(`  DEBUG: Default branch: ${defaultBranch}`);
      }

      const { skills: remoteSkills, truncated } = await scanRepositoryForSkills(owner, repo, defaultBranch, token);

      if (truncated) {
        console.log(picocolors.yellow("    Warning: Repository tree was truncated. Some skills may not be found."));
      }

      if (options.verbose) {
        console.log(
          `  DEBUG: Found ${remoteSkills.length} remote skill(s): ${remoteSkills.map((s) => s.name).join(", ")}`,
        );
      }

      for (const local of skills) {
        const remote = remoteSkills.find((s) => s.name === local.skillName);
        const displayPath = getDisplayPath(local, options);

        if (!remote) {
          console.log(
            `    ${picocolors.gray("[?]")} ${local.skillName} ${picocolors.dim(`(${displayPath})`)} - ${picocolors.gray("Not found in remote")}`,
          );
          stats.notFound++;
          continue;
        }

        // Compare tree hashes
        const remoteHash = remote.treeHash ?? "";
        if (local.localTreeHash !== "" && local.localTreeHash === remoteHash) {
          console.log(
            `    ${picocolors.blue("[=]")} ${local.skillName} ${picocolors.dim(`(${displayPath})`)} - ${picocolors.blue("No upstream changes")}`,
          );
          stats.upToDate++;
          continue;
        }

        // Need update
        if (options.noop) {
          console.log(
            `    ${picocolors.yellow("[M]")} ${local.skillName} ${picocolors.dim(`(${displayPath})`)} - ${picocolors.yellow("Update available")}`,
          );
          stats.updated++;
          continue;
        }

        // Download and update
        try {
          const files = await fetchSkillFromTree(owner, repo, defaultBranch, remote);

          // Inject updated _from with new tree hash
          const fromValue = formatFromValue(ownerRepo, remote.treeHash);
          for (const file of files) {
            if (file.relativePath === SKILL_CONSTANTS.SKILL_FILE_NAME && typeof file.content === "string") {
              file.content = injectFromUrl(file.content, fromValue);
            }
          }

          // Write files
          for (const file of files) {
            const filePath = join(local.skillDir, file.relativePath);
            await writeDownloadedFile(filePath, file);
          }

          console.log(
            `    ${picocolors.yellow("[M]")} ${local.skillName} ${picocolors.dim(`(${displayPath})`)} - ${picocolors.yellow("Updated")}`,
          );
          stats.updated++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(
            `    ${picocolors.red("[!]")} ${local.skillName} ${picocolors.dim(`(${displayPath})`)} - ${picocolors.red(`Error: ${message}`)}`,
          );
          stats.error++;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`    ${picocolors.red("[!]")} ${picocolors.red(`Error: ${message}`)}`);
      stats.error += skills.length;
    }
  }

  // 4. Summary
  console.log("");
  const parts: string[] = [];
  if (options.noop) {
    if (stats.updated > 0)
      parts.push(picocolors.yellow(`${stats.updated} update${stats.updated !== 1 ? "s" : ""} available`));
    if (stats.upToDate > 0) parts.push(picocolors.blue(`${stats.upToDate} unchanged`));
    if (stats.notFound > 0) parts.push(picocolors.gray(`${stats.notFound} not found`));
    if (stats.error > 0) parts.push(picocolors.red(`${stats.error} error${stats.error !== 1 ? "s" : ""}`));
    if (parts.length > 0) console.log(`${parts.join(", ")}.`);
    console.log(picocolors.dim("Dry run complete. Use without --noop to update."));
  } else {
    if (stats.updated > 0)
      parts.push(picocolors.yellow(`${stats.updated} skill${stats.updated !== 1 ? "s" : ""} updated`));
    if (stats.upToDate > 0) parts.push(picocolors.blue(`${stats.upToDate} unchanged`));
    if (stats.notFound > 0) parts.push(picocolors.gray(`${stats.notFound} not found`));
    if (stats.error > 0) parts.push(picocolors.red(`${stats.error} error${stats.error !== 1 ? "s" : ""}`));
    if (parts.length > 0) console.log(`Done! ${parts.join(", ")}.`);
  }
}
