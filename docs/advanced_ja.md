# 上級リファレンス

<div align="center"> <a href="advanced.md">en</a> | ja </div>

## ロスレス変換 — Chimera Hub

Chimera Hub は全エージェント固有設定を保持するロスレス変換ハブです。エージェント間の直接変換を複数回行うとエージェントごとの固有フィールド（例: Claude の `allowed-tools`、Copilot の `tools`）が消失する可能性がありますが、Chimera Hub を経由することでこれを防ぎます。

```bash
# 複数エージェントからインポート（ハブにマージ）
sk import claude
sk import gemini

# プレビューして適用
sk plan codex                             # プレビュー
sk apply codex                            # 適用
```

ハブファイルは `~/.config/agent-skill-porter/`（グローバル）または `<repo>/.agent-skill-porter/`（プロジェクト）に保存されます。

詳細なワークフロー、アーキテクチャ図、例については [Chimera Hub ワークフロー](chimera-hub-workflow_ja.md) を参照してください。

## Commands

`sk` はエージェント間での単一ファイルスラッシュコマンドの変換もサポートしています。

### Commands と Skills の違い

| 観点 | Commands | Skills |
| ---- | -------- | ------ |
| 構造 | 単一ファイル（`.md`, `.toml`） | ディレクトリ（`SKILL.md` + サポートファイル） |
| 場所 | `{base}/{tool}/commands/` | `{base}/{tool}/skills/<name>/` |
| 用途 | シンプルなプロンプト | 複数ファイルを伴う複雑なタスク |

### ファイル構造とメタデータ

| 機能                                      | Claude Code   | Gemini CLI    | Codex CLI     | OpenCode      | Copilot       | Cursor        | 変換メモ                                      |
| ----------------------------------------- | ------------- | ------------- | ------------- | ------------- | ------------- | ------------- | -------------------------------------------- |
| ファイル形式                               | Markdown      | TOML          | Markdown      | Markdown      | Markdown (`.prompt.md`) | Markdown | 自動変換                                |
| コンテンツフィールド                        | 本文コンテンツ  | `prompt`      | 本文コンテンツ  | 本文コンテンツ  | 本文コンテンツ  | 本文コンテンツ  | メインコマンドの内容                           |
| 説明メタデータ                            | `description` | `description` | `description` | `description` | `description` | -             | Cursorへの変換時に消失（frontmatterなし）        |
| `model`                                   | サポート       | -             | -             | サポート       | サポート       | -             | Claude/OpenCode/Copilot間で保持               |
| `tools`（YAML配列）                       | -             | -             | -             | -             | サポート       | -             | Copilot固有（extras経由でパススルー）           |
| `allowed-tools`, `argument-hint`          | サポート       | -             | -             | -             | -             | -             | Claude固有（`--remove-unsupported`を使用して削除）|

### コンテンツプレースホルダーと構文

| 機能                  | Claude Code    | Gemini CLI     | Codex CLI      | OpenCode       | Copilot        | Cursor         | 変換動作                                    |
| -------------------- | -------------- | -------------- | -------------- | -------------- | -------------- | -------------- | ------------------------------------------ |
| すべての引数          | `$ARGUMENTS`   | `{{args}}`     | `$ARGUMENTS`   | `$ARGUMENTS`   | -              | -              | 形式間で変換                                |
| 個別引数              | `$1` ... `$9`  | -              | `$1` ... `$9`  | `$1` ... `$9`  | -              | -              | そのまま保持（Gemini/Copilot/Cursorはサポートなし）  |
| シェルコマンド        | `` !`command` ``| `!{command}`  | -              | `` !`command` ``| -             | -              | 形式間で変換                                |
| ファイル参照          | `@path/to/file`| `@{path/to/file}` | -           | `@path/to/file`| -              | -              | 形式間で変換                                |

#### 個別引数

プレースホルダー `$1` から `$9` は、個々のコマンド引数を参照できます。例えば、`$1` は最初の引数、`$2` は2番目の引数を参照します。この機能はClaude Code、Codex CLI、OpenCodeでサポートされていますが、Gemini CLIではサポートされていません。変換時、これらのプレースホルダーはそのまま保持されます。

