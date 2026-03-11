# Chimera Hub ワークフロー

<div align="center"> <a href="chimera-hub-workflow.md">en</a> | ja </div>

## 概要

Chimera Hub はロスレス変換ハブです。エージェント固有の設定（例: `model`, `allowed-tools`）を `_chimera.{agent}` frontmatter セクションに保持し、エージェント間のラウンドトリップ変換の忠実性を実現します。

## アーキテクチャ

```
                        ┌──────────────────┐
                        │  Chimera (Hub)   │
                        │    ~/.config/asp       │
                        └────────┬─────────┘
                  ┌──────────────┴───────────────┐
                ▲ │                              │ ▲
   import/drift │ │ │                          │ │ │ import/drift
                │ │ │ apply/plan    apply/plan │ │ │
                  │ ▼                          ▼ │
         ┌────────┘                              └────────┐
         │                                                │
  ┌──────┴─────────┐                           ┌──────────┴───┐
  │  Claude Code   │   ◄────── sync ──────►    │  Codex CLI   │  ┌───┐  ┌───┐  ┌───┐
  │   ~/.claude    │                           │  ~/.codex    │  │   │  │   │  │   │  ...
  └────────────────┘                           └──────────────┘  └───┘  └───┘  └───┘

    ▲  asp import <agent>    agent → chimera            (shorthand for: asp sync <agent> chimera)
    ▲  asp drift  <agent>    agent → chimera, dry run   (shorthand for: asp sync <agent> chimera -n)
    ▼  asp apply  <agent>    chimera → agent            (shorthand for: asp sync chimera <agent>)
    ▼  asp plan   <agent>    chimera → agent, dry run   (shorthand for: asp sync chimera <agent> -n)
    ◄► asp sync X Y          direct conversion between agents
```

## コマンド

| コマンド | 方向 | 説明 |
|---------|------|------|
| `asp import <agent>` | agent → chimera | コマンド/スキルをハブにインポート |
| `asp drift <agent>` | agent → chimera | インポートの変更をプレビュー（ドライラン） |
| `asp apply <agent>` | chimera → agent | ハブのコマンド/スキルをエージェントに適用 |
| `asp plan <agent>` | chimera → agent | 適用の変更をプレビュー（ドライラン） |
| `asp sync X Y` | agent → agent | 直接変換（ハブをバイパス） |

## 典型的なワークフロー

```bash
# 1. 複数のエージェントから Chimera ハブにインポート
asp import claude
asp import gemini

# 2. 適用前に変更内容をプレビュー
asp plan codex

# 3. ターゲットエージェントに適用
asp apply codex
asp apply claude
```

## Chimera が Extras を保持する仕組み

Claude からインポートすると、エージェント固有フィールドは `_chimera.claude` に保存されます：

```yaml
---
description: "Review code"
_chimera:
  claude:
    allowed-tools: "Read,Write,Bash"
    model: "opus-4"
    argument-hint: "file path"
  gemini:
    some-gemini-field: value
---
Review $ARGUMENTS and suggest improvements.
```

特定のエージェントに適用すると、そのエージェントの extras のみが復元されます：

- `asp apply claude` → `allowed-tools`, `model`, `argument-hint` を復元
- `asp apply gemini` → `some-gemini-field` を復元
- `asp apply codex` → extras なし（セマンティックフィールドのみ）
