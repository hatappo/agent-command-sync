<div align="center"> <a href="README.md">en</a> | ja </div>

--------------------------------------------------------------------------------

# agent-command-sync

[![npm version](https://badge.fury.io/js/agent-command-sync.svg)](https://www.npmjs.com/package/agent-command-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Claude Code、Gemini CLI、Codex CLI、OpenCode 間でカスタムスラッシュコマンドとスキル（Skills）を双方向に変換・同期する、直感的なビジュアルフィードバック付きのツールです。

## CHANGELOG

[CHANGELOG_ja.txt](CHANGELOG_ja.txt)

## インストール

```bash
npm install -g agent-command-sync
```

## クイックスタート

```bash
# Claude Code → Gemini CLI に変換（Commands + Skills）
acsync -s claude -d gemini

# Gemini CLI → Claude Code に変換
acsync -s gemini -d claude

# Skills のみ変換
acsync -s claude -d gemini -t skills

# Commands のみ変換
acsync -s claude -d gemini -t commands

# 適用前に変更をプレビュー
acsync -n -s claude -d gemini
```

## スクリーンショット

### 使用例
![agent-command-sync usage](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acsync-usage.png)

### 変換例
![agent-command-sync example](https://raw.githubusercontent.com/hatappo/agent-command-sync/main/docs/acsync-example.png)

## 機能

- **カラフルな出力** - 色分けされたステータスインジケータによる明確なビジュアルフィードバック
- **高速変換** - Claude Code、Gemini CLI、Codex CLI、OpenCode 間でコマンドを効率的に同期
- **双方向対応** - 任意の方向への変換に対応（Claude ↔ Gemini ↔ Codex ↔ OpenCode）
- **デフォルトで安全** - ドライランモードで適用前に変更をプレビュー
- **短縮コマンド** - `agent-command-sync` の代わりに `acsync` を使用可能
- **選択的同期** - 特定のファイルまたは全コマンドを一括変換

## オプション

| オプション                    | 説明                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| `-s, --src <product>`       | **必須。** ソース製品: `claude`、`gemini`、`codex`、または `opencode`       |
| `-d, --dest <product>`      | **必須。** 宛先製品: `claude`、`gemini`、`codex`、または `opencode`         |
| `-t, --type <type>`         | コンテンツタイプ: `commands`、`skills`、または `both`（デフォルト: `both`）  |
| `-f, --file <filename>`     | 特定のファイルのみ変換（`.md`, `.toml` 拡張子をサポート）                    |
| `-n, --noop`                | 変更を適用せずにプレビュー                                                 |
| `-v, --verbose`             | 詳細なデバッグ情報を表示                                                  |
| `--claude-dir <path>`       | Claude ベースディレクトリ（デフォルト: ~/.claude）                          |
| `--gemini-dir <path>`       | Gemini ベースディレクトリ（デフォルト: ~/.gemini）                          |
| `--codex-dir <path>`        | Codex ベースディレクトリ（デフォルト: ~/.codex）                           |
| `--opencode-dir <path>`     | OpenCode ベースディレクトリ（デフォルト: ~/.config/opencode）               |
| `--no-overwrite`            | ターゲットディレクトリの既存ファイルをスキップ                                |
| `--sync-delete`             | ターゲットディレクトリの孤立ファイルを削除                                   |
| `--remove-unsupported`      | ターゲット形式でサポートされていないフィールドを削除                           |

## 使用例

```bash
# プレビュー付きで全コマンドとスキルを変換
acsync -n -s claude -d gemini

# 特定のファイルを変換
acsync -s gemini -d claude -f analyze-code

# Skills のみ変換
acsync -s claude -d gemini -t skills

# 特定のスキルを変換
acsync -s claude -d gemini -t skills -f my-skill

# クリーンアップ付きの完全同期
acsync -s claude -d gemini --sync-delete --remove-unsupported

# カスタムディレクトリを使用（ベースディレクトリを指定、/commands と /skills は自動的に追加されます）
acsync -s claude -d gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# デバッグ用の詳細出力を表示
acsync -s claude -d gemini -v
```

## デフォルトのファイルの場所

### Commands
- **Claude Code**: `~/.claude/commands/*.md`
- **Gemini CLI**: `~/.gemini/commands/*.toml`
- **Codex CLI**: `~/.codex/prompts/*.md`
- **OpenCode**: `~/.config/opencode/commands/*.md`

### Skills
- **Claude Code**: `~/.claude/skills/<skill-name>/SKILL.md`
- **Gemini CLI**: `~/.gemini/skills/<skill-name>/SKILL.md`
- **Codex CLI**: `~/.codex/skills/<skill-name>/SKILL.md`
- **OpenCode**: `~/.config/opencode/skills/<skill-name>/SKILL.md`

## 形式比較と変換仕様

### Commands と Skills の違い

| 観点 | Commands | Skills |
| ---- | -------- | ------ |
| 構造 | 単一ファイル（`.md`, `.toml`） | ディレクトリ（`SKILL.md` + サポートファイル） |
| 場所 | `~/.{tool}/commands/` | `~/.{tool}/skills/<name>/` |
| 用途 | シンプルなプロンプト | 複数ファイルを伴う複雑なタスク |

---

## Commands 形式

### ファイル構造とメタデータ

| 機能                                      | Claude Code   | Gemini CLI    | Codex CLI     | OpenCode      | 変換メモ                                      |
| ----------------------------------------- | ------------- | ------------- | ------------- | ------------- | -------------------------------------------- |
| ファイル形式                               | Markdown      | TOML          | Markdown      | Markdown      | 自動変換                                     |
| コンテンツフィールド                        | 本文コンテンツ  | `prompt`      | 本文コンテンツ  | 本文コンテンツ  | メインコマンドの内容                           |
| 説明メタデータ                            | `description` | `description` | `description` | `description` | 形式間で保持                                  |
| `model`                                   | サポート       | -             | -             | サポート       | Claude/OpenCode間で保持                       |
| `allowed-tools`, `argument-hint`          | サポート       | -             | -             | -             | Claude固有（`--remove-unsupported`を使用して削除）|

### コンテンツプレースホルダーと構文

| 機能                  | Claude Code    | Gemini CLI     | Codex CLI      | OpenCode       | 変換動作                               |
| -------------------- | -------------- | -------------- | -------------- | -------------- | ------------------------------------- |
| すべての引数          | `$ARGUMENTS`   | `{{args}}`     | `$ARGUMENTS`   | `$ARGUMENTS`   | 形式間で変換                           |
| 個別引数              | `$1` ... `$9`  | -              | `$1` ... `$9`  | `$1` ... `$9`  | そのまま保持（Geminiはサポートなし）      |
| シェルコマンド        | `` !`command` ``| `!{command}`  | -              | `` !`command` ``| 形式間で変換                           |
| ファイル参照          | `@path/to/file`| `@{path/to/file}` | -           | `@path/to/file`| 形式間で変換                           |

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

Skills は Claude Code、Gemini CLI、Codex CLI、OpenCode が採用している [Agent Skills](https://agentskills.io/) オープンスタンダードに従います。

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

| フィールド | Claude Code | Gemini CLI | Codex CLI | OpenCode | 変換メモ |
| --------- | ----------- | ---------- | --------- | -------- | -------- |
| `name` | ✓ | ✓ | ✓ | ✓ | 必須 |
| `description` | ✓ | ✓ | ✓ | ✓ | 保持 |
| `argument-hint` | ✓ | - | - | - | Claude 固有 |
| `allowed-tools` | ✓ | - | - | - | Claude 固有 |
| `model` | ✓ | - | - | - | Claude 固有 |
| `context` | ✓ | - | - | - | Claude 固有（例: `"fork"`） |
| `agent` | ✓ | - | - | - | Claude 固有 |
| `hooks` | ✓ | - | - | - | Claude 固有（before/after/on_error） |
| `disable-model-invocation` | ✓ | - | ✓* | ✓** | 変換あり（下記参照） |
| `user-invocable` | ✓ | - | - | - | Claude 固有 |

\* Codex は `agents/openai.yaml` 内の `policy.allow_implicit_invocation` を使用（論理反転）
\*\* OpenCode は SKILL.md の frontmatter 内で `disable-model-invocation` を直接使用

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

| 機能 | Claude Code / Codex CLI / OpenCode | Gemini CLI |
| ---- | ---------------------------------- | ---------- |
| すべての引数 | `$ARGUMENTS` | `{{args}}` |
| 個別引数 | `$1` ... `$9` | サポートなし |
| シェルコマンド | `` !`command` `` | `!{command}` |
| ファイル参照 | `@path/to/file` | `@{path/to/file}` |

---

## 公式ドキュメント

### Commands
- [Slash commands - Claude Docs](https://docs.claude.com/en/docs/claude-code/slash-commands)
- [gemini-cli/docs/cli/custom-commands.md at main · google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md)
- [codex/docs/prompts.md at main · openai/codex](https://github.com/openai/codex/blob/main/docs/prompts.md)
- [OpenCode](https://opencode.ai/)

### Skills
- [Agent Skills Standard](https://agentskills.io/)
- [Custom skills - Claude Docs](https://docs.claude.com/en/docs/claude-code/custom-skills)

## ステータスインジケータ

- `[A]` 作成（緑） - ターゲットディレクトリに新規ファイル作成
- `[M]` 更新（黄） - 既存ファイルを更新
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
  semantic: SemanticProperties;         // 共有プロパティ（description, name 等）
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
