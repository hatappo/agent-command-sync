import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import type { CommandDirectories, FileSearchOptions } from "../types/index.js";

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
  const currentExt = extname(filename);

  // Add the first extension if there's no extension
  if (!currentExt) {
    return `${filename}${possibleExtensions[0]}`;
  }

  // Return as is if it already has the correct extension
  if (possibleExtensions.includes(currentExt)) {
    return filename;
  }

  // Replace if it has the wrong extension
  // Example: .toml → .md (for Claude) or .md → .toml (for Gemini)
  const baseName = filename.slice(0, -currentExt.length);
  return `${baseName}${possibleExtensions[0]}`;
}

/**
 * Get base name without extension from a file path
 */
export function getBaseName(filePath: string): string {
  const filename = filePath.split("/").pop() || "";
  const ext = extname(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

/**
 * Get command directory configuration
 * Specify base directories for claudeDir/geminiDir/codexDir, /commands (/prompts for Codex) will be added automatically
 */
export function getCommandDirectories(claudeDir?: string, geminiDir?: string, codexDir?: string): CommandDirectories {
  const homeDir = homedir();
  const currentDir = process.cwd();

  return {
    claude: {
      project: join(currentDir, ".claude", "commands"),
      user: claudeDir ? join(resolvePath(claudeDir), "commands") : join(homeDir, ".claude", "commands"),
    },
    gemini: {
      project: join(currentDir, ".gemini", "commands"),
      user: geminiDir ? join(resolvePath(geminiDir), "commands") : join(homeDir, ".gemini", "commands"),
    },
    codex: {
      project: join(currentDir, ".codex", "prompts"),
      user: codexDir ? join(resolvePath(codexDir), "prompts") : join(homeDir, ".codex", "prompts"),
    },
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
          const ext = extname(entry.name);
          if (options.extensions.includes(ext)) {
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
 * Common function to search for command files
 */
async function findCommandFiles(
  format: "claude" | "gemini" | "codex",
  specificFile?: string,
  baseDir?: string,
): Promise<string[]> {
  const directories = getCommandDirectories(
    format === "claude" ? baseDir : undefined,
    format === "gemini" ? baseDir : undefined,
    format === "codex" ? baseDir : undefined,
  );

  const extension = format === "claude" || format === "codex" ? ".md" : ".toml";
  const directory =
    format === "claude"
      ? directories.claude.user
      : format === "gemini"
        ? directories.gemini.user
        : directories.codex.user;

  const searchOptions: FileSearchOptions = {
    extensions: [extension],
    directories: [directory],
    recursive: true,
  };

  if (specificFile) {
    // If a specific file is specified
    const fileWithExt = autoCompleteExtension(specificFile, [extension]);

    // Try multiple extension patterns
    const possibleExtensions = [".md", ".toml"];
    const baseName = specificFile.replace(/\.(md|toml)$/, "");

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
 * Search for Claude Code command files
 */
export async function findClaudeCommands(specificFile?: string, claudeDir?: string): Promise<string[]> {
  return findCommandFiles("claude", specificFile, claudeDir);
}

/**
 * Search for Gemini CLI command files
 */
export async function findGeminiCommands(specificFile?: string, geminiDir?: string): Promise<string[]> {
  return findCommandFiles("gemini", specificFile, geminiDir);
}

/**
 * Search for Codex CLI command files
 */
export async function findCodexCommands(specificFile?: string, codexDir?: string): Promise<string[]> {
  return findCommandFiles("codex", specificFile, codexDir);
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
 * Generate command name from file path
 */
export function getCommandName(filePath: string, baseDirectory: string): string {
  const relativePath = relative(baseDirectory, filePath);
  const pathWithoutExt = relativePath.replace(/\.[^/.]+$/, "");

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
