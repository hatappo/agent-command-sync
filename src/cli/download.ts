import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import picocolors from "picocolors";
import { AGENT_REGISTRY } from "../agents/registry.js";
import type { ProductType } from "../types/intermediate.js";
import { type DirResolutionContext, ensureDirectory, fileExists, readFile, resolveSkillDir } from "../utils/file-utils.js";
import {
  type DownloadedFile,
  type ParsedGitHubUrl,
  extractSkillName,
  fetchSkillDirectory,
  parseGitHubUrl,
} from "../utils/github-utils.js";

// ── Types ───────────────────────────────────────────────────────

export interface DownloadOptions {
  url: string;
  destination?: ProductType;
  global: boolean;
  githubToken?: string;
  noop: boolean;
  verbose: boolean;
  gitRoot?: string | null;
  customDirs?: Partial<Record<ProductType, string>>;
}

// ── Operation display ───────────────────────────────────────────

type OperationType = "A" | "M" | "=";

const operationStyles = {
  A: { prefix: picocolors.green("[A]"), color: picocolors.green },
  M: { prefix: picocolors.yellow("[M]"), color: picocolors.yellow },
  "=": { prefix: picocolors.blue("[=]"), color: picocolors.blue },
} as const;

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Determine the base directory for downloaded files.
 * - With -d: use resolveSkillDir for the agent
 * - Without -d: use gitRoot (project) or homedir (global)
 */
function resolveTargetDir(parsed: ParsedGitHubUrl, options: DownloadOptions): string {
  if (options.destination) {
    const agent = AGENT_REGISTRY[options.destination];
    const context: DirResolutionContext = {
      customDir: options.customDirs?.[options.destination],
      gitRoot: options.gitRoot,
      global: options.global,
    };
    const skillDir = resolveSkillDir(agent, context);
    const skillName = extractSkillName(parsed);
    return join(skillDir, skillName);
  }

  // Default: use URL path as-is relative to base directory
  const baseDir = options.gitRoot && !options.global ? options.gitRoot : homedir();
  return join(baseDir, parsed.path);
}

/**
 * Get the mode label for display
 */
function getModeLabel(options: DownloadOptions): string {
  if (options.gitRoot && !options.global) {
    return `[project: ${options.gitRoot}]`;
  }
  return "[global]";
}

/**
 * Determine the operation type for a file
 */
async function determineOperation(
  filePath: string,
  newContent: string | Buffer,
): Promise<OperationType> {
  if (!(await fileExists(filePath))) {
    return "A";
  }

  // Compare content
  try {
    if (Buffer.isBuffer(newContent)) {
      const existing = await fs.readFile(filePath);
      return existing.equals(newContent) ? "=" : "M";
    }
    const existing = await readFile(filePath);
    return existing === newContent ? "=" : "M";
  } catch {
    return "M";
  }
}

/**
 * Write a single downloaded file to disk
 */
async function writeDownloadedFile(filePath: string, file: DownloadedFile): Promise<void> {
  await ensureDirectory(dirname(filePath));
  if (Buffer.isBuffer(file.content)) {
    await fs.writeFile(filePath, file.content);
  } else {
    await fs.writeFile(filePath, file.content, "utf-8");
  }
}

// ── Main ────────────────────────────────────────────────────────

/**
 * Download a skill from GitHub and place it locally.
 */
export async function downloadSkill(options: DownloadOptions): Promise<void> {
  // 0. Validate: -g requires -d
  if (options.global && !options.destination) {
    throw new Error("acs download with -g/--global requires -d/--dest <agent>.\nExample: acs download <url> -g -d claude");
  }

  // 1. Parse URL
  const parsed = parseGitHubUrl(options.url);

  if (options.verbose) {
    console.log("DEBUG: Parsed URL:", parsed);
  }

  // 2. Header
  const modeLabel = getModeLabel(options);
  const dryRunLabel = options.noop ? picocolors.dim(" (dry run)") : "";
  console.log(
    `\nDownloading skill from ${picocolors.cyan(`github.com/${parsed.owner}/${parsed.repo}`)}... ${picocolors.dim(modeLabel)}${dryRunLabel}`,
  );

  // 3. Fetch files from GitHub
  const files = await fetchSkillDirectory(parsed, options.githubToken);

  if (options.verbose) {
    console.log(`DEBUG: Fetched ${files.length} files`);
  }

  // 4. Determine target directory
  const targetDir = resolveTargetDir(parsed, options);

  if (options.verbose) {
    console.log(`DEBUG: Target directory: ${targetDir}`);
  }

  // 5. Write files and display results
  const stats = { A: 0, M: 0, "=": 0 };

  for (const file of files) {
    const filePath = join(targetDir, file.relativePath);
    const op = await determineOperation(filePath, file.content);
    stats[op]++;

    const style = operationStyles[op];
    // Display path relative to base directory for readability
    const displayBase = options.gitRoot && !options.global ? options.gitRoot : homedir();
    const displayPath = relative(displayBase, filePath);

    if (options.noop) {
      const label = op === "A" ? "(would create)" : op === "M" ? "(would update)" : "(unchanged)";
      console.log(`  ${style.prefix} ${displayPath}  ${picocolors.dim(label)}`);
    } else {
      if (op !== "=") {
        await writeDownloadedFile(filePath, file);
      }
      const label = op === "A" ? "Created" : op === "M" ? "Updated" : "Unchanged";
      console.log(`  ${style.prefix} ${displayPath} - ${style.color(label)}`);
    }
  }

  // 6. Summary
  console.log("");
  if (options.noop) {
    console.log(picocolors.dim("Dry run complete. Use without --noop to download."));
  } else {
    const downloaded = stats.A + stats.M;
    const parts: string[] = [];
    if (stats.A > 0) parts.push(picocolors.green(`${stats.A} created`));
    if (stats.M > 0) parts.push(picocolors.yellow(`${stats.M} updated`));
    if (stats["="] > 0) parts.push(picocolors.blue(`${stats["="]} unchanged`));
    console.log(`Done! ${parts.join(", ")}.`);
  }
}
