import type { IntermediateConversionOptions, ProductType } from "../types/index.js";

/**
 * CLIオプションの型定義
 */
export interface CLIOptions extends IntermediateConversionOptions {
  // IntermediateConversionOptionsから継承されるフィールド:
  // source: ProductType;
  // destination: ProductType;
  // removeUnsupported: boolean;
  // noOverwrite: boolean;
  // syncDelete: boolean;
  // file?: string;
  // dryRun: boolean;
  // verbose: boolean;
  // claudeDir?: string;
  // geminiDir?: string;
}

/**
 * CLIオプションのデフォルト値
 */
export const defaultCLIOptions: Partial<CLIOptions> = {
  removeUnsupported: false,
  noOverwrite: false,
  syncDelete: false,
  dryRun: false,
  verbose: false,
};

/**
 * CLIオプションを検証
 */
export function validateCLIOptions(options: Partial<CLIOptions>): string[] {
  const errors: string[] = [];

  // source の検証
  if (!options.source) {
    errors.push("--src option is required");
  } else if (!["claude", "gemini"].includes(options.source)) {
    errors.push('--src must be either "claude" or "gemini"');
  }

  // destination の検証
  if (!options.destination) {
    errors.push("--dest option is required");
  } else if (!["claude", "gemini"].includes(options.destination)) {
    errors.push('--dest must be either "claude" or "gemini"');
  }

  // source と destination が同じ場合のチェック
  if (options.source && options.destination && options.source === options.destination) {
    errors.push("Source and destination must be different");
  }

  // file オプションの検証
  if (options.file) {
    if (typeof options.file !== "string" || options.file.trim().length === 0) {
      errors.push("--file must be a non-empty string");
    }

    // 危険な文字をチェック
    const dangerousChars = ["..", "/", "\\", "<", ">", "|", "?", "*"];
    for (const char of dangerousChars) {
      if (options.file.includes(char)) {
        errors.push(`--file contains dangerous character: ${char}`);
      }
    }
  }

  // claudeDir オプションの検証
  if (options.claudeDir?.endsWith("/commands")) {
    errors.push(
      "--claude-dir should point to the base Claude directory (e.g., ~/.claude), not the commands subdirectory. The '/commands' suffix will be added automatically. (Changed in v1.2.0)",
    );
  }

  // geminiDir オプションの検証
  if (options.geminiDir?.endsWith("/commands")) {
    errors.push(
      "--gemini-dir should point to the base Gemini directory (e.g., ~/.gemini), not the commands subdirectory. The '/commands' suffix will be added automatically. (Changed in v1.2.0)",
    );
  }

  return errors;
}

/**
 * CLIオプションをIntermediateConversionOptionsに変換
 */
export function cliOptionsToConversionOptions(cliOptions: CLIOptions): IntermediateConversionOptions {
  return {
    source: cliOptions.source,
    destination: cliOptions.destination,
    removeUnsupported: cliOptions.removeUnsupported,
    noOverwrite: cliOptions.noOverwrite,
    syncDelete: cliOptions.syncDelete,
    file: cliOptions.file,
    dryRun: cliOptions.dryRun,
    verbose: cliOptions.verbose,
    claudeDir: cliOptions.claudeDir,
    geminiDir: cliOptions.geminiDir,
  };
}