#### ファイル参照

ファイル参照を使用すると、コマンド内にファイルの内容をインラインで埋め込むことができます。ツール間で構文が異なります：
- Claude Code / OpenCodeは `@path/to/file.txt` を使用
- Gemini CLIは `@{path/to/file.txt}` を使用
- Codex CLIはこの機能をサポートしていません

変換時、構文は形式間で自動的に変換されます。Codexとの変換では、ファイル参照構文はそのまま保持されます。

## アーキテクチャ

### セマンティック IR（中間表現）

すべての変換はハブ&スポーク型のセマンティック IR を経由します。これによりエージェント間のペアワイズ変換器が不要になります：

```
Source Format → Parser → toIR() → SemanticIR → fromIR() → Target Format
```

各エージェントはすべてのインターフェース（`AgentConfig`, `BodyParser`, `CommandParser`, `CommandConverter`, `SkillParser`, `SkillConverter`）を実装する単一のクラスを持ちます。新しいエージェントの追加には1つのエージェントクラスだけで済み、既存の N エージェント分の N 個のコンバーターは不要です。

### SemanticIR の構造

```typescript
interface SemanticIR {
  contentType: "command" | "skill";
  body: BodySegment[];                  // トークン化されたボディコンテンツ
  semantic: SemanticProperties;         // 共有プロパティ（description, name, from 等）
  extras: Record<string, unknown>;      // エージェント固有のパススループロパティ
  meta: SemanticMeta;                   // 変換コンテキスト（ソースパス、タイプ等）
}
```

- **`semantic`** — エージェント間で共通の意味を持つプロパティ（例: `description`）。各エージェントクラスがエージェント固有のフィールド名とセマンティックプロパティ間のマッピングを行います。
- **`extras`** — その他すべてのプロパティをそのまま通過させます。エージェント固有フィールド（例: Claude の `allowed-tools`）はラウンドトリップの忠実性のために保持され、`--remove-unsupported` で除去可能です。
- **`body`** — `BodySegment[]`（プレーン文字列とセマンティックプレースホルダーの配列）としてトークン化されるため、プレースホルダー構文の変換（例: `$ARGUMENTS` ↔ `{{args}}`）は各エージェントの `commandToIR()`/`commandFromIR()` 内で自動的に行われます。

### ボディのトークン化

ボディコンテンツは `BodySegment` 要素の配列にパースされます。プレーン文字列と型付きの `ContentPlaceholder` オブジェクトが交互に並びます：

```typescript
type ContentPlaceholder =
  | { type: "arguments" }                // $ARGUMENTS / {{args}}
  | { type: "individual-argument"; index: 1-9 }  // $1-$9
  | { type: "shell-command"; command: string }    // !`cmd` / !{cmd}
  | { type: "file-reference"; path: string };     // @path / @{path}
```

各エージェントはエージェントクラスファイル内にボディパターンとシリアライザーを定義します（`src/agents/claude.ts`, `src/agents/gemini.ts` 等）。Claude、Codex、OpenCode は共通モジュール（`src/agents/_claude-syntax-body-patterns.ts`）で同一のプレースホルダー構文を共有し、Codex ではサポート外のプレースホルダータイプ（shell-command, file-reference）をベストエフォートで出力します。型駆動のシリアライザーレジストリ（`PlaceholderSerializers`）によりコンパイル時の網羅性が保証され、新しいプレースホルダータイプを追加すると、すべてのエージェントで実装するまで型エラーが発生します。

### ソースレイアウト

```
src/
├── agents/             # エージェントクラス（エージェント別1ファイル: パース、変換、ボディ処理）
├── types/              # 型定義（SemanticIR, BodySegment, エージェント固有フォーマット）
├── utils/              # 共有ユーティリティ（ファイル操作、バリデーション、ボディパースエンジン）
└── cli/                # CLI エントリポイントと同期オーケストレーション
```
