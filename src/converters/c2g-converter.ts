import type { ClaudeCommand, GeminiCommand, Converter, ConversionOptions } from '../types/index.js';
import { ConversionError } from '../types/index.js';

export class C2GConverter implements Converter<ClaudeCommand, GeminiCommand> {
  /**
   * Claude CommandをGemini Commandに変換
   */
  convert(source: ClaudeCommand, options: ConversionOptions): GeminiCommand {
    try {
      // 基本フィールドマッピング
      const result: GeminiCommand = {
        prompt: this.convertPrompt(source.content, options),
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
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * プロンプト内容を変換（プレースホルダー変換含む）
   */
  private convertPrompt(content: string, options: ConversionOptions): string {
    let convertedContent = content;

    // $ARGUMENTS → {{args}} の変換
    convertedContent = this.convertArgumentPlaceholder(convertedContent);

    // !command → !{command} の変換
    convertedContent = this.convertShellCommands(convertedContent);

    return convertedContent;
  }

  /**
   * 引数プレースホルダーを変換
   */
  private convertArgumentPlaceholder(content: string): string {
    return content.replace(/\$ARGUMENTS/g, '{{args}}');
  }

  /**
   * シェルコマンド構文を変換
   */
  private convertShellCommands(content: string): string {
    let convertedContent = content;

    // !`command` → !{command} の変換（バッククォート形式）
    convertedContent = convertedContent.replace(/!`([^`]+)`/g, '!{$1}');

    // 行頭の !command → !{command} の変換
    convertedContent = convertedContent.replace(/^!\s*([^\s{][^\n]*)/gm, '!{$1}');

    return convertedContent;
  }

  /**
   * ファイルパスを変換（.md → .toml）
   */
  private convertFilePath(claudePath: string): string {
    return claudePath.replace(/\.md$/, '.toml');
  }

  /**
   * Claude固有フィールドを処理
   */
  private handleClaudeSpecificFields(
    frontmatter: ClaudeCommand['frontmatter'],
    options: ConversionOptions
  ): Record<string, unknown> {
    const claudeSpecificFields = ['allowed-tools', 'argument-hint', 'model'];
    const result: Record<string, unknown> = {};

    for (const field of claudeSpecificFields) {
      const value = frontmatter[field];
      if (value !== undefined) {
        if (options.removeUnsupported) {
          // フィールドを削除（何もしない）
          continue;
        } else {
          // そのまま保持
          result[field] = value;
        }
      }
    }

    return result;
  }
}