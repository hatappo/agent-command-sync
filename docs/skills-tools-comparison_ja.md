# AI Agent Skills 管理ツール比較

AI コーディングエージェント（Claude Code, Gemini CLI, Codex CLI 等）の Skills を管理するツールの比較です。

## 目次

- [ツール一覧](#ツール一覧)
- [機能比較表](#機能比較表)
- [各ツールの詳細](#各ツールの詳細)
  - [skills.sh (Vercel)](#skillssh-vercel)
  - [agent-skills-cli](#agent-skills-cli)
  - [skillshare](#skillshare)
  - [.agents](#agents)
  - [agent-command-sync](#agent-command-sync)
- [ユースケース別おすすめ](#ユースケース別おすすめ)
- [参考リンク](#参考リンク)

---

## ツール一覧

| ツール | 開発元 | 主な用途 |
|--------|--------|----------|
| [skills.sh](https://skills.sh) | Vercel | Skills のパッケージマネージャー |
| [agent-skills-cli](https://github.com/Karanjot786/agent-skills-cli) | コミュニティ | マーケットプレイスからのインストール |
| [skillshare](https://github.com/runkids/skillshare) | コミュニティ | 宣言的スキル同期 |
| [.agents](https://github.com/amtiYo/agents) | コミュニティ | 統一設定管理 |
| [agent-command-sync](https://github.com/hatappo/agent-command-sync) | 個人 | フォーマット変換・双方向同期 |

---

## 機能比較表

### 基本機能

| 機能 | skills.sh | agent-skills-cli | skillshare | .agents | agent-command-sync |
|------|:---------:|:----------------:|:----------:|:-------:|:------------------:|
| Skills 対応 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Commands 対応 | - | - | - | - | ✓ |
| マーケットプレイス | ✓ | ✓ | ✓ | - | - |
| ローカルスキル管理 | △ | △ | ✓ | ✓ | ✓ |
| ローカル編集→再配布 | - | - | ✓ (Symlink) | ✓ (Symlink) | ✓ (コピー) |
| 双方向同期 | - | - | ✓ | ✓ | ✓ |
| フォーマット変換 | - | - | - | - | ✓ |

### 技術的特徴

| 特徴 | skills.sh | agent-skills-cli | skillshare | .agents | agent-command-sync |
|------|:---------:|:----------------:|:----------:|:-------:|:------------------:|
| 配布方式 | コピー | コピー | Symlink | Symlink | コピー |
| 実行環境 | Node.js | Node.js | Go | Node.js | Node.js |
| Web UI | - | - | ✓ | - | - |
| セキュリティ監査 | ✓ | - | ✓ | - | - |
| Git 連携 | - | - | ✓ | ✓ | - |
| オフライン動作 | - | - | ✓ | ✓ | ✓ |

### 対応プラットフォーム

| ツール | Claude Code | Gemini CLI | Codex CLI | Cursor | GitHub Copilot | Windsurf | Cline | Zed | OpenCode | Antigravity | 合計 |
|--------|:-----------:|:----------:|:---------:|:------:|:--------------:|:--------:|:-----:|:---:|:--------:|:-----------:|:----:|
| skills.sh | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 37+ |
| agent-skills-cli | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ | 42+ |
| skillshare | ✓ | - | - | - | - | - | - | - | ✓ | - | 49+ |
| .agents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | ✓ | ✓ | 8+ |
| agent-command-sync | ✓ | ✓ | ✓ | - | - | - | - | - | - | - | 3 |

---

## 各ツールの詳細

### skills.sh (Vercel)

**コンセプト**: "npm for AI agents" - Skills のパッケージマネージャー

**インストール**:
```bash
npx skills add <package>
```

**主な機能**:
- skills.sh からスキルを検索・インストール
- ローカルパスからのインストール対応
- 安全性検証（Safe/Low Risk/High Risk/Critical Risk）

**特徴**:
- Vercel 公式サポート
- 大規模なエコシステム
- セキュリティパートナーシップ（Gen との提携）

**制限**:
- インストール主体（編集・再配布のワークフローは弱い）
- 中央レジストリ依存

**公式サイト**: https://skills.sh

---

### agent-skills-cli

**コンセプト**: 40,000+ スキルを 42 エージェントに同期

**インストール**:
```bash
npm install -g agent-skills-cli
```

**主なコマンド**:
```bash
skills search <query>     # スキル検索
skills install <name>     # インストール
skills init <name>        # 新規スキル作成
skills validate <path>    # SKILL.md 検証
skills export             # エージェントへエクスポート
skills sync               # Antigravity ワークフローへ同期
```

**特徴**:
- FZF スタイルのインタラクティブ検索
- 4次元品質スコアリング（構造/明確さ/具体性/高度な機能）
- `.skillsrc` による企業向けカスタマイズ
- `skills.lock` による決定論的インストール追跡

**制限**:
- SkillsMP マーケットプレイス中心
- ローカル編集→再配布のワークフローは限定的

**リポジトリ**: https://github.com/Karanjot786/agent-skills-cli

---

### skillshare

**コンセプト**: 宣言的スキル同期 - 一つのソースから全ツールへ

**インストール**:
```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/runkids/skillshare/main/install.sh | sh

# Homebrew
brew install runkids/tap/skillshare
```

**主なコマンド**:
```bash
skillshare init           # 初期化
skillshare new            # 新規スキル作成
skillshare sync           # 全ターゲットへ配布
skillshare collect        # ターゲットから回収
skillshare diff           # 差分確認
skillshare audit          # セキュリティ監査
skillshare ui             # Web ダッシュボード起動
skillshare push/pull      # Git 連携でマシン間同期
```

**特徴**:
- **Web UI**: `skillshare ui` でダッシュボード起動（http://127.0.0.1:19420）
- **双方向同期**: `sync`（配布）と `collect`（回収）
- **セキュリティ監査**: プロンプトインジェクション検出
- **Go 製シングルバイナリ**: Node.js 不要
- **非破壊マージ**: 既存スキルを上書きしない

**制限**:
- **Symlink 方式**: クロスデバイス問題、Git 管理の複雑さ
- フォーマット変換なし（共通形式前提）

**リポジトリ**: https://github.com/runkids/skillshare

---

### .agents

**コンセプト**: 統一設定ファイルで MCP/Skills/Instructions を一元管理

**インストール**:
```bash
npm install -g @anthropic/agents
# または
npx @anthropic/agents init
```

**主な機能**:
- `.agents/agents.json` で全ツールの設定を一元管理
- MCP サーバー、Skills、Instructions の統合
- シークレット管理（`local.json` 分離）
- ツール固有ルーティング

**特徴**:
- **宣言的設定**: 一つの設定ファイルで全ツール管理
- **シークレット分離**: 機密情報を `.gitignore` 対象に自動分離
- **MCP 対応**: Model Context Protocol サーバーも管理

**制限**:
- **Symlink 方式**: `.agents/skills/` から各ツールへ symlink
- Skills 配布に特化（フォーマット変換なし）

**リポジトリ**: https://github.com/amtiYo/agents

---

### agent-command-sync

**コンセプト**: フォーマット変換 + 実ファイルコピーによる双方向同期

**インストール**:
```bash
npm install -g agent-command-sync
```

**主なコマンド**:
```bash
# Commands 同期
acs sync claude gemini                  # Claude → Gemini
acs sync gemini claude                  # Gemini → Claude

# Skills 同期
acs sync claude codex -t skills         # Skills のみ
acs sync claude gemini -t both          # Commands + Skills

# オプション
acs sync claude gemini -n               # ドライラン（プレビュー）
acs sync claude gemini -f my-skill      # 特定スキルのみ
acs sync claude gemini --sync-delete    # 孤立ファイル削除
```

**特徴**:
- **実ファイルコピー**: Symlink を使わず独立したファイルとして配布
- **フォーマット変換**:
  - Commands: Markdown ↔ TOML 変換
  - プレースホルダー: `$ARGUMENTS` ↔ `{{args}}`
  - ツール固有設定: `disable-model-invocation` ↔ `openai.yaml`
- **Commands + Skills 両対応**: レガシー Commands と新しい Skills の両方を管理
- **オフライン完結**: 外部サービス不要
- **Git フレンドリー**: 各ツールのディレクトリで普通に追跡可能

**制限**:
- マーケットプレイス機能なし
- Web UI なし
- 対応プラットフォームが限定的（Claude/Gemini/Codex）

**リポジトリ**: https://github.com/hatappo/agent-command-sync

---

## ユースケース別おすすめ

### 「コミュニティのスキルを手軽にインストールしたい」
→ **skills.sh** または **agent-skills-cli**

大規模なマーケットプレイスから検索・インストールが簡単。セキュリティ検証もあり安心。

### 「チームで統一したスキル環境を構築したい」
→ **skillshare** または **.agents**

宣言的な設定ファイルで環境を定義し、チーム全体で共有可能。Git 連携でバージョン管理も容易。

### 「ローカルで編集したスキルを各ツールに配布したい（Symlink なし）」
→ **agent-command-sync**

実ファイルとしてコピーするため、Symlink の問題を回避。Git での追跡も自然。

### 「Claude/Gemini/Codex 間でフォーマット変換が必要」
→ **agent-command-sync**

唯一フォーマット変換に対応。Commands（レガシー）から Skills への移行にも使用可能。

### 「GUI で視覚的に管理したい」
→ **skillshare**

Web ダッシュボードでスキルの一覧、同期状況、監査結果を確認可能。

---

## 参考リンク

### 公式ドキュメント
- [Agent Skills Standard](https://agentskills.io/)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Codex CLI Skills](https://developers.openai.com/codex/skills/)
- [Gemini CLI Skills](https://geminicli.com/docs/cli/skills/)

### ツール
- [skills.sh](https://skills.sh)
- [agent-skills-cli](https://github.com/Karanjot786/agent-skills-cli)
- [skillshare](https://github.com/runkids/skillshare)
- [.agents](https://github.com/amtiYo/agents)
- [agent-command-sync](https://github.com/hatappo/agent-command-sync)

### コミュニティ
- [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)
- [SkillsMP Marketplace](https://skillsmp.com)

---

*最終更新: 2026年2月*
