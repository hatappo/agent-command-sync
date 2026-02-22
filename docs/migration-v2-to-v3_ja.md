# マイグレーションガイド: v2 → v3

## 概要

v3 はサブコマンドベースの CLI、Chimera ロスレス変換ハブ、GitHub Copilot / Cursor サポートを導入したメジャーリリースです。v2 からアップグレードする場合、最も重要な変更は **CLI がサブコマンド方式になった**ことです。

### v3 の主な変更点

- **サブコマンド CLI** — `acs sync`, `acs import`, `acs apply`, `acs drift`, `acs plan`, `acs status`, `acs version`
- **Chimera ハブ** — ロスレスなラウンドトリップ変換のための仮想エージェント（[詳細](chimera-hub-workflow.md)）
- **GitHub Copilot サポート** — `.prompt.md` + YAML フロントマター
- **Cursor サポート** — プレーン Markdown（フロントマターなし）
- **`acs status`** — Chimera ハブの状態を ASCII アート付きで表示
- **`acs version`** — バージョン番号を表示

---

## CLI コマンドの変更

### 直接変換

| v2 | v3 |
|----|-----|
| `acs -s claude -d gemini` | `acs sync -s claude -d gemini` |
| `acs -s claude -d gemini -t commands` | `acs sync -s claude -d gemini -t commands` |
| `acs -s claude -d gemini -n` | `acs sync -s claude -d gemini -n` |
| `acs -s claude -d gemini --remove-unsupported` | `acs sync -s claude -d gemini --remove-unsupported` |
| `acs -s claude -d gemini --no-overwrite` | `acs sync -s claude -d gemini --no-overwrite` |
| `acs -s claude -d gemini --sync-delete` | `acs sync -s claude -d gemini --sync-delete` |
| `acs -s claude -d gemini -f my-cmd` | `acs sync -s claude -d gemini -f my-cmd` |

要するに `acs` の後に `sync` を追加するだけです。既存のオプションはすべて `acs sync` 配下で引き続き使用できます。

### 新しいサブコマンド（Chimera ハブワークフロー）

Chimera ハブ操作の省略形サブコマンドです:

| サブコマンド | 等価コマンド | 説明 |
|------------|------------|------|
| `acs import claude` | `acs sync -s claude -d chimera` | Chimera ハブにインポート |
| `acs drift claude` | `acs sync -s claude -d chimera -n` | インポートのプレビュー（ドライラン） |
| `acs apply gemini` | `acs sync -s chimera -d gemini` | Chimera ハブからエージェントに適用 |
| `acs plan gemini` | `acs sync -s chimera -d gemini -n` | 適用のプレビュー（ドライラン） |

### 新しいユーティリティサブコマンド

| サブコマンド | 説明 |
|------------|------|
| `acs status` | Chimera ハブの状態、検出エージェント、ASCII アートを表示 |
| `acs version` | バージョン番号を表示 |

---

## サブコマンド別オプション対応表

| オプション | `sync` | `import` | `drift` | `apply` | `plan` |
|-----------|--------|----------|---------|---------|--------|
| `-t, --type` | Yes | Yes | Yes | Yes | Yes |
| `-f, --file` | Yes | Yes | Yes | Yes | Yes |
| `-v, --verbose` | Yes | Yes | Yes | Yes | Yes |
| `--remove-unsupported` | Yes | - | - | Yes | Yes |
| `--no-overwrite` | Yes | - | - | Yes | - |
| `--sync-delete` | Yes | - | - | Yes | - |
| `-n, --noop` | Yes | - | - | - | - |
| `--<agent>-dir` | Yes | Yes | Yes | Yes | Yes |

> `drift` と `plan` は本質的にドライランモードなので `-n` は不要です。
> `import` は常に Chimera をターゲットとするため、`--remove-unsupported` や `--sync-delete` は不要です。

---

## Chimera ハブ

Chimera ハブは v3 で導入された仮想エージェントで、変換ファイルを `~/.config/acsync/` に保存します。`_chimera.{agent}` フロントマターセクションにすべてのエージェント固有設定を**ロスレスに**保持します。

### 推奨ワークフロー

```bash
# 1. 各エージェントからハブにインポート
acs import claude
acs import gemini

# 2. ハブから各エージェントに適用
acs apply claude    # Claude 固有の設定が復元される
acs apply gemini    # Gemini 固有の設定が復元される
```

詳細は [Chimera ハブワークフロー](chimera-hub-workflow.md) を参照してください。

---

## 新しいエージェントサポート

### GitHub Copilot

- ファイル形式: `.prompt.md` + YAML フロントマター
- 場所: `~/.copilot/prompts/`
- スキル: `~/.copilot/skills/<name>/SKILL.md`
- 注意: Claude の `user-invocable`（**c**）の代わりに `user-invokable`（**k**）を使用。変換時に自動正規化

### Cursor

- ファイル形式: プレーン Markdown（フロントマターなし）
- 場所: `~/.cursor/commands/`
- スキル: `~/.cursor/skills/<name>/SKILL.md`
- 注意: Cursor への変換時にすべてのコマンドメタデータが失われます（フロントマター非対応）

---

## ドライランメッセージの変更

v2 では `--noop` フラグは常に以下を表示:

> This was a dry run. Use without --noop to apply changes.

v3 ではサブコマンドに応じたメッセージに変更:

| サブコマンド | メッセージ |
|------------|---------|
| `acs drift` | "This was a dry run. Use `acs import` to apply changes." |
| `acs plan` | "This was a dry run. Use `acs apply` to apply changes." |
| `acs sync -n` | "This was a dry run. Use without --noop to apply changes." |

---

## マイグレーションチェックリスト

1. `acs -s <src> -d <dest>` を `acs sync -s <src> -d <dest>` に置き換え
2. 複数エージェント環境では Chimera ハブワークフロー（`import` / `apply`）の導入を検討
3. `acs status` でハブの状態を確認
