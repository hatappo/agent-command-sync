import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import type { DiscoveredSkill, DownloadedFile } from "./github-utils.js";

const execFileAsync = promisify(execFile);
const LOCK_RETRY_MS = 100;
const LOCK_TIMEOUT_MS = 60_000;

interface GitExecOptions {
  cwd?: string;
  encoding?: "utf8" | "buffer";
}

function getCacheBaseDir(): string {
  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  return xdgCacheHome ? join(xdgCacheHome, "agent-skill-porter") : join(homedir(), ".cache", "agent-skill-porter");
}

export function getRepoCacheDir(owner: string, repo: string): string {
  return join(getCacheBaseDir(), "repos", `${owner.toLowerCase()}_${repo.toLowerCase()}.git`);
}

function getGitHubRemoteUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRepoLock<T>(repoDir: string, fn: () => Promise<T>): Promise<T> {
  const lockDir = `${repoDir}.lock`;
  const startedAt = Date.now();

  while (true) {
    try {
      await mkdir(lockDir);
      break;
    } catch (error) {
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for repository lock after 60 seconds: ${lockDir}`);
      }
      await sleep(LOCK_RETRY_MS);
    }
  }

  try {
    return await fn();
  } finally {
    await rm(lockDir, { recursive: true, force: true });
  }
}

async function runGit(args: string[], options: GitExecOptions = {}): Promise<string | Buffer> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: options.cwd,
      encoding: options.encoding === "buffer" ? null : "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.stdout;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`git ${args.join(" ")} failed: ${error.message}`);
    }
    throw error;
  }
}

async function runGitText(args: string[], cwd?: string): Promise<string> {
  const result = await runGit(args, { cwd, encoding: "utf8" });
  return String(result);
}

async function runGitBuffer(args: string[], cwd?: string): Promise<Buffer> {
  const result = await runGit(args, { cwd, encoding: "buffer" });
  return Buffer.isBuffer(result) ? result : Buffer.from(String(result));
}

export interface CachedRepository {
  owner: string;
  repo: string;
  dir: string;
}

export async function ensureGitHubRepoCache(owner: string, repo: string): Promise<CachedRepository> {
  const dir = getRepoCacheDir(owner, repo);
  const remoteUrl = getGitHubRemoteUrl(owner, repo);
  await mkdir(dirname(dir), { recursive: true });

  await withRepoLock(dir, async () => {
    const exists = await (async () => {
      try {
        await runGitText(["rev-parse", "--git-dir"], dir);
        return true;
      } catch {
        return false;
      }
    })();

    if (!exists) {
      await runGitText(["clone", "--bare", "--filter=blob:none", remoteUrl, dir]);
    } else {
      await runGitText(["fetch", "--prune", "--filter=blob:none", "origin"], dir);
      try {
        await runGitText(["remote", "set-head", "origin", "--auto"], dir);
      } catch {
        // Best-effort only. Some remotes do not expose HEAD in a way this can update.
      }
    }
  });

  return { owner, repo, dir };
}

export async function resolveDefaultBranch(repoDir: string): Promise<string> {
  try {
    const stdout = await runGitText(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repoDir);
    return stdout.trim().replace(/^origin\//, "");
  } catch {
    try {
      await runGitText(["remote", "set-head", "origin", "--auto"], repoDir);
      const stdout = await runGitText(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repoDir);
      return stdout.trim().replace(/^origin\//, "");
    } catch {
      const stdout = await runGitText(["symbolic-ref", "--short", "HEAD"], repoDir);
      return stdout.trim();
    }
  }
}

export async function resolveCommitForPath(
  repoDir: string,
  ref: string,
  skillPath: string,
  minAgeDays?: number,
): Promise<string | null> {
  if (minAgeDays === undefined) {
    const stdout = await runGitText(["rev-parse", `${ref}^{commit}`], repoDir);
    return stdout.trim() || null;
  }

  const cutoffUnixSeconds = Math.floor((Date.now() - minAgeDays * 24 * 60 * 60 * 1000) / 1000);
  try {
    const stdout = await runGitText(["log", "--format=%ct%x00%H", ref, "--", skillPath], repoDir);
    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const [timestampText, commitSha] = line.split("\0");
      const timestamp = Number.parseInt(timestampText, 10);
      if (Number.isNaN(timestamp) || !commitSha) {
        continue;
      }
      if (timestamp <= cutoffUnixSeconds) {
        return commitSha;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function resolveTreeHashAtCommit(
  repoDir: string,
  commitSha: string,
  skillPath: string,
): Promise<string | null> {
  try {
    const stdout = await runGitText(["rev-parse", `${commitSha}:${skillPath}`], repoDir);
    const hash = stdout.trim();
    return /^[0-9a-f]{40}$/.test(hash) ? hash : null;
  } catch {
    return null;
  }
}

export async function listSkillsAtRef(repoDir: string, ref: string): Promise<DiscoveredSkill[]> {
  const stdout = await runGitText(["ls-tree", "-r", "--name-only", "-z", ref], repoDir);
  const files = stdout
    .split("\0")
    .map((line) => line.trim())
    .filter(Boolean);

  const skillPaths = files
    .filter((file) => file.endsWith("/SKILL.md"))
    .map((file) => file.slice(0, -"/SKILL.md".length));

  const skills: DiscoveredSkill[] = [];
  for (const skillPath of skillPaths) {
    const prefix = `${skillPath}/`;
    const skillFiles = files.filter((file) => file.startsWith(prefix));
    const segments = skillPath.split("/");
    const treeHash = await resolveTreeHashAtCommit(repoDir, ref, skillPath);
    skills.push({
      path: skillPath,
      name: segments[segments.length - 1],
      files: skillFiles,
      treeHash: treeHash ?? undefined,
    });
  }

  return skills.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getSkillAtPath(repoDir: string, ref: string, skillPath: string): Promise<DiscoveredSkill | null> {
  const skills = await listSkillsAtRef(repoDir, ref);
  return skills.find((skill) => skill.path === skillPath) ?? null;
}

function isBinaryFile(path: string): boolean {
  const ext = extname(path).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".wasm"].includes(ext);
}

export async function readSkillFilesAtCommit(
  repoDir: string,
  commitSha: string,
  skillPath: string,
): Promise<DownloadedFile[]> {
  const stdout = await runGitText(["ls-tree", "-r", "--name-only", "-z", commitSha, skillPath], repoDir);
  const files = stdout
    .split("\0")
    .map((line) => line.trim())
    .filter(Boolean);

  const prefix = `${skillPath}/`;
  const downloaded: DownloadedFile[] = [];

  for (const filePath of files) {
    const relativePath = filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
    const binary = isBinaryFile(relativePath);
    const content = binary
      ? await runGitBuffer(["show", `${commitSha}:${filePath}`], repoDir)
      : await runGitText(["show", `${commitSha}:${filePath}`], repoDir);

    downloaded.push({
      relativePath,
      content,
      isBinary: binary,
    });
  }

  return downloaded;
}
