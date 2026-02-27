<div align="center"> <a href="README.md">en</a> | ja </div>

--------------------------------------------------------------------------------

# agent-command-sync

[![npm version](https://badge.fury.io/js/agent-command-sync.svg)](https://www.npmjs.com/package/agent-command-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI コーディングエージェントの Skill パッケージマネージャー — Claude Code、Gemini CLI、Codex CLI、OpenCode、GitHub Copilot、Cursor 間で Skill をダウンロード・更新・同期。設定ファイル不要、追加ファイルなしですぐ使えます。

## CHANGELOG

[CHANGELOG_ja.txt](CHANGELOG_ja.txt)

## インストール

```bash
npm install -g agent-command-sync
```

## クイックスタート

### GitHub からスキルをダウンロード

```bash
# 特定のスキルをプロジェクトにダウンロード （to ./skill/skill-creator/）
acs download https://github.com/anthropics/skills/tree/main/skills/skill-creator

# リポジトリ上の全てのスキルをダウンロード
acs download https://github.com/anthropics/skills

# 特定のエージェント用ディレクトリへ配置 (to ./.gemini/skills/)
acs download https://github.com/anthropics/skills gemini

# ユーザーレベル（グローバル）ディレクトリへ配置 (to ~/.claude/skills/）
acs download https://github.com/anthropics/skills claude -g

# ダウンロードせずにプレビューのみ
acs download https://github.com/anthropics/skills -n
```

![acs download and update](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acs-download.png)

### スキルの形式と配置先を他のエージェント用に変換

```bash
# Claude のスキルを Gemini 用の形式・配置先に変換
acs sync claude gemini

# 逆方向にも変換可能
acs sync gemini claude

# ユーザーレベル（グローバル）ディレクトリのスキルを変換
acs sync gemini claude -g

# 適用前に変更をプレビュー
acs sync gemini claude -n
```

![acs sync example](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acsync-example.png)

## 対応エージェント

| エージェント | Skills | Commands | プレースホルダー |
| ----------- |:------:|:--------:|:------------:|
| Claude Code | ✓ | ✓ | ✓ |
| Gemini CLI | ✓ | ✓ | ✓ |
| Codex CLI | ✓ | ✓ | ✓ |
| OpenCode | ✓ | ✓ | ✓ |
| GitHub Copilot | ✓ | ✓ | - |
| Cursor | ✓ | ✓ | - |
| Chimera Hub | ✓ | ✓ | ✓ |

## 機能

- **GitHub からダウンロード** — `acs download` で GitHub リポジトリからスキルを直接取得
- **上流からの更新** — `acs update` でダウンロード済みスキルの上流変更をチェックし適用
- **来歴トラッキング** — ダウンロードや同期のたびにソース情報を `_from` に記録（`owner/repo@treeHash` 形式）。公開スキルに問題が発見された場合、影響を受けるローカルスキルを即座に追跡可能。`--no-provenance` で無効化
- **エージェント間フォーマット変換** — 7エージェント間でフォーマット差異を吸収したスキル変換
- **プレースホルダー変換** — `$ARGUMENTS` ↔ `{{args}}`、ファイル参照、シェルコマンドを自動変換
- **ドライランプレビュー** — `-n` で適用前に変更内容を確認
- **Chimera Hub** — 全エージェント固有設定を保持するロスレス変換ハブ（[詳細](docs/chimera-hub-workflow.md)）

> **v5.2 からのアップグレード？** v5.3.0 で `acs update` サブコマンドが追加され、`_from` に tree hash が付与されるようになりました（`owner/repo@treeHash`）。[CHANGELOG_ja.txt](CHANGELOG_ja.txt) をご確認ください。
>
> **v5.1 からのアップグレード？** v5.2.0 で `_from` の形式が完全な GitHub URL から `owner/repo` に変更されました。[CHANGELOG_ja.txt](CHANGELOG_ja.txt) をご確認ください。
>
> **v3 からのアップグレード？** v4.0.0 ではデフォルトのディレクトリスコープが変更されました。破壊的変更は [CHANGELOG_ja.txt](CHANGELOG_ja.txt) をご確認ください。
>
> **v2 からのアップグレード？** [マイグレーションガイド](docs/migration-v2-to-v3_ja.md)をご確認ください。

## サブコマンド

### `acs download <url> [to]`（エイリアス: `acs dl`）— GitHub からスキルをダウンロード

```bash
acs download https://github.com/anthropics/skills/tree/main/skills/skill-creator
acs download <url> gemini                  # Gemini のスキルディレクトリに配置
acs download <url> claude -g               # グローバル Claude ディレクトリに配置
acs download <url> -n                      # ダウンロードせずにプレビュー
```

#### GitHub 認証

プライベートリポジトリからダウンロードするには [Personal access token](https://github.com/settings/tokens?type=beta) を設定してください。

```bash
export GITHUB_TOKEN=ghp_...
```

**トークン権限**: パブリックリポジトリは権限設定不要です。プライベートリポジトリの場合、対象リポジトリに **Contents: Read** 権限を付与してください。

### `acs update [skill-path]` — ダウンロード済みスキルを上流から更新

```bash
acs update                                 # 全エージェントスキルをチェック＆更新
acs update .claude/skills/my-skill         # 特定のスキルを更新
acs update skills/                         # パス配下の全スキルを更新
acs update -n                              # 更新チェックのみ（適用なし）
```

### `acs sync <from> <to>` — エージェント間の直接変換

```bash
acs sync claude gemini                     # Claude → Gemini に変換
acs sync claude gemini -t commands          # Commands のみ
```

### `acs import <agent>` / `acs apply <agent>` — ロスレス変換のワークフロー

```bash
acs import claude                          # Claude → Chimera Hub にインポート
acs import gemini -t commands              # Commands のみインポート
acs apply gemini                           # Chimera Hub → Gemini に適用
acs apply claude --remove-unsupported      # サポートされていないフィールドを削除
```

### `acs drift <agent>` / `acs plan <agent>` — プレビュー（ドライラン）

```bash
acs drift claude                           # インポートの変更をプレビュー
acs plan gemini                            # 適用の変更をプレビュー
```

## オプション（sync サブコマンド）

| オプション                    | 説明                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| `<from>`                    | **必須。** ソースエージェント: `claude`、`gemini`、`codex`、`opencode`、`copilot`、`cursor`、または `chimera` |
| `<to>`                      | **必須。** 宛先エージェント: `claude`、`gemini`、`codex`、`opencode`、`copilot`、`cursor`、または `chimera` |
| `-t, --type <type>`         | コンテンツタイプ: `skills`、`commands`、または `both`（デフォルト: `skills`）  |
| `-f, --file <filename>`     | 特定のファイルのみ変換（`.md`, `.toml` 拡張子をサポート）                    |
| `-g, --global`              | プロジェクトレベルではなくユーザーレベル（グローバル）ディレクトリを使用        |
| `-n, --noop`                | 変更を適用せずにプレビュー                                                 |
| `-v, --verbose`             | 詳細なデバッグ情報を表示                                                  |
| `--no-overwrite`            | 変換先ディレクトリの既存ファイルをスキップ                                |
| `--sync-delete`             | 変換先ディレクトリの孤立ファイルを削除                                   |
| `--remove-unsupported`      | 変換先形式でサポートされていないフィールドを削除                           |
| `--no-provenance`           | ソース情報を `_from` frontmatter プロパティに記録しない                    |
| `--claude-dir <path>`       | Claude ベースディレクトリ（デフォルト: ~/.claude）                          |
| `--gemini-dir <path>`       | Gemini ベースディレクトリ（デフォルト: ~/.gemini）                          |
| `--codex-dir <path>`        | Codex ベースディレクトリ（デフォルト: ~/.codex）                           |
| `--opencode-dir <path>`     | OpenCode ベースディレクトリ（デフォルト: ~/.config/opencode）               |
| `--copilot-dir <path>`      | Copilot ベースディレクトリ（デフォルト: ~/.copilot）                        |
| `--cursor-dir <path>`       | Cursor ベースディレクトリ（デフォルト: ~/.cursor）                          |
| `--chimera-dir <path>`      | Chimera Hub ベースディレクトリ（デフォルト: ~/.config/acs）                 |

## 使用例

```bash
# プレビュー付きで直接変換
acs sync claude gemini -n

# 特定のファイルを変換
acs sync gemini claude -f analyze-code

# Chimera ハブワークフロー
acs import claude                          # Claude → Chimera にインポート
acs import gemini                          # Gemini → Chimera にインポート（マージ）
acs apply claude                           # Chimera → Claude に適用（Claude extras 付き）
acs apply gemini                           # Chimera → Gemini に適用（Gemini extras 付き）

# クリーンアップ付きの完全同期
acs sync claude gemini --sync-delete --remove-unsupported

# カスタムディレクトリを使用（ベースディレクトリを指定、/commands と /skills は自動的に追加されます）
acs sync claude gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# デバッグ用の詳細出力を表示
acs sync claude gemini -v
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
| 設定 | `openai.yaml` | Codex 固有、他の変換先では無視 |

### プレースホルダー変換（Skills）

[Commands](docs/commands-reference_ja.md) と同様：

| 機能 | Claude Code / Codex CLI / OpenCode | Gemini CLI | Copilot | Cursor |
| ---- | ---------------------------------- | ---------- | ------- | ------ |
| すべての引数 | `$ARGUMENTS` | `{{args}}` | サポートなし | サポートなし |
| 個別引数 | `$1` ... `$9` | サポートなし | サポートなし | サポートなし |
| シェルコマンド | `` !`command` `` | `!{command}` | サポートなし | サポートなし |
| ファイル参照 | `@path/to/file` | `@{path/to/file}` | サポートなし | サポートなし |

## 上級: Chimera Hub

Chimera Hub は全エージェント固有設定を保持するロスレス変換ハブです。エージェント間の直接変換を複数回行うとエージェントごとの固有フィールド（例: Claude の `allowed-tools`、Copilot の `tools`）が消失する可能性がありますが、Chimera Hub を経由することでこれを防ぎます。

```bash
# 複数エージェントからインポート（ハブにマージ）
acs import claude
acs import gemini

# プレビューして適用
acs plan codex                             # プレビュー
acs apply codex                            # 適用
```

ハブファイルは `~/.config/acs/`（グローバル）または `<repo>/.acs/`（プロジェクト）に保存されます。

詳細なワークフローと例については [Chimera Hub ワークフロー](docs/chimera-hub-workflow.md) を参照してください。

## Commands

`acs` はエージェント間での単一ファイルスラッシュコマンドの変換もサポートしています。コマンド形式の詳細、メタデータ比較、プレースホルダー構文については [Commands リファレンス](docs/commands-reference_ja.md) を参照してください。

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

- `[A]` 作成（緑） - 変換先ディレクトリに新規ファイル作成
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
