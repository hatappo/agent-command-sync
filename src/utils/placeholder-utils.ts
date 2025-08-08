/**
 * プレースホルダー変換ユーティリティ
 */

import { PLACEHOLDERS } from "./constants.js";

/**
 * Claude形式からGemini形式へプレースホルダーを変換
 */
export function convertClaudeToGeminiPlaceholders(content: string): string {
  let result = content;

  // $ARGUMENTS → {{args}} の変換
  result = result.replace(
    new RegExp(PLACEHOLDERS.CLAUDE.ARGUMENTS.replace("$", "\\$"), "g"),
    PLACEHOLDERS.GEMINI.ARGUMENTS,
  );

  // !`command` → !{command} の変換（バッククォート形式）
  result = result.replace(PLACEHOLDERS.CLAUDE.SHELL_COMMAND_BACKTICK, "!{$1}");

  // 行頭の !command → !{command} の変換
  result = result.replace(PLACEHOLDERS.CLAUDE.SHELL_COMMAND_LINE_START, "!{$1}");

  return result;
}

/**
 * Gemini形式からClaude形式へプレースホルダーを変換
 */
export function convertGeminiToClaudePlaceholders(content: string): string {
  let result = content;

  // {{args}} → $ARGUMENTS の変換
  result = result.replace(
    new RegExp(PLACEHOLDERS.GEMINI.ARGUMENTS.replace(/[{}]/g, "\\$&"), "g"),
    PLACEHOLDERS.CLAUDE.ARGUMENTS,
  );

  // !{command} → !`command` の変換
  result = result.replace(PLACEHOLDERS.GEMINI.SHELL_COMMAND, "!`$1`");

  return result;
}

/**
 * 引数プレースホルダーをClaude形式からGemini形式へ変換
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
 * シェルコマンド構文を変換
 */
export function convertShellCommands(content: string, direction: "c2g" | "g2c"): string {
  if (direction === "c2g") {
    let result = content;
    // !`command` → !{command} の変換（バッククォート形式）
    result = result.replace(PLACEHOLDERS.CLAUDE.SHELL_COMMAND_BACKTICK, "!{$1}");
    // 行頭の !command → !{command} の変換
    result = result.replace(PLACEHOLDERS.CLAUDE.SHELL_COMMAND_LINE_START, "!{$1}");
    return result;
  }
  // !{command} → !`command` の変換
  return content.replace(PLACEHOLDERS.GEMINI.SHELL_COMMAND, "!`$1`");
}
