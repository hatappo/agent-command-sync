/**
 * Placeholder conversion utilities
 */

import { PLACEHOLDERS } from "./constants.js";

/**
 * Convert placeholders from Claude format to Gemini format
 */
export function convertClaudeToGeminiPlaceholders(content: string): string {
  let result = content;

  // Convert $ARGUMENTS → {{args}}
  result = result.replace(
    new RegExp(PLACEHOLDERS.CLAUDE.ARGUMENTS.replace("$", "\\$"), "g"),
    PLACEHOLDERS.GEMINI.ARGUMENTS,
  );

  // Convert !`command` → !{command} (backtick format)
  result = result.replace(PLACEHOLDERS.CLAUDE.SHELL_COMMAND_BACKTICK, "!{$1}");

  // Convert !command → !{command} at line start
  result = result.replace(PLACEHOLDERS.CLAUDE.SHELL_COMMAND_LINE_START, "!{$1}");

  // Convert @path/to/file → @{path/to/file}
  result = result.replace(PLACEHOLDERS.CLAUDE.FILE_REFERENCE, "@{$1}");

  return result;
}

/**
 * Convert placeholders from Gemini format to Claude format
 */
export function convertGeminiToClaudePlaceholders(content: string): string {
  let result = content;

  // Convert {{args}} → $ARGUMENTS
  result = result.replace(
    new RegExp(PLACEHOLDERS.GEMINI.ARGUMENTS.replace(/[{}]/g, "\\$&"), "g"),
    PLACEHOLDERS.CLAUDE.ARGUMENTS,
  );

  // Convert !{command} → !`command`
  result = result.replace(PLACEHOLDERS.GEMINI.SHELL_COMMAND, "!`$1`");

  // Convert @{path/to/file} → @path/to/file
  result = result.replace(PLACEHOLDERS.GEMINI.FILE_REFERENCE, "@$1");

  return result;
}

/**
 * Convert argument placeholder from Claude format to Gemini format
 */
export function convertArgumentPlaceholder(content: string, direction: "c2g" | "g2c"): string {
  if (direction === "c2g") {
    return content.replace(
      new RegExp(PLACEHOLDERS.CLAUDE.ARGUMENTS.replace("$", "\\$"), "g"),
      PLACEHOLDERS.GEMINI.ARGUMENTS,
    );
  }
  return content.replace(
    new RegExp(PLACEHOLDERS.GEMINI.ARGUMENTS.replace(/[{}]/g, "\\$&"), "g"),
    PLACEHOLDERS.CLAUDE.ARGUMENTS,
  );
}

/**
 * Convert shell command syntax
 */
export function convertShellCommands(content: string, direction: "c2g" | "g2c"): string {
  if (direction === "c2g") {
    let result = content;
    // Convert !`command` → !{command} (backtick format)
    result = result.replace(PLACEHOLDERS.CLAUDE.SHELL_COMMAND_BACKTICK, "!{$1}");
    // Convert !command → !{command} at line start
    result = result.replace(PLACEHOLDERS.CLAUDE.SHELL_COMMAND_LINE_START, "!{$1}");
    return result;
  }
  // Convert !{command} → !`command`
  return content.replace(PLACEHOLDERS.GEMINI.SHELL_COMMAND, "!`$1`");
}

/**
 * Convert file reference syntax
 */
export function convertFileReferences(content: string, direction: "c2g" | "g2c"): string {
  if (direction === "c2g") {
    // Convert @path/to/file → @{path/to/file}
    return content.replace(PLACEHOLDERS.CLAUDE.FILE_REFERENCE, "@{$1}");
  }
  // Convert @{path/to/file} → @path/to/file
  return content.replace(PLACEHOLDERS.GEMINI.FILE_REFERENCE, "@$1");
}
