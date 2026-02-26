# Commands リファレンス

Commands は単一ファイルのスラッシュコマンドです。Skills（ディレクトリベース、推奨）については [README](../README_ja.md#skills-形式) を参照してください。

## Commands と Skills の違い

| 観点 | Commands | Skills |
| ---- | -------- | ------ |
| 構造 | 単一ファイル（`.md`, `.toml`） | ディレクトリ（`SKILL.md` + サポートファイル） |
| 場所 | `{base}/{tool}/commands/` | `{base}/{tool}/skills/<name>/` |
| 用途 | シンプルなプロンプト | 複数ファイルを伴う複雑なタスク |

## ファイル構造とメタデータ

| 機能                                      | Claude Code   | Gemini CLI    | Codex CLI     | OpenCode      | Copilot       | Cursor        | 変換メモ                                      |
| ----------------------------------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------------------------------------- |
| ファイル形式                               | Markdown      | TOML          | Markdown      | Markdown      | Markdown (`.prompt.md`) | Markdown | 自動変換                                |
| コンテンツフィールド                        | 本文コンテンツ  | `prompt`      | 本文コンテンツ  | 本文コンテンツ  | 本文コンテンツ  | 本文コンテンツ  | メインコマンドの内容                           |
| 説明メタデータ                            | `description` | `description` | `description` | `description` | `description` | -             | Cursorへの変換時に消失（frontmatterなし）        |
| `model`                                   | サポート       | -             | -             | サポート       | サポート       | -             | Claude/OpenCode/Copilot間で保持               |
| `tools`（YAML配列）                       | -             | -             | -             | -             | サポート       | -             | Copilot固有（extras経由でパススルー）           |
| `allowed-tools`, `argument-hint`          | サポート       | -             | -             | -             | -             | -             | Claude固有（`--remove-unsupported`を使用して削除）|

## コンテンツプレースホルダーと構文

| 機能                  | Claude Code    | Gemini CLI     | Codex CLI      | OpenCode       | Copilot        | Cursor         | 変換動作                                    |
| -------------------- | -------------- | -------------- | -------------- | -------------- | -------------- | -------------- | ------------------------------------------ |
| すべての引数          | `$ARGUMENTS`   | `{{args}}`     | `$ARGUMENTS`   | `$ARGUMENTS`   | -              | -              | 形式間で変換                                |
| 個別引数              | `$1` ... `$9`  | -              | `$1` ... `$9`  | `$1` ... `$9`  | -              | -              | そのまま保持（Gemini/Copilot/Cursorはサポートなし）  |
| シェルコマンド        | `` !`command` ``| `!{command}`  | -              | `` !`command` ``| -             | -              | 形式間で変換                                |
| ファイル参照          | `@path/to/file`| `@{path/to/file}` | -           | `@path/to/file`| -              | -              | 形式間で変換                                |

### 個別引数
プレースホルダー `$1` から `$9` は、個々のコマンド引数を参照できます。例えば、`$1` は最初の引数、`$2` は2番目の引数を参照します。この機能はClaude Code、Codex CLI、OpenCodeでサポートされていますが、Gemini CLIではサポートされていません。変換時、これらのプレースホルダーはそのまま保持されます。

### ファイル参照
ファイル参照を使用すると、コマンド内にファイルの内容をインラインで埋め込むことができます。ツール間で構文が異なります：
- Claude Code / OpenCodeは `@path/to/file.txt` を使用
- Gemini CLIは `@{path/to/file.txt}` を使用
- Codex CLIはこの機能をサポートしていません

変換時、構文は形式間で自動的に変換されます。Codexとの変換では、ファイル参照構文はそのまま保持されます。
