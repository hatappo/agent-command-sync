<div align="center"> <a href="README.md">en</a> | ja </div>

--------------------------------------------------------------------------------

# agent-command-sync

[![npm version](https://badge.fury.io/js/agent-command-sync.svg)](https://www.npmjs.com/package/agent-command-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Claude Code、Gemini CLI、Codex CLI、OpenCode、GitHub Copilot、Cursor 間でカスタムスラッシュコマンドとスキル（Skills）を双方向に変換・同期する、直感的なビジュアルフィードバック付きのツールです。ロスレス変換ハブとして **Chimera Hub** を搭載しています。

## CHANGELOG

[CHANGELOG_ja.txt](CHANGELOG_ja.txt)

## インストール

```bash
npm install -g agent-command-sync
```

## クイックスタート

```bash
# エージェント間の直接変換
acs sync -s claude -d gemini
acs sync -s gemini -d claude

# Chimera ハブにインポート（ロスレス）
acs import claude
acs import gemini

# Chimera ハブからエージェントに適用
acs apply gemini
acs apply claude

# 変更のプレビュー（ドライラン）
acs drift claude          # インポートのプレビュー
acs plan gemini           # 適用のプレビュー

# Skills または Commands のみ変換
acs sync -s claude -d gemini -t skills
acs sync -s claude -d gemini -t commands

# 直接変換のプレビュー
acs sync -n -s claude -d gemini

# プロジェクトレベルではなくユーザーレベル（グローバル）ディレクトリを使用
acs sync -s claude -d gemini -g

# GitHub からスキルをダウンロード
acs download https://github.com/owner/repo/tree/main/.claude/skills/my-skill
```

## スクリーンショット

### 使用例
![agent-command-sync usage](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acsync-usage.png)

### 変換例
![agent-command-sync example](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acsync-example.png)

## 機能

- **プロジェクトレベルがデフォルト** - Git リポジトリ内で実行時、プロジェクトレベルのディレクトリ（例: `<repo>/.claude`）を自動的に使用
- **カラフルな出力** - 色分けされたステータスインジケータによる明確なビジュアルフィードバック
- **高速変換** - Claude Code、Gemini CLI、Codex CLI、OpenCode、GitHub Copilot、Cursor 間でコマンドを効率的に同期
- **双方向対応** - 任意の方向への変換に対応（Claude ↔ Gemini ↔ Codex ↔ OpenCode ↔ Copilot ↔ Cursor）
- **デフォルトで安全** - ドライランモードで適用前に変更をプレビュー
- **Chimera Hub** - 全エージェント固有設定を保持するロスレス変換ハブ（[詳細](docs/chimera-hub-workflow.md)）
- **サブコマンド** - Chimera ハブワークフロー用の `import`, `apply`, `drift`, `plan` と直接変換用の `sync`
- **ダウンロード** - `acs download` で GitHub リポジトリからスキルを直接取得
- **来歴トラッキング** - `_from` frontmatter プロパティでコマンド/スキルのコピー元を記録
- **短縮コマンド** - `agent-command-sync` の代わりに `acs` を使用可能
- **選択的同期** - 特定のファイルまたは全コマンドを一括変換

> **v3 からのアップグレード？** v4.0.0 ではデフォルトのディレクトリスコープが変更されました。破壊的変更は [CHANGELOG_ja.txt](CHANGELOG_ja.txt) をご確認ください。
>
> **v2 からのアップグレード？** [マイグレーションガイド](docs/migration-v2-to-v3_ja.md)をご確認ください。

## サブコマンド

### `acs sync` — エージェント間の直接変換

```bash
acs sync -s <source> -d <dest> [options]
```

### `acs import <agent>` — Chimera ハブにインポート (shorthand for `acs sync -s <agent> -d chimera`)

```bash
acs import claude                          # Claude から全てインポート
acs import gemini -t commands              # Commands のみインポート
```

### `acs drift <agent>` — インポートのプレビュー (shorthand for `acs sync -s <agent> -d chimera -n`)

```bash
acs drift claude                           # インポートの変更をプレビュー
```

### `acs apply <agent>` — Chimera ハブからエージェントに適用 (shorthand for `acs sync -s chimera -d <agent>`)

```bash
acs apply gemini                           # Gemini に適用
acs apply claude --remove-unsupported      # サポートされていないフィールドを削除
```

### `acs plan <agent>` — 適用のプレビュー (shorthand for `acs sync -s chimera -d <agent> -n`)

```bash
acs plan gemini                            # 適用の変更をプレビュー
```

### `acs download <url>` — GitHub からスキルをダウンロード

```bash
acs download https://github.com/owner/repo/tree/main/.claude/skills/my-skill
acs download <url> -d gemini               # Gemini のスキルディレクトリに配置
acs download <url> -d claude -g            # グローバル Claude ディレクトリに配置
acs download <url> -n                      # ダウンロードせずにプレビュー
```

## オプション（sync サブコマンド）

| オプション                    | 説明                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| `-s, --src <product>`       | **必須。** ソース製品: `claude`、`gemini`、`codex`、`opencode`、`copilot`、`cursor`、または `chimera` |
| `-d, --dest <product>`      | **必須。** 宛先製品: `claude`、`gemini`、`codex`、`opencode`、`copilot`、`cursor`、または `chimera` |
| `-t, --type <type>`         | コンテンツタイプ: `commands`、`skills`、または `both`（デフォルト: `both`）  |
| `-f, --file <filename>`     | 特定のファイルのみ変換（`.md`, `.toml` 拡張子をサポート）                    |
| `-g, --global`              | プロジェクトレベルではなくユーザーレベル（グローバル）ディレクトリを使用        |
| `-n, --noop`                | 変更を適用せずにプレビュー                                                 |
| `-v, --verbose`             | 詳細なデバッグ情報を表示                                                  |
| `--claude-dir <path>`       | Claude ベースディレクトリ（デフォルト: ~/.claude）                          |
| `--gemini-dir <path>`       | Gemini ベースディレクトリ（デフォルト: ~/.gemini）                          |
| `--codex-dir <path>`        | Codex ベースディレクトリ（デフォルト: ~/.codex）                           |
| `--opencode-dir <path>`     | OpenCode ベースディレクトリ（デフォルト: ~/.config/opencode）               |
| `--copilot-dir <path>`      | Copilot ベースディレクトリ（デフォルト: ~/.copilot）                        |
| `--cursor-dir <path>`       | Cursor ベースディレクトリ（デフォルト: ~/.cursor）                          |
| `--chimera-dir <path>`      | Chimera Hub ベースディレクトリ（デフォルト: ~/.config/acs）                 |
| `--no-overwrite`            | ターゲットディレクトリの既存ファイルをスキップ                                |
| `--sync-delete`             | ターゲットディレクトリの孤立ファイルを削除                                   |
| `--remove-unsupported`      | ターゲット形式でサポートされていないフィールドを削除                           |

## 使用例

```bash
# プレビュー付きで直接変換
acs sync -n -s claude -d gemini

# 特定のファイルを変換
acs sync -s gemini -d claude -f analyze-code

# Chimera ハブワークフロー
acs import claude                          # Claude → Chimera にインポート
acs import gemini                          # Gemini → Chimera にインポート（マージ）
acs apply claude                           # Chimera → Claude に適用（Claude extras 付き）
acs apply gemini                           # Chimera → Gemini に適用（Gemini extras 付き）

# クリーンアップ付きの完全同期
acs sync -s claude -d gemini --sync-delete --remove-unsupported

# カスタムディレクトリを使用（ベースディレクトリを指定、/commands と /skills は自動的に追加されます）
acs sync -s claude -d gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# デバッグ用の詳細出力を表示
acs sync -s claude -d gemini -v
```

## ディレクトリ解決

Git リポジトリ内で実行すると、`acs` はデフォルトで**プロジェクトレベル**のディレクトリ（例: `<repo>/.claude`、`<repo>/.gemini`）を使用します。ユーザーレベルのディレクトリを使用するには `-g`/`--global` を指定してください。

**優先順位:**
1. `--{agent}-dir`（カスタムディレクトリ） — 常に最優先
2. **プロジェクトレベル** — Git リポジトリ内でのデフォルト
3. **ユーザーレベル** — Git リポジトリ外でのデフォルト、または `-g` 指定時

### プロジェクトレベル（Git リポジトリ内のデフォルト）

| エージェント | Commands | Skills |
| ----------- | -------- | ------ |
| **Claude Code** | `<repo>/.claude/commands/*.md` | `<repo>/.claude/skills/<name>/SKILL.md` |
| **Gemini CLI** | `<repo>/.gemini/commands/*.toml` | `<repo>/.gemini/skills/<name>/SKILL.md` |
| **Codex CLI** | `<repo>/.codex/prompts/*.md` | `<repo>/.codex/skills/<name>/SKILL.md` |
| **OpenCode** | `<repo>/.config/opencode/commands/*.md` | `<repo>/.config/opencode/skills/<name>/SKILL.md` |
| **GitHub Copilot** | `<repo>/.copilot/prompts/*.prompt.md` | `<repo>/.copilot/skills/<name>/SKILL.md` |
| **Cursor** | `<repo>/.cursor/commands/*.md` | `<repo>/.cursor/skills/<name>/SKILL.md` |
| **Chimera** | `<repo>/.acs/commands/*.md` | `<repo>/.acs/skills/<name>/SKILL.md` |

### ユーザーレベル（`-g` 指定時または Git リポジトリ外）

| エージェント | Commands | Skills |
| ----------- | -------- | ------ |
| **Claude Code** | `~/.claude/commands/*.md` | `~/.claude/skills/<name>/SKILL.md` |
| **Gemini CLI** | `~/.gemini/commands/*.toml` | `~/.gemini/skills/<name>/SKILL.md` |
| **Codex CLI** | `~/.codex/prompts/*.md` | `~/.codex/skills/<name>/SKILL.md` |
| **OpenCode** | `~/.config/opencode/commands/*.md` | `~/.config/opencode/skills/<name>/SKILL.md` |
| **GitHub Copilot** | `~/.copilot/prompts/*.prompt.md` | `~/.copilot/skills/<name>/SKILL.md` |
| **Cursor** | `~/.cursor/commands/*.md` | `~/.cursor/skills/<name>/SKILL.md` |
| **Chimera** | `~/.config/acs/commands/*.md` | `~/.config/acs/skills/<name>/SKILL.md` |

## 形式比較と変換仕様

### Commands と Skills の違い

| 観点 | Commands | Skills |
| ---- | -------- | ------ |
| 構造 | 単一ファイル（`.md`, `.toml`） | ディレクトリ（`SKILL.md` + サポートファイル） |
| 場所 | `{base}/{tool}/commands/` | `{base}/{tool}/skills/<name>/` |
| 用途 | シンプルなプロンプト | 複数ファイルを伴う複雑なタスク |

---

## Commands 形式

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

---

## Skills 形式

Skills は Claude Code、Gemini CLI、Codex CLI、OpenCode、Cursor が採用している [Agent Skills](https://agentskills.io/) オープンスタンダードに従います。

### ディレクトリ構造

各スキルは `SKILL.md` とオプションのサポートファイルを含むディレクトリです：

```
~/.claude/skills/
└── my-skill/
    ├── SKILL.md           # メインスキル定義（必須）
    ├── helper.sh          # サポートファイル（オプション）
    └── config.json        # サポートファイル（オプション）
```

### SKILL.md 形式

すべてのツールで YAML frontmatter 付きの同じ `SKILL.md` 形式を使用します：

```markdown
---
name: my-skill
description: スキルの説明
---

スキルの指示をここに記述します。

ユーザー入力には $ARGUMENTS を使用します。
```

### スキルメタデータの比較

| フィールド | Claude Code | Gemini CLI | Codex CLI | OpenCode | Copilot | Cursor | 変換メモ |
| --------- | ----------- | ---------- | --------- | -------- | ------- | ------ | -------- |
| `name` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 必須 |
| `description` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 保持 |
| `argument-hint` | ✓ | - | - | - | ✓ | - | Claude/Copilot |
| `allowed-tools` | ✓ | - | - | - | - | ✓ | Claude/Cursor（agentskills.io） |
| `model` | ✓ | - | - | - | - | - | Claude 固有 |
| `context` | ✓ | - | - | - | - | - | Claude 固有（例: `"fork"`） |
| `agent` | ✓ | - | - | - | - | - | Claude 固有 |
| `hooks` | ✓ | - | - | - | - | - | Claude 固有（before/after/on_error） |
| `disable-model-invocation` | ✓ | - | ✓* | ✓** | ✓ | ✓ | 変換あり（下記参照） |
| `user-invocable` / `user-invokable` | ✓ | - | - | - | ✓*** | ✓ | スペル正規化付きで変換 |

\* Codex は `agents/openai.yaml` 内の `policy.allow_implicit_invocation` を使用（論理反転）
\*\* OpenCode は SKILL.md の frontmatter 内で `disable-model-invocation` を直接使用
\*\*\* Copilot は Claude の `user-invocable`（c）の代わりに `user-invokable`（k）を使用；変換時に自動正規化

### Codex 固有: agents/openai.yaml

Codex CLI はオプションの `agents/openai.yaml` 設定ファイルをサポートしています：

```
~/.codex/skills/
└── my-skill/
    ├── SKILL.md
    └── agents/
        └── openai.yaml    # Codex 固有の設定
```

`openai.yaml` の例：
```yaml
interface:
  display_name: "My Skill"
  short_description: "スキルの説明"
policy:
  allow_implicit_invocation: true
```

#### モデル呼び出し制御の変換

Codex の `policy.allow_implicit_invocation` フィールドは、Claude の `disable-model-invocation` と論理反転して相互変換されます：

| Claude Code | Codex CLI (`openai.yaml`) |
| ----------- | ------------------------- |
| `disable-model-invocation: true` | `policy.allow_implicit_invocation: false` |
| `disable-model-invocation: false` | `policy.allow_implicit_invocation: true` |

Claude → Codex 変換時に `disable-model-invocation` が設定されている場合、`agents/openai.yaml` ファイルが自動生成されます。

その他の `openai.yaml` フィールド（`interface.display_name`, `interface.short_description`）は Codex 固有であり、変換されません。

### サポートファイル

サポートファイル（スクリプト、設定、画像など）は変換時にそのままコピーされます：

| ファイルタイプ | 例 | 処理 |
| ------------ | -- | ---- |
| テキスト | `.sh`, `.py`, `.json`, `.yaml` | そのままコピー |
| バイナリ | `.png`, `.jpg`, `.pdf` | そのままコピー |
| 設定 | `openai.yaml` | Codex 固有、他のターゲットでは無視 |

### プレースホルダー変換（Skills）

Commands と同様：

| 機能 | Claude Code / Codex CLI / OpenCode | Gemini CLI | Copilot | Cursor |
| ---- | ---------------------------------- | ---------- | ------- | ------ |
| すべての引数 | `$ARGUMENTS` | `{{args}}` | サポートなし | サポートなし |
| 個別引数 | `$1` ... `$9` | サポートなし | サポートなし | サポートなし |
| シェルコマンド | `` !`command` `` | `!{command}` | サポートなし | サポートなし |
| ファイル参照 | `@path/to/file` | `@{path/to/file}` | サポートなし | サポートなし |

---

## 公式ドキュメント

### Commands
- [Slash commands - Claude Docs](https://docs.claude.com/en/docs/claude-code/slash-commands)
- [gemini-cli/docs/cli/custom-commands.md at main · google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md)
- [codex/docs/prompts.md at main · openai/codex](https://github.com/openai/codex/blob/main/docs/prompts.md)
- [OpenCode](https://opencode.ai/)
- [Custom instructions for GitHub Copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)

### Skills
- [Agent Skills Standard](https://agentskills.io/)
- [Custom skills - Claude Docs](https://docs.claude.com/en/docs/claude-code/custom-skills)

## ステータスインジケータ

- `[A]` 作成（緑） - ターゲットディレクトリに新規ファイル作成
- `[M]` 更新（黄） - 既存ファイルを更新
- `[=]` 変更なし（青） - ファイルが存在し、変換結果が既存内容と同一
- `[D]` 削除（赤） - `--sync-delete` でファイル削除
- `[-]` スキップ（グレー） - `--no-overwrite` でファイルをスキップ

## 必要環境

- Node.js >= 18.0.0
- npm または互換性のあるパッケージマネージャー

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

## 開発

```bash
# 依存関係をインストール
npm install

# プロジェクトをビルド
npm run build

# テストを実行
npm test

# カバレッジ付きでテストを実行
npm run test:coverage

# コードのリントとフォーマット
npm run lint
npm run format

# 型チェック
npm run lint:tsc

# 開発モード（ウォッチ）
npm run dev

# 実行
node dist/cli/index.js
```

### パブリッシング

```bash
# パッケージ内容を確認
npm pack --dry-run

# パッチバージョンを更新（1.0.0 → 1.0.1）
npm version patch

# マイナーバージョンを更新（1.0.0 → 1.1.0）
npm version minor

# メジャーバージョンを更新（1.0.0 → 2.0.0）
npm version major

# パッケージを公開
npm publish
```

## ライセンス

MIT
