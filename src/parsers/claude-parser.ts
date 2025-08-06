import matter from "gray-matter";
import type { ClaudeCommand, Parser } from "../types/index.js";
import { ParseError } from "../types/index.js";
import { readFile } from "../utils/file-utils.js";
import { formatValidationErrors, validateClaudeCommand } from "../utils/validation.js";

export class ClaudeParser implements Parser<ClaudeCommand> {
  /**
   * Markdownファイルを解析してClaudeCommandオブジェクトを生成
   */
  async parse(filePath: string): Promise<ClaudeCommand> {
    try {
      const content = await readFile(filePath);
      const parsed = matter(content);

      return {
        frontmatter: {
          "allowed-tools": parsed.data["allowed-tools"],
          "argument-hint": parsed.data["argument-hint"],
          description: parsed.data.description,
          model: parsed.data.model,
          ...parsed.data, // その他のフィールドも保持
        },
        content: parsed.content,
        filePath,
      };
    } catch (error) {
      throw new ParseError(
        `Failed to parse Claude command file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * ClaudeCommandオブジェクトの妥当性を検証
   */
  validate(data: ClaudeCommand): boolean {
    const errors = validateClaudeCommand(data);
    return errors.length === 0;
  }

  /**
   * ClaudeCommandオブジェクトの詳細バリデーション（エラー詳細付き）
   */
  validateWithErrors(data: ClaudeCommand): {
    isValid: boolean;
    errors: string;
  } {
    const errors = validateClaudeCommand(data);
    return {
      isValid: errors.length === 0,
      errors: formatValidationErrors(errors),
    };
  }

  /**
   * ClaudeCommandオブジェクトをMarkdown形式に変換
   */
  stringify(command: ClaudeCommand): string {
    const { frontmatter, content } = command;

    // 空のフロントマターの場合はフロントマターなしで出力
    const hasValidFrontmatter = Object.keys(frontmatter).some(
      (key) => frontmatter[key] !== undefined && frontmatter[key] !== null,
    );

    if (!hasValidFrontmatter) {
      return content;
    }

    // フロントマターから undefined/null 値を除去
    const cleanFrontmatter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value !== undefined && value !== null) {
        cleanFrontmatter[key] = value;
      }
    }

    return matter.stringify(content, cleanFrontmatter);
  }
}
