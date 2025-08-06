import picocolors from "picocolors";
import { C2GConverter } from "../converters/c2g-converter.js";
import { G2CConverter } from "../converters/g2c-converter.js";
import { ClaudeParser } from "../parsers/claude-parser.js";
import { GeminiParser } from "../parsers/gemini-parser.js";
import type { ConversionResult, FileOperation } from "../types/index.js";
import {
  deleteFile,
  fileExists,
  findClaudeCommands,
  findGeminiCommands,
  getCommandDirectories,
  getCommandName,
  getFilePathFromCommandName,
  writeFile,
} from "../utils/file-utils.js";
import type { CLIOptions } from "./options.js";
import { cliOptionsToConversionOptions } from "./options.js";

/**
 * コマンド同期のメイン関数
 */
export async function syncCommands(options: CLIOptions): Promise<ConversionResult> {
  const conversionOptions = cliOptionsToConversionOptions(options);
  const operations: FileOperation[] = [];
  const errors: Error[] = [];
  let processed = 0;
  let created = 0;
  let modified = 0;
  let deleted = 0;
  let skipped = 0;

  try {
    console.log(
      picocolors.cyan(`Starting ${options.direction === "c2g" ? "Claude → Gemini" : "Gemini → Claude"} conversion...`),
    );

    if (options.dryRun) {
      console.log(picocolors.yellow("DRY RUN MODE - No files will be modified"));
    }

    // ソースファイルを検索
    const sourceFiles = await getSourceFiles(options);
    console.log(picocolors.dim(`Found ${sourceFiles.length} source file(s)`));

    if (sourceFiles.length === 0) {
      console.log(picocolors.gray("No files to convert."));
      return {
        success: true,
        operations,
        errors,
        summary: { processed, created, modified, deleted, skipped },
      };
    }

    // 各ファイルを変換
    for (const sourceFile of sourceFiles) {
      try {
        const result = await convertSingleFile(sourceFile, conversionOptions);
        operations.push(...result.operations);
        errors.push(...result.errors);

        // 統計を更新
        for (const op of result.operations) {
          switch (op.type) {
            case "A":
              created++;
              break;
            case "M":
              modified++;
              break;
            case "D":
              deleted++;
              break;
            case "-":
              skipped++;
              break;
          }
        }

        processed++;
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // sync-deleteオプションの処理
    if (options.syncDelete) {
      const deleteResult = await handleSyncDelete(options, sourceFiles);
      operations.push(...deleteResult.operations);
      errors.push(...deleteResult.errors);
      deleted += deleteResult.operations.filter((op) => op.type === "D").length;
    }

    // 結果を表示
    displayResults(operations, errors, options.dryRun);

    return {
      success: errors.length === 0,
      operations,
      errors,
      summary: { processed, created, modified, deleted, skipped },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errors.push(err);
    console.error("Conversion failed:", err.message);

    return {
      success: false,
      operations,
      errors,
      summary: { processed, created, modified, deleted, skipped },
    };
  }
}

/**
 * ソースファイルを取得
 */
async function getSourceFiles(options: CLIOptions): Promise<string[]> {
  if (options.direction === "c2g") {
    return await findClaudeCommands(options.file, options.claudeDir);
  }
  return await findGeminiCommands(options.file, options.geminiDir);
}

/**
 * 単一ファイルを変換
 */
async function convertSingleFile(
  sourceFile: string,
  options: CLIOptions,
): Promise<{ operations: FileOperation[]; errors: Error[] }> {
  const operations: FileOperation[] = [];
  const errors: Error[] = [];

  try {
    if (options.direction === "c2g") {
      // Claude → Gemini変換
      const parser = new ClaudeParser();
      const converter = new C2GConverter();
      const geminiParser = new GeminiParser();

      const claudeCommand = await parser.parse(sourceFile);
      const geminiCommand = converter.convert(claudeCommand, options);

      // ターゲットファイルパスを決定（user ディレクトリのみ対象）
      const directories = getCommandDirectories(options.claudeDir, options.geminiDir);

      if (!sourceFile.startsWith(directories.claude.user)) {
        throw new Error(`Source file ${sourceFile} is not in the Claude user commands directory`);
      }

      const commandName = getCommandName(sourceFile, directories.claude.user);
      const targetFile = getFilePathFromCommandName(commandName, directories.gemini.user, ".toml");

      // ファイル操作を実行
      const operation = await handleFileOperation(targetFile, geminiParser.stringify(geminiCommand), options);
      operations.push(operation);
    } else {
      // Gemini → Claude変換
      const parser = new GeminiParser();
      const converter = new G2CConverter();
      const claudeParser = new ClaudeParser();

      const geminiCommand = await parser.parse(sourceFile);
      const claudeCommand = converter.convert(geminiCommand, options);

      // ターゲットファイルパスを決定（user ディレクトリのみ対象）
      const directories = getCommandDirectories(options.claudeDir, options.geminiDir);

      if (!sourceFile.startsWith(directories.gemini.user)) {
        throw new Error(`Source file ${sourceFile} is not in the Gemini user commands directory`);
      }

      const commandName = getCommandName(sourceFile, directories.gemini.user);
      const targetFile = getFilePathFromCommandName(commandName, directories.claude.user, ".md");

      // ファイル操作を実行
      const operation = await handleFileOperation(targetFile, claudeParser.stringify(claudeCommand), options);
      operations.push(operation);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }

  return { operations, errors };
}

/**
 * ファイル操作を処理
 */
async function handleFileOperation(targetFile: string, content: string, options: CLIOptions): Promise<FileOperation> {
  const exists = await fileExists(targetFile);

  // no-overwriteオプションのチェック
  if (exists && options.noOverwrite) {
    return {
      type: "-",
      filePath: targetFile,
      description: "Skipped (file exists and --no-overwrite specified)",
    };
  }

  // ドライランモードの場合
  if (options.dryRun) {
    return {
      type: exists ? "M" : "A",
      filePath: targetFile,
      description: exists ? "Would modify" : "Would create",
    };
  }

  // 実際のファイル操作
  await writeFile(targetFile, content);

  return {
    type: exists ? "M" : "A",
    filePath: targetFile,
    description: exists ? "Modified" : "Created",
  };
}

/**
 * sync-deleteオプションの処理
 */
async function handleSyncDelete(
  options: CLIOptions,
  sourceFiles: string[],
): Promise<{ operations: FileOperation[]; errors: Error[] }> {
  const operations: FileOperation[] = [];
  const errors: Error[] = [];

  try {
    // ターゲットファイルを取得
    const targetFiles =
      options.direction === "c2g"
        ? await findGeminiCommands(undefined, options.geminiDir)
        : await findClaudeCommands(undefined, options.claudeDir);

    // ソースに対応するターゲットファイル名を生成（user ディレクトリのみ）
    const directories = getCommandDirectories(options.claudeDir, options.geminiDir);
    const expectedTargetFiles = new Set(
      sourceFiles.map((sourceFile) => {
        const sourceDir = options.direction === "c2g" ? directories.claude.user : directories.gemini.user;
        const targetDir = options.direction === "c2g" ? directories.gemini.user : directories.claude.user;
        const targetExt = options.direction === "c2g" ? ".toml" : ".md";

        const commandName = getCommandName(sourceFile, sourceDir);
        return getFilePathFromCommandName(commandName, targetDir, targetExt);
      }),
    );

    // 不要なターゲットファイルを削除
    for (const targetFile of targetFiles) {
      if (!expectedTargetFiles.has(targetFile)) {
        if (options.dryRun) {
          operations.push({
            type: "D",
            filePath: targetFile,
            description: "Would delete (orphaned)",
          });
        } else {
          await deleteFile(targetFile);
          operations.push({
            type: "D",
            filePath: targetFile,
            description: "Deleted (orphaned)",
          });
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  }

  return { operations, errors };
}

/**
 * 結果を表示
 */
function displayResults(operations: FileOperation[], errors: Error[], isDryRun: boolean): void {
  console.log(picocolors.bold("\nResults:"));

  if (operations.length === 0) {
    console.log(picocolors.gray("No operations performed."));
    return;
  }

  // 操作を表示
  for (const op of operations) {
    let prefix: string;
    let color: (str: string) => string;

    switch (op.type) {
      case "A":
        prefix = picocolors.green("[A]");
        color = picocolors.green;
        break;
      case "M":
        prefix = picocolors.yellow("[M]");
        color = picocolors.yellow;
        break;
      case "D":
        prefix = picocolors.red("[D]");
        color = picocolors.red;
        break;
      case "-":
        prefix = picocolors.gray("[-]");
        color = picocolors.gray;
        break;
      default:
        prefix = `[${op.type}]`;
        color = (s: string) => s;
    }

    console.log(`${prefix} ${op.filePath} - ${color(op.description)}`);
  }

  // 統計を表示
  const stats = {
    A: operations.filter((op) => op.type === "A").length,
    M: operations.filter((op) => op.type === "M").length,
    D: operations.filter((op) => op.type === "D").length,
    "-": operations.filter((op) => op.type === "-").length,
  };

  console.log(picocolors.bold("\nSummary:"));
  if (stats.A > 0) console.log(`  ${picocolors.green("Created:")} ${stats.A}`);
  if (stats.M > 0) console.log(`  ${picocolors.yellow("Modified:")} ${stats.M}`);
  if (stats.D > 0) console.log(`  ${picocolors.red("Deleted:")} ${stats.D}`);
  if (stats["-"] > 0) console.log(`  ${picocolors.gray("Skipped:")} ${stats["-"]}`);

  // エラーを表示
  if (errors.length > 0) {
    console.log(picocolors.red(picocolors.bold("\nErrors:")));
    errors.forEach((error, index) => {
      console.log(picocolors.red(`  ${index + 1}. ${error.message}`));
    });
  }

  if (isDryRun) {
    console.log(picocolors.cyan("\nThis was a dry run. Use without --dry-run to apply changes."));
  } else if (errors.length === 0) {
    console.log(picocolors.green("\n✓ Conversion completed successfully!"));
  }
}
