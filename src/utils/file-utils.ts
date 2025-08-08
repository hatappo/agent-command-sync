import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import type { CommandDirectories, FileSearchOptions } from "../types/index.js";

/**
 * ファイルが存在するかチェック
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
 * ディレクトリが存在するかチェック
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
 * ディレクトリを再帰的に作成
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error}`);
  }
}

/**
 * ファイルを読み込み
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * ファイルを書き込み
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
 * ファイルを削除
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    throw new Error(`Failed to delete file ${filePath}: ${error}`);
  }
}

/**
 * 拡張子を自動補完または正規化
 */
export function autoCompleteExtension(filename: string, possibleExtensions: string[]): string {
  const currentExt = extname(filename);

  // 拡張子がない場合は最初の拡張子を追加
  if (!currentExt) {
    return `${filename}${possibleExtensions[0]}`;
  }

  // 既に正しい拡張子がある場合はそのまま返す
  if (possibleExtensions.includes(currentExt)) {
    return filename;
  }

  // 間違った拡張子がある場合は置き換える
  // 例: .toml → .md (Claude用) または .md → .toml (Gemini用)
  const baseName = filename.slice(0, -currentExt.length);
  return `${baseName}${possibleExtensions[0]}`;
}

/**
 * ファイル名から拡張子を除いたベース名を取得
 */
export function getBaseName(filePath: string): string {
  const filename = filePath.split("/").pop() || "";
  const ext = extname(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

/**
 * コマンドディレクトリの設定を取得
 * claudeDir/geminiDirにはベースディレクトリを指定し、/commandsは自動的に追加される
 */
export function getCommandDirectories(claudeDir?: string, geminiDir?: string): CommandDirectories {
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
  };
}

/**
 * ディレクトリ内のファイルを再帰的に検索
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
            // 除外パターンをチェック
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
      // ディレクトリアクセスエラーは無視（権限不足など）
      console.warn(`Warning: Could not access directory ${dir}: ${error}`);
    }
  }

  await searchDirectory(directory);
  return files.sort();
}

/**
 * コマンドファイルを検索する共通関数
 */
async function findCommandFiles(
  format: "claude" | "gemini",
  specificFile?: string,
  baseDir?: string,
): Promise<string[]> {
  const directories = getCommandDirectories(
    format === "claude" ? baseDir : undefined,
    format === "gemini" ? baseDir : undefined,
  );

  const extension = format === "claude" ? ".md" : ".toml";
  const directory = format === "claude" ? directories.claude.user : directories.gemini.user;

  const searchOptions: FileSearchOptions = {
    extensions: [extension],
    directories: [directory],
    recursive: true,
  };

  if (specificFile) {
    // 特定ファイルが指定された場合
    const fileWithExt = autoCompleteExtension(specificFile, [extension]);

    // 複数の拡張子パターンを試行
    const possibleExtensions = [".md", ".toml"];
    const baseName = specificFile.replace(/\.(md|toml)$/, "");

    const possiblePaths: string[] = [];

    // 指定されたファイル名をそのまま試行
    possiblePaths.push(join(directory, fileWithExt));

    // 他の拡張子パターンも試行
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

  // 全ファイルを検索
  const allFiles: string[] = [];
  for (const dir of searchOptions.directories) {
    const files = await findFiles(dir, searchOptions);
    allFiles.push(...files);
  }

  return allFiles;
}

/**
 * Claude Codeのコマンドファイルを検索
 */
export async function findClaudeCommands(specificFile?: string, claudeDir?: string): Promise<string[]> {
  return findCommandFiles("claude", specificFile, claudeDir);
}

/**
 * Gemini CLIのコマンドファイルを検索
 */
export async function findGeminiCommands(specificFile?: string, geminiDir?: string): Promise<string[]> {
  return findCommandFiles("gemini", specificFile, geminiDir);
}

/**
 * 相対パスを絶対パスに解決
 */
export function resolvePath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return resolve(path);
}

/**
 * ファイルパスからコマンド名を生成
 */
export function getCommandName(filePath: string, baseDirectory: string): string {
  const relativePath = relative(baseDirectory, filePath);
  const pathWithoutExt = relativePath.replace(/\.[^/.]+$/, "");

  // ディレクトリ構造をコロンに変換（ネームスペース化）
  return pathWithoutExt.replace(/\//g, ":");
}

/**
 * コマンド名からファイルパスを生成
 */
export function getFilePathFromCommandName(commandName: string, baseDirectory: string, extension: string): string {
  // コロンをディレクトリセパレータに変換
  const relativePath = commandName.replace(/:/g, "/");
  return join(baseDirectory, `${relativePath}${extension}`);
}
