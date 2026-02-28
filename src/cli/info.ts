import { promises as fs } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import matter from "gray-matter";
import picocolors from "picocolors";
import type { ProductType } from "../types/intermediate.js";
import { SKILL_CONSTANTS } from "../utils/constants.js";
import { fileExists, readFile } from "../utils/file-utils.js";
import { getOriginRemoteUrl } from "../utils/git-utils.js";
import { fetchDefaultBranch, scanRepositoryForSkills } from "../utils/github-utils.js";
import { parseFromValue } from "./update.js";

// ── Types ───────────────────────────────────────────────────────

export interface InfoOptions {
  skillPath: string;
  verbose: boolean;
  global: boolean;
  gitRoot?: string | null;
  customDirs?: Partial<Record<ProductType, string>>;
}

// ── URL Builders ────────────────────────────────────────────────

export function buildGitHubUrl(owner: string, repo: string, ref: string, repoSkillPath: string): string {
  return `https://github.com/${owner}/${repo}/tree/${ref}/${repoSkillPath}`;
}

export function buildSkillsShUrl(owner: string, repo: string, skillName: string): string {
  return `https://skills.sh/${owner}/${repo}/${skillName}`;
}

/**
 * Build a skillsmp.com URL from owner, repo, and the repo-relative skill directory path.
 *
 * Conversion rules:
 * 1. Construct: `<owner>/<repo>/<repoSkillPath>/SKILL.md`
 * 2. Replace `.`, `_`, `/` with `-`
 * 3. Lowercase
 * 4. Collapse consecutive `-` into one
 * 5. Strip leading/trailing `-`
 */
export function buildSkillsmpUrl(owner: string, repo: string, repoSkillPath: string): string {
  const raw = `${owner}/${repo}/${repoSkillPath}/SKILL.md`;
  const slug = raw
    .replace(/[._/]/g, "-")
    .toLowerCase()
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://skillsmp.com/skills/${slug}`;
}

// ── Files listing ───────────────────────────────────────────────

/**
 * Count files recursively in a directory.
 */
async function countFiles(dirPath: string): Promise<number> {
  let count = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      count++;
    } else if (entry.isDirectory()) {
      count += await countFiles(join(dirPath, entry.name));
    }
  }
  return count;
}

/**
 * List skill directory contents: direct files and subdirectories with file counts.
 * SKILL.md is listed first, then files alphabetically, then directories alphabetically.
 */
async function listSkillFiles(skillDir: string): Promise<string[]> {
  const entries = await fs.readdir(skillDir, { withFileTypes: true });
  const files: string[] = [];
  const dirs: { name: string; fileCount: number }[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      files.push(entry.name);
    } else if (entry.isDirectory()) {
      const fileCount = await countFiles(join(skillDir, entry.name));
      dirs.push({ name: entry.name, fileCount });
    }
  }

  // Sort: SKILL.md first, then files alphabetically, then dirs alphabetically
  files.sort((a, b) => {
    if (a === SKILL_CONSTANTS.SKILL_FILE_NAME) return -1;
    if (b === SKILL_CONSTANTS.SKILL_FILE_NAME) return 1;
    return a.localeCompare(b);
  });
  dirs.sort((a, b) => a.name.localeCompare(b.name));

  const lines: string[] = [];
  for (const f of files) {
    lines.push(`    ${f}`);
  }
  for (const d of dirs) {
    lines.push(`    ${d.name}/  (${d.fileCount} file${d.fileCount !== 1 ? "s" : ""})`);
  }
  return lines;
}

// ── Main ────────────────────────────────────────────────────────

