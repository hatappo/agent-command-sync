# マイグレーションガイド: v3 → v4

## 概要

v4 は Git リポジトリ内での**デフォルトディレクトリスコープ**をユーザーレベルからプロジェクトレベルに変更したメジャーリリースです。`acs download` サブコマンドと `_from` プロバナンストラッキングも追加されています。

### v4 の主な変更点

- **プロジェクトレベルがデフォルト** — Git リポジトリ内では `~/.claude/` ではなく `<repo>/.claude/` を使用
- **`-g` / `--global` オプション** — v3 のようにユーザーレベル（グローバル）ディレクトリを強制
- **`acs download`** — GitHub からスキルを直接ダウンロード
- **`_from` プロバナンス** — コマンドやスキルの出所を追跡
- **`acs status` の改善** — User/Project レベルの統計とエージェント数を表示

---

## 破壊的変更: プロジェクトレベルディレクトリ

### 変更前（v3）

すべてのコマンドがユーザーレベルディレクトリをデフォルトで使用:

```bash
acs sync -s claude -d gemini    # 常に ~/.claude/ → ~/.gemini/ を使用
```

### 変更後（v4）

Git リポジトリ内では、プロジェクトレベルディレクトリがデフォルト:

```bash
acs sync -s claude -d gemini    # <repo>/.claude/ → <repo>/.gemini/ を使用
acs sync -s claude -d gemini -g # ~/.claude/ → ~/.gemini/ を使用（v3 の動作）
```

Git リポジトリ外では、動作は変わりません（ユーザーレベル）。

### ディレクトリ解決の優先順位

```
1. --{agent}-dir（カスタムディレクトリ、最優先）
2. プロジェクトレベル（Git リポジトリルート、リポジトリ内でのデフォルト）
3. ユーザーレベル（グローバル、リポジトリ外または -g 指定時のデフォルト）
```

### エージェント別プロジェクトレベルディレクトリ

| エージェント | プロジェクトレベル | ユーザーレベル（`-g`） |
|------------|-----------------|---------------------|
| Claude | `<repo>/.claude/` | `~/.claude/` |
| Gemini | `<repo>/.gemini/` | `~/.gemini/` |
| Codex | `<repo>/.codex/` | `~/.codex/` |
| OpenCode | `<repo>/.opencode/` | `~/.config/opencode/` |
| Copilot | `<repo>/.github/` | `~/.copilot/` |
| Cursor | `<repo>/.cursor/` | `~/.cursor/` |
| Chimera | `<repo>/.acs/` | `~/.config/acs/` |

### モード表示

出力にアクティブなモードが表示されるようになりました:

```
Starting claude → gemini conversion... [project: /path/to/repo]
Starting claude → gemini conversion... [global]
```

---

## `-g` / `--global` オプション

`-g`（または `--global`）オプションはユーザーレベルのディレクトリ解決を強制し、v3 のデフォルト動作を復元します。すべてのサブコマンドで利用可能:

```bash
acs sync -s claude -d gemini -g
acs import claude -g
acs apply gemini -g
acs drift claude -g
acs plan gemini -g
acs status -g
acs download <url> -d claude -g
```

---

## `acs download` サブコマンド

GitHub リポジトリからスキルを直接ダウンロード:

```bash
# プロジェクトレベルディレクトリにダウンロード（URL パスから推定）
acs download https://github.com/owner/repo/tree/main/.claude/skills/my-skill

# 指定エージェントのスキルディレクトリに配置
acs download <url> -d gemini

# グローバル（ユーザーレベル）ディレクトリにダウンロード（-d が必須）
acs download <url> -d claude -g

# ドライラン
acs download <url> -n
```

### 対応 URL 形式

- **ディレクトリ**: `https://github.com/owner/repo/tree/branch/path/to/skill`
- **ファイル**: `https://github.com/owner/repo/blob/branch/path/to/file`（親ディレクトリを自動検出）

### 認証

GitHub API のレート制限を回避するには `GITHUB_TOKEN` 環境変数を設定してください（オプション）。

---

## `_from` プロバナンストラッキング

コマンドとスキルが `_from` フロントマタープロパティで出所を追跡するようになりました:

- **sync 時**: ソースリポジトリの GitHub リモート URL を自動付与（利用可能な場合）
- **download 時**: ダウンロード URL を `SKILL.md` に注入

```yaml
---
description: My command
_from:
  - https://github.com/owner/repo
---
```

- URL の配列として保存（重複は追加されない）
- `SemanticIR` を通じて変換時に保持
- `--remove-unsupported` では削除されない
- 注意: Cursor コマンドへの変換時は失われる（フロントマター非対応）

---

## `acs status` の改善

### v3

```
        .──────────────────────.
       (  3 commands, 2 skills  )
        '-.────────────────────'
```

### v4

User/Project レベルの統計とエージェント数を表示:

**Git リポジトリ内（2行）:**
```
        .───────────────────────────────────────────.
       (  User:    3 commands, 2 skills (2 agents)   )
       (  Project: 8 commands, 5 skills (4 agents)   )
        '-.─────────────────────────────────────────'
```

**Git リポジトリ外（1行）:**
```
        .──────────────────────────────────────.
       (  User: 3 commands, 2 skills (2 agents) )
        '-.────────────────────────────────────'
```

Chimera レベルは実際に検出されたエージェント数に基づくようになりました。

---

## API の破壊的変更

`agent-command-sync` をライブラリとして使用している場合:

| v3 | v4 |
|----|-----|
| `resolveCommandDir()` は `{ project, user }` を返す | 解決済みの `string` を返す |
| `resolveSkillDir()` は `{ project, user }` を返す | 解決済みの `string` を返す |

`DirResolutionContext` 型で解決されるディレクトリを制御します。

---

## マイグレーションチェックリスト

1. **Git リポジトリ内でユーザーレベルディレクトリに依存していた場合**: コマンドに `-g` を追加
2. **スクリプトやエイリアス**: ユーザーレベルディレクトリを前提としていた自動化を更新
3. `acs download` でスキルの簡単な共有を試す
4. `acs status` で User/Project レベルの概要を確認
