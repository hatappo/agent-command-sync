import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import type { AgentDefinition } from "../agents/agent-definition.js";
import type { FileSearchOptions } from "../types/index.js";
import { SKILL_CONSTANTS } from "./constants.js";

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Create directory recursively
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error}`);
  }
}

/**
 * Read a file
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Write to a file
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await ensureDirectory(dirname(filePath));
    await fs.writeFile(filePath, content, "utf-8");
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error}`);
  }
}

/**
 * Delete a file
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    throw new Error(`Failed to delete file ${filePath}: ${error}`);
  }
}

/**
 * Auto-complete or normalize file extension
 */
export function autoCompleteExtension(filename: string, possibleExtensions: string[]): string {
  // Check compound extensions first (e.g. ".prompt.md")
  for (const ext of possibleExtensions) {
    if (filename.endsWith(ext)) {
      return filename;
    }
  }

  const currentExt = extname(filename);

  // Add the first extension if there's no extension
  if (!currentExt) {
    return `${filename}${possibleExtensions[0]}`;
  }

  // Replace if it has the wrong extension
  // Example: .toml → .md (for Claude) or .md → .toml (for Gemini)
  const baseName = filename.slice(0, -currentExt.length);
  return `${baseName}${possibleExtensions[0]}`;
}

/**
 * Get base name without extension from a file path
 */
export function getBaseName(filePath: string, compoundExtension?: string): string {
  const filename = filePath.split("/").pop() || "";
  if (compoundExtension && filename.endsWith(compoundExtension)) {
    return filename.slice(0, -compoundExtension.length);
  }
  const ext = extname(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

/**
 * Resolve relative path to absolute path
 */
export function resolvePath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return resolve(path);
}

/**
 * Resolve command directory paths for an agent
 */
export function resolveCommandDir(agent: AgentDefinition, customDir?: string): { project: string; user: string } {
  return {
    project: join(process.cwd(), agent.dirs.projectBase, agent.dirs.commandSubdir),
    user: customDir
      ? join(resolvePath(customDir), agent.dirs.commandSubdir)
      : join(homedir(), agent.dirs.userDefault, agent.dirs.commandSubdir),
  };
}

/**
 * Resolve skill directory paths for an agent
 */
export function resolveSkillDir(agent: AgentDefinition, customDir?: string): { project: string; user: string } {
  return {
    project: join(process.cwd(), agent.dirs.projectBase, agent.dirs.skillSubdir),
    user: customDir
      ? join(resolvePath(customDir), agent.dirs.skillSubdir)
      : join(homedir(), agent.dirs.userDefault, agent.dirs.skillSubdir),
  };
}

/**
 * Search for files recursively in a directory
 */
export async function findFiles(directory: string, options: FileSearchOptions): Promise<string[]> {
  const files: string[] = [];

  if (!(await directoryExists(directory))) {
    return files;
  }

  async function searchDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory() && options.recursive) {
          await searchDirectory(fullPath);
        } else if (entry.isFile()) {
          const matchesExtension = options.extensions.some((ext) => entry.name.endsWith(ext));
          if (matchesExtension) {
            // Check exclusion patterns
            if (options.excludePatterns) {
              const shouldExclude = options.excludePatterns.some(
                (pattern) => entry.name.includes(pattern) || fullPath.includes(pattern),
              );
              if (shouldExclude) continue;
            }

            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore directory access errors (e.g., insufficient permissions)
      console.warn(`Warning: Could not access directory ${dir}: ${error}`);
    }
  }

  await searchDirectory(directory);
  return files.sort();
}

/**
 * Find command files for an agent
 */
export async function findAgentCommands(
  agent: AgentDefinition,
  specificFile?: string,
  customDir?: string,
): Promise<string[]> {
  const dirs = resolveCommandDir(agent, customDir);
  const extension = agent.fileExtension;
  const directory = dirs.user;

  const searchOptions: FileSearchOptions = {
    extensions: [extension],
    directories: [directory],
    recursive: true,
  };

  if (specificFile) {
    // If a specific file is specified
    const fileWithExt = autoCompleteExtension(specificFile, [extension]);

    // Try multiple extension patterns
    const possibleExtensions = [".prompt.md", ".md", ".toml"];
    const baseName = specificFile.replace(/\.prompt\.md$|\.md$|\.toml$/, "");

    const possiblePaths: string[] = [];

    // Try the specified filename as is
    possiblePaths.push(join(directory, fileWithExt));

    // Also try other extension patterns
    for (const ext of possibleExtensions) {
      if (!fileWithExt.endsWith(ext)) {
        possiblePaths.push(join(directory, `${baseName}${ext}`));
      }
    }

    for (const path of possiblePaths) {
      if (await fileExists(path)) {
        return [path];
      }
    }
    return [];
  }

  // Search all files
  const allFiles: string[] = [];
  for (const dir of searchOptions.directories) {
    const files = await findFiles(dir, searchOptions);
    allFiles.push(...files);
  }

  return allFiles;
}

/**
 * Find skill directories for an agent
 */
export async function findAgentSkills(
  agent: AgentDefinition,
  specificSkill?: string,
  customDir?: string,
): Promise<string[]> {
  const dirs = resolveSkillDir(agent, customDir);
  const directory = dirs.user;

  if (!(await directoryExists(directory))) {
    return [];
  }

  if (specificSkill) {
    // If a specific skill is specified
    const skillPath = join(directory, specificSkill);
    const skillFilePath = join(skillPath, SKILL_CONSTANTS.SKILL_FILE_NAME);
    if (await fileExists(skillFilePath)) {
      return [skillPath];
    }
    return [];
  }

  // Search all skill directories
  const skillDirs: string[] = [];

  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = join(directory, entry.name);
        const skillFilePath = join(skillPath, SKILL_CONSTANTS.SKILL_FILE_NAME);
        if (await fileExists(skillFilePath)) {
          skillDirs.push(skillPath);
        }
      }
    }
  } catch {
    // Ignore directory access errors
  }

  return skillDirs.sort();
}

/**
 * Generate command name from file path
 */
export function getCommandName(filePath: string, baseDirectory: string, sourceExtension?: string): string {
  const relativePath = relative(baseDirectory, filePath);
  let pathWithoutExt: string;
  if (sourceExtension && relativePath.endsWith(sourceExtension)) {
    pathWithoutExt = relativePath.slice(0, -sourceExtension.length);
  } else {
    pathWithoutExt = relativePath.replace(/\.[^/.]+$/, "");
  }

  // Convert directory structure to colon (namespacing)
  return pathWithoutExt.replace(/\//g, ":");
}

/**
 * Generate file path from command name
 */
export function getFilePathFromCommandName(commandName: string, baseDirectory: string, extension: string): string {
  // Convert colon to directory separator
  const relativePath = commandName.replace(/:/g, "/");
  return join(baseDirectory, `${relativePath}${extension}`);
}

/**
 * Get skill name from directory path
 */
export function getSkillNameFromPath(dirPath: string, baseDirectory: string): string {
  const relativePath = relative(baseDirectory, dirPath);
  return relativePath;
}

/**
 * Get skill directory path from skill name
 */
export function getSkillPathFromName(skillName: string, baseDirectory: string): string {
  return join(baseDirectory, skillName);
}
