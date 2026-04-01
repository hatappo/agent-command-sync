<div align="center"> <a href="README.md">en</a> | ja </div>

--------------------------------------------------------------------------------

# SK / agent-skill-porter

[![npm version](https://badge.fury.io/js/agent-skill-porter.svg)](https://www.npmjs.com/package/agent-skill-porter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI エージェント Skill のライフサイクル マネジメント CLI — 任意の Skill を追加・更新管理し、Claude Code などの多数のエージェント間でフォーマットを相互変換。設定ファイル不要、追加ファイルなしですぐ使えます。

<div align="center">
  <img src="demo/sk-demo-ja.svg" alt="SK Demo" width="800">
</div>

## インストール

```bash
pnpm add -g agent-skill-porter
```

## クイックスタート

### GitHub からスキルを追加

```bash
# スキルをローカルのプロジェクトにダウンロード
sk add https://github.com/anthropics/skills

# スキルの更新を確認
sk update -n

# スキルを最新に更新
sk update

# 特定のスキルを、特定のエージェント用ディレクトリへダウンロード (to ./.claude/skills/)
sk add https://github.com/anthropics/skills/tree/main/skills/skill-creator claude

# ユーザーレベル（グローバル）ディレクトリへ配置 (to ~/.claude/skills/）
sk add https://github.com/anthropics/skills/tree/main/skills/skill-creator claude -g

# ダウンロードせずにプレビューのみ（ドライラン）
sk add https://github.com/anthropics/skills -n
```

### スキルの形式と配置先を他のエージェント用に変換

```bash
# Claude のスキルを Gemini 用の形式・配置先に変換
sk sync claude gemini

# 逆方向にも変換可能
sk sync gemini claude

# ユーザーレベル（グローバル）ディレクトリのスキルを変換
sk sync gemini claude -g

# 適用前に変更をプレビュー
sk sync gemini claude -n
```

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

- **GitHub から追加** — `sk add` で GitHub リポジトリからスキルを直接取得
- **上流からの更新** — `sk update` でダウンロード済みスキルの上流変更をチェックし適用
- **スキル一覧** — `sk list` で全エージェントのスキルを一覧表示
- **スキル情報表示** — `sk info` でスキルのメタ情報とソースリンクを確認
- **来歴トラッキング** — ダウンロードや同期のたびにソース情報を `_from` に記録（`owner/repo@shortHash` 形式、デフォルト 7 文字の短縮 SHA。`--full-hash` でフル 40 文字 SHA も選択可能）。公開スキルに問題が発見された場合、影響を受けるローカルスキルを即座に追跡可能。`--no-provenance` で無効化
- **エージェント間フォーマット変換** — 7エージェント間でフォーマット差異を吸収したスキル変換
- **プレースホルダー変換** — `$ARGUMENTS` ↔ `{{args}}`、ファイル参照、シェルコマンドを自動変換
- **ドライランプレビュー** — `-n` で適用前に変更内容を確認
- **ロスレス変換 — Chimera Hub** — ラウンドトリップ変換でエージェント固有設定をすべて保持（[詳細](docs/chimera-hub-workflow_ja.md)）

## FAQ

### `_from` は何を表し、`--no-provenance` はいつ使えばよいのですか？

`_from` はスキルの取得元（通常は `owner/repo@shortHash`）を記録し、公開スキルに問題があったときにローカルへ影響があるか追跡しやすくします。**`--no-provenance`** は、そのようなメタデータをフロントマターに書き込みたくないときに使います。社内向けの複製や、リポジトリ参照を残したくないポリシーがある場合などです。

### なぜ `~/.claude` ではなく、リポジトリ配下に書き込まれるのですか？

`sk add`、`sk download`、`sk update`、`sk sync` は、デフォルトで**プロジェクトレベルのパス**を使います。Git リポジトリ内ならリポジトリルート基準（例: `<repo>/.claude/skills`）、Git リポジトリ外ならカレントディレクトリ基準（例: `./.claude/skills`）です。スキルをコードベースと一緒に管理しやすくするためです。ユーザーレベルのディレクトリに置きたい場合は **`-g` / `--global`** を、任意のベースパスなら **`--{agent}-dir`** を指定してください。詳しくは下の **ディレクトリ解決** の節を参照してください。

### なぜ `xxx.config.js` のような設定ファイルを採用しないのですか？

リポジトリのルートに、余計な設定ファイルを増やす設計にはしていません。**Zero config、no extra files**（設定不要・余計なファイルなし）が、この製品のコンセプトです。

### なぜ Vercel の agent-skills のように lock ファイルで provenance（来歴）を管理しないのですか？

同様に、リポジトリのルートに余計なファイルを増やしたくないためです。`SKILL.md` にはメタデータを載せる **YAML フロントマター** があります。そこに必要最小限の情報（例: `_from`）を足せば足ります。トークン消費もごく限定的です。**Zero config、no extra files** がこの製品のコンセプトです。

### `SKILL.md` の YAML フロントマターに独自のプロパティを追加してもよいのですか？

はい、問題ありません。[Agent Skills](https://agentskills.io/) の仕様はエージェント間で共通化されていますが、**標準で定義されていない YAML フロントマターのキーに制限はありません**。実運用でも各社のエージェントが独自のプロパティを持ち、未知のプロパティは基本的に無視されます。

また、その追加プロパティが消費するトークンは、通常 10〜20 トークン程度です。ひとつのプロジェクトで読み込まれるスキルが数十件あったとしても、影響はごく軽微です。

## サブコマンド

### `sk add <url> [to]`（エイリアス: `sk download`）— GitHub からスキルを追加

```bash
sk add https://github.com/anthropics/skills/tree/main/skills/skill-creator
sk add <url> gemini                       # Gemini のスキルディレクトリに配置
sk add <url> -g                           # 元のエージェントのパスを保ったままホームディレクトリ配下に配置
sk add <url> claude -g                    # グローバル Claude ディレクトリに配置
sk add <url> -n                           # ダウンロードせずにプレビュー
```

#### GitHub 認証

プライベートリポジトリからダウンロードするには [Personal access token](https://github.com/settings/tokens?type=beta) を設定してください。

```bash
export GITHUB_TOKEN=ghp_...
```

**トークン権限**: パブリックリポジトリは権限設定不要です。プライベートリポジトリの場合、対象リポジトリに **Contents: Read** 権限を付与してください。

### `sk update [skill-path]` — ダウンロード済みスキルを上流から更新

```bash
sk update                                 # 全エージェントスキルをチェック＆更新
sk update .claude/skills/my-skill         # 特定のスキルを更新
sk update skills/                         # パス配下の全スキルを更新
sk update -g                              # 代わりにユーザーレベルのディレクトリを対象にする
sk update -n                              # 更新チェックのみ（適用なし）
```

### `sk list`（エイリアス: `sk ls`）— スキル一覧を表示

```bash
sk list                                   # プロジェクトレベルのスキル一覧
sk list -g                                # グローバル（ユーザーレベル）のスキル一覧
```

### `sk info [skill-path]` — スキル情報を表示

```bash
sk info                                   # インタラクティブにスキルを選択して表示
sk info .claude/skills/my-skill           # スキル情報とソースリンクを表示
sk info .claude/skills/my-skill/SKILL.md  # SKILL.md パスの直接指定も可
```

### `sk sync <from> <to>` — エージェント間の直接変換

```bash
sk sync claude gemini                     # Claude → Gemini に変換
sk sync claude gemini -g                 # 代わりにユーザーレベルのディレクトリを使う
sk sync claude gemini -t commands          # Commands のみ
```

`sync` はデフォルトで **プロジェクトディレクトリ** を使います。

- Git リポジトリ内: リポジトリルート基準の `<repo>/.<agent>/...`
- Git リポジトリ外: カレントディレクトリ配下の `./.<agent>/...`

ユーザーレベルのディレクトリを対象にするには `-g` / `--global` を指定します。

### `sk import <agent>` / `sk apply <agent>` — ロスレス変換のワークフロー

```bash
sk import claude                          # Claude → Chimera Hub にインポート
sk import gemini -t commands              # Commands のみインポート
sk apply gemini                           # Chimera Hub → Gemini に適用
sk apply claude --remove-unsupported      # サポートされていないフィールドを削除
```

### `sk drift <agent>` / `sk plan <agent>` — プレビュー（ドライラン）

```bash
sk drift claude                           # インポートの変更をプレビュー
sk plan gemini                            # 適用の変更をプレビュー
```

### `sk migrate` — Chimera Hub ディレクトリを .acs/.asp から .agent-skill-porter に移行

```bash
sk migrate                                # .acs/.asp → .agent-skill-porter にリネーム（ユーザーレベル + プロジェクトレベル）
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
| `--chimera-dir <path>`      | Chimera Hub ベースディレクトリ（デフォルト: ~/.config/agent-skill-porter）  |

## 使用例

```bash
# プレビュー付きで直接変換
sk sync claude gemini -n

# 特定のファイルを変換
sk sync gemini claude -f analyze-code

# Chimera ハブワークフロー
sk import claude                          # Claude → Chimera にインポート
sk import gemini                          # Gemini → Chimera にインポート（マージ）
sk apply claude                           # Chimera → Claude に適用（Claude extras 付き）
sk apply gemini                           # Chimera → Gemini に適用（Gemini extras 付き）

# クリーンアップ付きの完全同期
sk sync claude gemini --sync-delete --remove-unsupported

# カスタムディレクトリを使用（ベースディレクトリを指定、/commands と /skills は自動的に追加されます）
sk sync claude gemini --claude-dir ~/my-claude --gemini-dir ~/my-gemini

# デバッグ用の詳細出力を表示
sk sync claude gemini -v
```

## ディレクトリ解決

`sk add`、`sk download`、`sk update`、`sk sync` はデフォルトで**プロジェクトレベル**のディレクトリを使用します。

- Git リポジトリ内: Git リポジトリルート基準（例: `<repo>/.claude`、`<repo>/.gemini`）
- Git リポジトリ外: カレントディレクトリ基準（例: `./.claude`、`./.gemini`）

ユーザーレベルのディレクトリを使用するには `-g`/`--global` を指定してください。

**優先順位:**
1. `--{agent}-dir`（カスタムディレクトリ） — 常に最優先
2. **プロジェクトレベル** — `add` / `download` / `update` / `sync` のデフォルト（`gitRoot` またはカレントディレクトリ）
3. **ユーザーレベル** — `-g` 指定時

### プロジェクトレベル（デフォルト）

| エージェント | Commands | Skills |
| ----------- | -------- | ------ |
| **Claude Code** | `<repo>/.claude/commands/*.md` | `<repo>/.claude/skills/<name>/SKILL.md` |
| **Gemini CLI** | `<repo>/.gemini/commands/*.toml` | `<repo>/.gemini/skills/<name>/SKILL.md` |
| **Codex CLI** | `<repo>/.codex/prompts/*.md` | `<repo>/.codex/skills/<name>/SKILL.md` |
| **OpenCode** | `<repo>/.config/opencode/commands/*.md` | `<repo>/.config/opencode/skills/<name>/SKILL.md` |
| **GitHub Copilot** | `<repo>/.copilot/prompts/*.prompt.md` | `<repo>/.copilot/skills/<name>/SKILL.md` |
| **Cursor** | `<repo>/.cursor/commands/*.md` | `<repo>/.cursor/skills/<name>/SKILL.md` |
| **Chimera** | `<repo>/.agent-skill-porter/commands/*.md` | `<repo>/.agent-skill-porter/skills/<name>/SKILL.md` |

### ユーザーレベル（`-g` 指定時）

| エージェント | Commands | Skills |
| ----------- | -------- | ------ |
| **Claude Code** | `~/.claude/commands/*.md` | `~/.claude/skills/<name>/SKILL.md` |
| **Gemini CLI** | `~/.gemini/commands/*.toml` | `~/.gemini/skills/<name>/SKILL.md` |
| **Codex CLI** | `~/.codex/prompts/*.md` | `~/.codex/skills/<name>/SKILL.md` |
| **OpenCode** | `~/.config/opencode/commands/*.md` | `~/.config/opencode/skills/<name>/SKILL.md` |
| **GitHub Copilot** | `~/.copilot/prompts/*.prompt.md` | `~/.copilot/skills/<name>/SKILL.md` |
| **Cursor** | `~/.cursor/commands/*.md` | `~/.cursor/skills/<name>/SKILL.md` |
| **Chimera** | `~/.config/agent-skill-porter/commands/*.md` | `~/.config/agent-skill-porter/skills/<name>/SKILL.md` |

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

[Commands](docs/advanced_ja.md#コンテンツプレースホルダーと構文) と同様：

| 機能 | Claude Code / Codex CLI / OpenCode | Gemini CLI | Copilot | Cursor |
| ---- | ---------------------------------- | ---------- | ------- | ------ |
| すべての引数 | `$ARGUMENTS` | `{{args}}` | サポートなし | サポートなし |
| 個別引数 | `$1` ... `$9` | サポートなし | サポートなし | サポートなし |
| シェルコマンド | `` !`command` `` | `!{command}` | サポートなし | サポートなし |
| ファイル参照 | `@path/to/file` | `@{path/to/file}` | サポートなし | サポートなし |

## 上級リファレンス

以下のトピックの詳細は [上級リファレンス](docs/advanced_ja.md) を参照してください：

- **ロスレス変換 — Chimera Hub** — ラウンドトリップ変換でエージェント固有設定をすべて保持（[詳細](docs/chimera-hub-workflow_ja.md)）
- **Commands** — 単一ファイルスラッシュコマンドの形式詳細、メタデータ比較、プレースホルダー構文
- **アーキテクチャ** — セマンティック IR 設計、ボディトークン化、ソースレイアウト

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

- Node.js >= 24.0.0
- pnpm >= 10

## 開発

ビルド、テスト、リント、パブリッシングの手順は [開発ガイド](docs/development_ja.md) を参照してください。

## CHANGELOG

[CHANGELOG_ja.md](CHANGELOG_ja.md)

> [!NOTE]
> `asp`、`acs`、および `agent-command-sync` コマンドは非推奨です。`sk` または `agent-skill-porter` を使用してください。

## ライセンス

MIT
