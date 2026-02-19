import type { IntermediateConversionOptions, ProductType } from "../types/index.js";

/**
 * CLI option type definition
 */
export interface CLIOptions extends IntermediateConversionOptions {
  // Fields inherited from IntermediateConversionOptions:
  // source: ProductType;
  // destination: ProductType;
  // removeUnsupported: boolean;
  // noOverwrite: boolean;
  // syncDelete: boolean;
  // file?: string;
  // noop: boolean;
  // verbose: boolean;
  // claudeDir?: string;
  // geminiDir?: string;
}

/**
 * Default values for CLI options
 */
export const defaultCLIOptions: Partial<CLIOptions> = {
  removeUnsupported: false,
  noOverwrite: false,
  syncDelete: false,
  noop: false,
  verbose: false,
  contentType: "both",
};

/**
 * Validate CLI options
 */
export function validateCLIOptions(options: Partial<CLIOptions>): string[] {
  const errors: string[] = [];

  // Validate source
  if (!options.source) {
    errors.push("--src option is required");
  } else if (!["claude", "gemini", "codex"].includes(options.source)) {
    errors.push('--src must be one of "claude", "gemini", or "codex"');
  }

  // Validate destination
  if (!options.destination) {
    errors.push("--dest option is required");
  } else if (!["claude", "gemini", "codex"].includes(options.destination)) {
    errors.push('--dest must be one of "claude", "gemini", or "codex"');
  }

  // Check if source and destination are the same
  if (options.source && options.destination && options.source === options.destination) {
    errors.push("Source and destination must be different");
  }

  // Validate file option
  if (options.file) {
    if (typeof options.file !== "string" || options.file.trim().length === 0) {
      errors.push("--file must be a non-empty string");
    }

    // Check for dangerous characters
    const dangerousChars = ["..", "/", "\\", "<", ">", "|", "?", "*"];
    for (const char of dangerousChars) {
      if (options.file.includes(char)) {
        errors.push(`--file contains dangerous character: ${char}`);
      }
    }
  }

  // Validate claudeDir option
  if (options.claudeDir?.endsWith("/commands")) {
    errors.push(
      "--claude-dir should point to the base Claude directory (e.g., ~/.claude), not the commands subdirectory. The '/commands' suffix will be added automatically. (Changed in v1.2.0)",
    );
  }

  // Validate geminiDir option
  if (options.geminiDir?.endsWith("/commands")) {
    errors.push(
      "--gemini-dir should point to the base Gemini directory (e.g., ~/.gemini), not the commands subdirectory. The '/commands' suffix will be added automatically. (Changed in v1.2.0)",
    );
  }

  // Validate contentType option
  if (options.contentType && !["commands", "skills", "both"].includes(options.contentType)) {
    errors.push('--type must be one of "commands", "skills", or "both"');
  }

  return errors;
}

/**
 * Convert CLI options to IntermediateConversionOptions
 */
export function cliOptionsToConversionOptions(cliOptions: CLIOptions): IntermediateConversionOptions {
  return {
    source: cliOptions.source,
    destination: cliOptions.destination,
    removeUnsupported: cliOptions.removeUnsupported,
    noOverwrite: cliOptions.noOverwrite,
    syncDelete: cliOptions.syncDelete,
    file: cliOptions.file,
    noop: cliOptions.noop,
    verbose: cliOptions.verbose,
    claudeDir: cliOptions.claudeDir,
    geminiDir: cliOptions.geminiDir,
    codexDir: cliOptions.codexDir,
    contentType: cliOptions.contentType,
  };
}
