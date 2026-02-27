import { promises as fs } from "node:fs";
import { dirname, join, relative } from "node:path";
import matter from "gray-matter";
import picocolors from "picocolors";
import { AGENT_REGISTRY } from "../agents/registry.js";
import { SKILL_CONSTANTS } from "../utils/constants.js";
import type { ProductType } from "../types/intermediate.js";
import {
  type DirResolutionContext,
  ensureDirectory,
  fileExists,
  readFile,
  resolveSkillDir,
} from "../utils/file-utils.js";
import {
  type DiscoveredSkill,
  type DownloadedFile,
  type ParsedGitHubUrl,
  type ParsedRepoUrl,
  extractSkillName,
  fetchDefaultBranch,
  fetchSkillDirectory,
  fetchSkillFromTree,
  parseGitHubUrl,
  scanRepositoryForSkills,
  tryParseRepoUrl,
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
 * Resolve the base directory for download when no destination agent is specified.
 * - In a git repo: gitRoot (project-level)
 * - Outside a git repo: cwd
 */
function resolveDownloadBaseDir(options: DownloadOptions): string {
  return options.gitRoot && !options.global ? options.gitRoot : process.cwd();
}

/**
 * Determine the base directory for downloaded files.
 * - With [to]: use resolveSkillDir for the agent
 * - Without [to]: use gitRoot (project) or cwd
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

  return join(resolveDownloadBaseDir(options), parsed.path);
}

/**
 * Get the mode label for display
 */
function getModeLabel(options: DownloadOptions): string {
  if (options.gitRoot && !options.global) {
    return `[project: ${options.gitRoot}]`;
  }
  if (options.global) {
    return "[global]";
  }
  return "";
}

/**
 * Determine the operation type for a file
 */
async function determineOperation(filePath: string, newContent: string | Buffer): Promise<OperationType> {
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

/**
 * Inject _from provenance URL into a SKILL.md text content.
 * Parses frontmatter, appends URL to _from array, and re-serializes.
 */
function injectFromUrl(content: string, url: string): string {
  const parsed = matter(content);
  const fromArray: string[] = Array.isArray(parsed.data._from) ? [...parsed.data._from] : [];
  if (!fromArray.includes(url)) {
    fromArray.push(url);
  }
  parsed.data._from = fromArray;
  return matter.stringify(parsed.content, parsed.data);
}

/**
 * Determine the target directory for a skill discovered via repo scanning.
 */
function resolveTargetDirForRepoSkill(skill: DiscoveredSkill, options: DownloadOptions): string {
  if (options.destination) {
    const agent = AGENT_REGISTRY[options.destination];
    const context: DirResolutionContext = {
      customDir: options.customDirs?.[options.destination],
      gitRoot: options.gitRoot,
      global: options.global,
    };
    const skillDir = resolveSkillDir(agent, context);
    return join(skillDir, skill.name);
  }

  return join(resolveDownloadBaseDir(options), skill.path);
}

/**
 * Download all skills found in a repository.
 */
async function downloadMultipleSkills(
  repoUrl: ParsedRepoUrl & { ref: string },
  skills: DiscoveredSkill[],
  options: DownloadOptions,
): Promise<void> {
  const ref = repoUrl.ref;
  const modeLabel = getModeLabel(options);
  const dryRunLabel = options.noop ? picocolors.dim(" (dry run)") : "";
  console.log(
    `\nDownloading ${picocolors.bold(String(skills.length))} skills from ${picocolors.cyan(`github.com/${repoUrl.owner}/${repoUrl.repo}`)}... ${picocolors.dim(modeLabel)}${dryRunLabel}`,
  );

  const totalStats = { A: 0, M: 0, "=": 0 };
  const skillStats = { A: 0, M: 0, "=": 0 };

  for (const skill of skills) {
    const provenanceUrl = `https://github.com/${repoUrl.owner}/${repoUrl.repo}/tree/${ref}/${skill.path}`;

    try {
      // Use raw.githubusercontent.com to avoid API rate limits
      const files = await fetchSkillFromTree(repoUrl.owner, repoUrl.repo, ref, skill);
      const targetDir = resolveTargetDirForRepoSkill(skill, options);

      for (const file of files) {
        if (file.relativePath === SKILL_CONSTANTS.SKILL_FILE_NAME && typeof file.content === "string") {
          file.content = injectFromUrl(file.content, provenanceUrl);
        }
      }

      const perSkillStats = { A: 0, M: 0, "=": 0 };
      for (const file of files) {
        const filePath = join(targetDir, file.relativePath);
        const op = await determineOperation(filePath, file.content);
        totalStats[op]++;
        perSkillStats[op]++;

        const style = operationStyles[op];
        const displayBase = resolveDownloadBaseDir(options);
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

      // Determine skill-level status: all [A] → created, any [M] → updated, all [=] → unchanged
      if (perSkillStats.M > 0) {
        skillStats.M++;
      } else if (perSkillStats.A > 0) {
        skillStats.A++;
      } else {
        skillStats["="]++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ${picocolors.red("[!]")} ${skill.path} - ${picocolors.red(`Skipped: ${message}`)}`);
    }
  }

  console.log("");
  if (options.noop) {
    console.log(picocolors.dim("Dry run complete. Use without --noop to download."));
  } else {
    // File-level summary
    const parts: string[] = [];
    if (totalStats.A > 0) parts.push(picocolors.green(`${totalStats.A} file${totalStats.A !== 1 ? "s" : ""} created`));
    if (totalStats.M > 0) parts.push(picocolors.yellow(`${totalStats.M} file${totalStats.M !== 1 ? "s" : ""} updated`));
    if (totalStats["="] > 0)
      parts.push(picocolors.blue(`${totalStats["="]} file${totalStats["="] !== 1 ? "s" : ""} unchanged`));
    console.log(`Done! ${parts.join(", ")}.`);

    // Skill-level summary
    const skillParts: string[] = [];
    if (skillStats.A > 0)
      skillParts.push(picocolors.green(`${skillStats.A} skill${skillStats.A !== 1 ? "s" : ""} created`));
    if (skillStats.M > 0)
      skillParts.push(picocolors.yellow(`${skillStats.M} skill${skillStats.M !== 1 ? "s" : ""} updated`));
    if (skillStats["="] > 0)
      skillParts.push(picocolors.blue(`${skillStats["="]} skill${skillStats["="] !== 1 ? "s" : ""} unchanged`));
    if (skillParts.length > 0) {
      console.log(`      ${skillParts.join(", ")}.`);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────

/**
 * Download skill(s) from GitHub and place them locally.
 * Supports both single skill URLs and repository-level URLs for bulk download.
 */
export async function downloadSkill(options: DownloadOptions): Promise<void> {
  // 0. Validate: -g requires destination
  if (options.global && !options.destination) {
    throw new Error("acs download with -g/--global requires [to] argument.\nExample: acs download <url> claude -g");
  }

  // 1. Check for repo-level URL first
  const repoUrl = tryParseRepoUrl(options.url);
  if (repoUrl) {
    const ref = repoUrl.ref ?? (await fetchDefaultBranch(repoUrl.owner, repoUrl.repo, options.githubToken));
    const resolvedRepoUrl = { ...repoUrl, ref };

    if (options.verbose) {
      console.log(`DEBUG: Repository URL detected: ${repoUrl.owner}/${repoUrl.repo} ref=${ref}`);
    }

    const { skills, truncated } = await scanRepositoryForSkills(repoUrl.owner, repoUrl.repo, ref, options.githubToken);

    if (truncated) {
      console.log(
        picocolors.yellow("Warning: Repository tree was truncated by GitHub API. Some skills may not be found."),
      );
    }

    if (skills.length === 0) {
      throw new Error(
        `No skills found in github.com/${repoUrl.owner}/${repoUrl.repo}. Skills must contain a SKILL.md file.`,
      );
    }

    if (options.verbose) {
      console.log(`DEBUG: Found ${skills.length} skills: ${skills.map((s) => s.path).join(", ")}`);
    }

    await downloadMultipleSkills(resolvedRepoUrl, skills, options);
    return;
  }

  // 2. Single skill download (existing flow)
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

  // 5. Inject _from provenance into SKILL.md
  for (const file of files) {
    if (file.relativePath === SKILL_CONSTANTS.SKILL_FILE_NAME && typeof file.content === "string") {
      file.content = injectFromUrl(file.content, options.url);
    }
  }

  // 6. Write files and display results
  const stats = { A: 0, M: 0, "=": 0 };

  for (const file of files) {
    const filePath = join(targetDir, file.relativePath);
    const op = await determineOperation(filePath, file.content);
    stats[op]++;

    const style = operationStyles[op];
    // Display path relative to base directory for readability
    const displayBase = resolveDownloadBaseDir(options);
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

  // 7. Summary
  console.log("");
  if (options.noop) {
    console.log(picocolors.dim("Dry run complete. Use without --noop to download."));
  } else {
    // File-level summary
    const parts: string[] = [];
    if (stats.A > 0) parts.push(picocolors.green(`${stats.A} file${stats.A !== 1 ? "s" : ""} created`));
    if (stats.M > 0) parts.push(picocolors.yellow(`${stats.M} file${stats.M !== 1 ? "s" : ""} updated`));
    if (stats["="] > 0) parts.push(picocolors.blue(`${stats["="]} file${stats["="] !== 1 ? "s" : ""} unchanged`));
    console.log(`Done! ${parts.join(", ")}.`);

    // Skill-level summary (single skill download = 1 skill)
    const skillStatus = stats.A > 0 && stats.M === 0 ? "created" : stats.M > 0 ? "updated" : "unchanged";
    const skillColor =
      skillStatus === "created" ? picocolors.green : skillStatus === "updated" ? picocolors.yellow : picocolors.blue;
    console.log(`      ${skillColor(`1 skill ${skillStatus}`)}.`);
  }
}
