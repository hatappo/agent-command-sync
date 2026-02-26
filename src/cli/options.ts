import type { IntermediateConversionOptions } from "../types/index.js";
import { PRODUCT_TYPES } from "../types/intermediate.js";

/**
 * CLI option type definition
 */
export interface CLIOptions extends IntermediateConversionOptions {
  /** The original subcommand name (e.g., "sync", "import", "drift", "apply", "plan") */
  rawSubCommand?: string;
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
  global: false,
};

/**
 * Validate CLI options
 */
export function validateCLIOptions(options: Partial<CLIOptions>): string[] {
  const errors: string[] = [];
  const productList = PRODUCT_TYPES.map((t) => `"${t}"`).join(", ");

  // Validate source
  if (!options.source) {
    errors.push("<from> argument is required");
  } else if (!(PRODUCT_TYPES as readonly string[]).includes(options.source)) {
    errors.push(`<from> must be one of ${productList}`);
  }

  // Validate destination
  if (!options.destination) {
    errors.push("<to> argument is required");
  } else if (!(PRODUCT_TYPES as readonly string[]).includes(options.destination)) {
    errors.push(`<to> must be one of ${productList}`);
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

  // Validate custom directory options
  if (options.customDirs) {
    for (const [product, dir] of Object.entries(options.customDirs)) {
      if (dir?.endsWith("/commands") || dir?.endsWith("/prompts") || dir?.endsWith("/skills")) {
        errors.push(
          `--${product}-dir should point to the base directory, not the commands/prompts/skills subdirectory. The subdirectory suffix will be added automatically.`,
        );
      }
    }
  }

  // Validate contentType option
  if (options.contentType && !["commands", "skills", "both"].includes(options.contentType)) {
    errors.push('--type must be one of "commands", "skills", or "both"');
  }

  return errors;
}
