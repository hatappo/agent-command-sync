import type { ClaudeCommand, ConversionOptions, Converter, GeminiCommand } from "../types/index.js";
import { ConversionError } from "../types/index.js";
import { CLAUDE_SPECIFIC_FIELDS, FILE_EXTENSIONS } from "../utils/constants.js";
import { convertClaudeToGeminiPlaceholders } from "../utils/placeholder-utils.js";

export class C2GConverter implements Converter<ClaudeCommand, GeminiCommand> {
  /**
   * Claude CommandをGemini Commandに変換
   */
  convert(source: ClaudeCommand, options: ConversionOptions): GeminiCommand {
    try {
      // 基本フィールドマッピング
      const result: GeminiCommand = {
        prompt: this.convertPrompt(source.content),
        filePath: this.convertFilePath(source.filePath),
      };

      // descriptionフィールドのマッピング
      if (source.frontmatter.description) {
        result.description = source.frontmatter.description;
      }

      // Claude固有フィールドの処理
      const claudeSpecificFields = this.handleClaudeSpecificFields(source.frontmatter, options);
      Object.assign(result, claudeSpecificFields);

      return result;
    } catch (error) {
      throw new ConversionError(
        `Failed to convert Claude command to Gemini format: ${error instanceof Error ? error.message : String(error)}`,
        source.filePath,
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * プロンプト内容を変換（プレースホルダー変換含む）
   */
  private convertPrompt(content: string): string {
    return convertClaudeToGeminiPlaceholders(content);
  }

  /**
   * ファイルパスを変換（.md → .toml）
   */
  private convertFilePath(claudePath: string): string {
    return claudePath.replace(/\.md$/, FILE_EXTENSIONS.GEMINI);
  }

  /**
   * Claude固有フィールドを処理
   */
  private handleClaudeSpecificFields(
    frontmatter: ClaudeCommand["frontmatter"],
    options: ConversionOptions,
  ): Record<string, unknown> {
    const claudeSpecificFields = CLAUDE_SPECIFIC_FIELDS;
    const result: Record<string, unknown> = {};

    for (const field of claudeSpecificFields) {
      const value = frontmatter[field];
      if (value !== undefined) {
        if (options.removeUnsupported) {
          // フィールドを削除（何もしない）
          continue;
        }
        // そのまま保持
        result[field] = value;
      }
    }

    return result;
  }
}
