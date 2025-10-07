import picocolors from "picocolors";
import { ClaudeToIRConverter } from "../converters/claude-to-ir.js";
import { GeminiToIRConverter } from "../converters/gemini-to-ir.js";
import { IRToClaudeConverter } from "../converters/ir-to-claude.js";
import { IRToGeminiConverter } from "../converters/ir-to-gemini.js";
import { ClaudeParser } from "../parsers/claude-parser.js";
import { GeminiParser } from "../parsers/gemini-parser.js";
import type { ConversionResult, FileOperation, IntermediateRepresentation } from "../types/index.js";
import { convertClaudeToGeminiPlaceholders, convertGeminiToClaudePlaceholders } from "../utils/placeholder-utils.js";
import { CLAUDE_SPECIFIC_FIELDS } from "../utils/constants.js";
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
      picocolors.cyan(`Starting ${options.source} → ${options.destination} conversion...`),
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
  if (options.source === "claude") {
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
    // 中間表現への変換
    let ir: IntermediateRepresentation;

    if (options.source === "claude") {
      const parser = new ClaudeParser();
      const toIRConverter = new ClaudeToIRConverter();
      const claudeCommand = await parser.parse(sourceFile);
      ir = toIRConverter.toIntermediate(claudeCommand);
    } else {
      const parser = new GeminiParser();
      const toIRConverter = new GeminiToIRConverter();
      const geminiCommand = await parser.parse(sourceFile);
      ir = toIRConverter.toIntermediate(geminiCommand);
    }

    // メタデータにターゲットタイプを設定
    ir.meta.targetType = options.destination;

    // プレースホルダー変換
    if (options.source === "claude" && options.destination === "gemini") {
      ir.body = convertClaudeToGeminiPlaceholders(ir.body);
    } else if (options.source === "gemini" && options.destination === "claude") {
      ir.body = convertGeminiToClaudePlaceholders(ir.body);
    }

    // Claude固有フィールドの削除（必要な場合）
    if (options.removeUnsupported && options.destination === "gemini") {
      for (const field of CLAUDE_SPECIFIC_FIELDS) {
        delete ir.header[field];
      }
    }

    // ターゲット形式への変換
    let targetContent: string;
    let targetExt: string;

    if (options.destination === "claude") {
      const fromIRConverter = new IRToClaudeConverter();
      const claudeParser = new ClaudeParser();
      const claudeCommand = fromIRConverter.fromIntermediate(ir);
      targetContent = claudeParser.stringify(claudeCommand);
      targetExt = ".md";
    } else {
      const fromIRConverter = new IRToGeminiConverter();
      const geminiParser = new GeminiParser();

      // removeUnsupported が true の場合、Claude固有フィールドを削除
      const geminiCommand = fromIRConverter.fromIntermediate(ir);
      if (options.removeUnsupported) {
        for (const field of CLAUDE_SPECIFIC_FIELDS) {
          delete geminiCommand[field];
        }
      }

      targetContent = geminiParser.stringify(geminiCommand);
      targetExt = ".toml";
    }

    // ターゲットファイルパスを決定（user ディレクトリのみ対象）
    const directories = getCommandDirectories(options.claudeDir, options.geminiDir);
    const sourceDir = options.source === "claude" ? directories.claude.user : directories.gemini.user;
    const targetDir = options.destination === "claude" ? directories.claude.user : directories.gemini.user;

    if (!sourceFile.startsWith(sourceDir)) {
      throw new Error(`Source file ${sourceFile} is not in the ${options.source} user commands directory`);
    }

    const commandName = getCommandName(sourceFile, sourceDir);
    const targetFile = getFilePathFromCommandName(commandName, targetDir, targetExt);

    // ファイル操作を実行
    const operation = await handleFileOperation(targetFile, targetContent, options);
    operations.push(operation);
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
      options.destination === "gemini"
        ? await findGeminiCommands(undefined, options.geminiDir)
        : await findClaudeCommands(undefined, options.claudeDir);

    // ソースに対応するターゲットファイル名を生成（user ディレクトリのみ）
    const directories = getCommandDirectories(options.claudeDir, options.geminiDir);
    const sourceDir = options.source === "claude" ? directories.claude.user : directories.gemini.user;
    const targetDir = options.destination === "claude" ? directories.claude.user : directories.gemini.user;
    const targetExt = options.destination === "claude" ? ".md" : ".toml";

    const expectedTargetFiles = new Set(
      sourceFiles.map((sourceFile) => {
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
 * 操作タイプごとのスタイル定義
 */
const operationStyles = {
  A: { prefix: picocolors.green("[A]"), color: picocolors.green },
  M: { prefix: picocolors.yellow("[M]"), color: picocolors.yellow },
  D: { prefix: picocolors.red("[D]"), color: picocolors.red },
  "-": { prefix: picocolors.gray("[-]"), color: picocolors.gray },
} as const;

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
    const style = operationStyles[op.type] || {
      prefix: `[${op.type}]`,
      color: (s: string) => s,
    };

    console.log(`${style.prefix} ${op.filePath} - ${style.color(op.description)}`);
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