export async function showSkillInfo(options: InfoOptions): Promise<void> {
  // 1. Resolve skill path (accept both skill directory and SKILL.md file)
  const baseDir = options.gitRoot ?? process.cwd();
  let resolvedPath = resolve(baseDir, options.skillPath);

  if (basename(resolvedPath) === SKILL_CONSTANTS.SKILL_FILE_NAME) {
    resolvedPath = dirname(resolvedPath);
  }

  const skillMdPath = join(resolvedPath, SKILL_CONSTANTS.SKILL_FILE_NAME);
  if (!(await fileExists(skillMdPath))) {
    throw new Error(`Not a skill directory (no SKILL.md found): ${options.skillPath}`);
  }

  // 2. Parse SKILL.md frontmatter
  const content = await readFile(skillMdPath);
  const parsed = matter(content);
  const data = parsed.data;
  const skillName = basename(resolvedPath);
  const displayPath = relative(baseDir, resolvedPath);

  // 3. Get remote URL
  const remoteUrl = options.gitRoot ? await getOriginRemoteUrl(options.gitRoot) : null;

  // 4. Extract _from info
  const fromValue = data._from;
  const hasFrom = fromValue && typeof fromValue === "string";

  if (options.verbose) {
    console.log(`DEBUG: Skill path: ${resolvedPath}`);
    console.log(`DEBUG: Frontmatter keys: ${Object.keys(data).join(", ")}`);
    if (hasFrom) console.log(`DEBUG: _from: ${fromValue}`);
  }

  // 5. Display meta info
  console.log(`\n${picocolors.bold(skillName)}\n`);

  if (data.description) {
    const desc = typeof data.description === "string" ? data.description : String(data.description);
    console.log(`  ${picocolors.dim("Description:")}  ${desc}`);
  }
  if (hasFrom) {
    console.log(`  ${picocolors.dim("Source:")}       ${fromValue}`);
  }
  if (data.license) {
    console.log(`  ${picocolors.dim("License:")}      ${data.license}`);
  }
  console.log(`  ${picocolors.dim("Path:")}         ${displayPath}`);
  console.log(`  ${picocolors.dim("Remote:")}       ${remoteUrl ?? "-"}`);

  // 6. Display files
  const fileLines = await listSkillFiles(resolvedPath);
  if (fileLines.length > 0) {
    console.log(`\n  ${picocolors.dim("Files:")}`);
    for (const line of fileLines) {
      console.log(line);
    }
  }

  // 7. Source links (only if _from exists)
  if (hasFrom) {
    const { ownerRepo } = parseFromValue(fromValue);
    const [owner, repo] = ownerRepo.split("/");

    if (owner && repo) {
      try {
        const token = process.env.GITHUB_TOKEN;
        const defaultBranch = await fetchDefaultBranch(owner, repo, token);

        if (options.verbose) {
          console.log(`\nDEBUG: Default branch: ${defaultBranch}`);
        }

        const { skills: remoteSkills } = await scanRepositoryForSkills(owner, repo, defaultBranch, token);
        const remoteSkill = remoteSkills.find((s) => s.name === skillName);

        if (remoteSkill) {
          const githubUrl = buildGitHubUrl(owner, repo, defaultBranch, remoteSkill.path);
          const skillsmpUrl = buildSkillsmpUrl(owner, repo, remoteSkill.path);
          const skillsShUrl = buildSkillsShUrl(owner, repo, skillName);

          console.log(`\n  ${picocolors.dim("Source links:")}`);
          console.log(`    ${picocolors.dim("GitHub:")}     ${picocolors.cyan(githubUrl)}`);
          console.log(`    ${picocolors.dim("skillsmp:")}   ${picocolors.cyan(skillsmpUrl)}`);
          console.log(`    ${picocolors.dim("skills.sh:")}  ${picocolors.cyan(skillsShUrl)}`);
        } else if (options.verbose) {
          console.log(`\nDEBUG: Skill "${skillName}" not found in remote repository ${ownerRepo}`);
        }
      } catch (error) {
        if (options.verbose) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`\nDEBUG: Failed to fetch source links: ${message}`);
        }
      }
    }
  }

  console.log("");
}
