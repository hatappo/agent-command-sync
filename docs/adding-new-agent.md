# 新しいエージェントの追加ガイド

agent-command-sync に新しいエージェント（ツール）を追加する際に必要な変更箇所を、ステップごとにまとめたドキュメントです。

## 前提知識

すべての変換は **SemanticIR** を経由するハブ&スポーク型アーキテクチャです。

```
Source Format → Parser → toIR() → SemanticIR → fromIR() → Target Format
```

新しいエージェントを追加する場合、**ペアワイズの変換器は不要**で、1組の `toIR()` / `fromIR()` を実装するだけで既存の全エージェントとの相互変換が自動的に有効になります。

---

## Step 1: 型定義

### `src/types/intermediate.ts`

`ProductType` union に新しいエージェント名を追加します。

```typescript
// Before
export type ProductType = "claude" | "gemini" | "codex" | "opencode";
// After
export type ProductType = "claude" | "gemini" | "codex" | "opencode" | "newagent";
```

`IntermediateConversionOptions` にカスタムディレクトリオプションを追加します。

```typescript
/** NewAgent base directory */
newagentDir?: string;
```

### `src/types/command.ts`

エージェント固有のコマンド型を追加します。

```typescript
export interface NewAgentCommand {
  // エージェントのコマンドファイル構造に合わせて定義
  frontmatter?: Record<string, unknown>;  // YAML frontmatter がある場合
  content: string;
  filePath: string;
}
```

### `src/types/skill.ts`

エージェント固有のスキル型を追加します。`SkillBase` を拡張するのが基本です。

```typescript
export interface NewAgentSkill extends SkillBase {
  frontmatter: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
  // エージェント固有の設定があればここに追加
}
```

### `src/types/index.ts`

3箇所を更新します。

1. **`CommandDirectories` インターフェース** に `newagent` キーを追加
2. **コマンド型の re-export** に新型を追加
3. **スキル型の re-export** に新型を追加

---

## Step 2: ボディパーサー

### `src/converters/newagent-body.ts` (新規作成)

プレースホルダー構文を定義します。

- Claude/Codex/OpenCode と**同じ構文**の場合: `_claude-codex-body.ts` からインポートして薄いラッパーを作成
- **独自構文**の場合: `PatternDef[]` と `PlaceholderSerializers` を独自に定義

```typescript
import type { BodySegment } from "../types/body-segment.js";
import { parseBody, serializeBody } from "../utils/body-segment-utils.js";
import { CLAUDE_CODEX_PATTERNS, CLAUDE_CODEX_SERIALIZERS } from "./_claude-codex-body.js";

// サポートしないプレースホルダータイプがあれば Set で定義
const UNSUPPORTED: ReadonlySet<ContentPlaceholder["type"]> = new Set([/* ... */]);

export function parseNewAgentBody(body: string): BodySegment[] {
  return parseBody(body, CLAUDE_CODEX_PATTERNS);
}

export function serializeNewAgentBody(segments: BodySegment[]): string {
  return serializeBody(segments, CLAUDE_CODEX_SERIALIZERS, UNSUPPORTED);
}
```

**ポイント:**
- unsupported セットに入れたプレースホルダーは、`serializeBody` 内で `NODE_DEBUG=acsync` 時に警告が出力されます
- セット未指定の場合はすべてのプレースホルダーがサポート扱いです

---

## Step 3: パーサー

### `src/parsers/newagent-parser.ts` (新規作成)

`Parser<T>` インターフェースを実装し、以下のメソッドを提供します。

| メソッド | 説明 |
|---------|------|
| `parse(filePath)` | ファイルを読み込み、エージェント固有型にパース |
| `validate(data)` | データのバリデーション |
| `stringify(command)` | エージェント固有型をファイル内容の文字列に変換 |

Markdown + YAML frontmatter 形式の場合は `gray-matter` を使用します（Codex/OpenCode パーサーを参考）。
TOML 形式の場合は `@iarna/toml` を使用します（Gemini パーサーを参考）。

### `src/parsers/newagent-skill-parser.ts` (新規作成)

`Parser<T>` に加えて `writeToDirectory()` メソッドも実装します。

| メソッド | 説明 |
|---------|------|
| `parse(dirPath)` | スキルディレクトリから読み込み |
| `validate(data)` | バリデーション |
| `stringify(skill)` | SKILL.md 形式に変換 |
| `writeToDirectory(skill, targetDir)` | スキルをディレクトリに書き出し |

**チェックリスト:**
- [ ] `isSkillDirectory()` で SKILL.md の存在を確認
- [ ] `collectSupportFiles()` でサポートファイルを収集
- [ ] エージェント固有の設定ファイルがある場合は個別にパース/書き出し（例: Codex の `agents/openai.yaml`）

---

## Step 4: コンバーター

### `src/converters/newagent-command-converter.ts` (新規作成)

`SemanticConverter<NewAgentCommand>` を実装します。

```typescript
export class NewAgentCommandConverter implements SemanticConverter<NewAgentCommand> {
  toIR(source: NewAgentCommand): SemanticIR { /* ... */ }
  fromIR(ir: SemanticIR, options?: ConverterOptions): NewAgentCommand { /* ... */ }
}
```

**`toIR()` の実装:**
1. `description` → `ir.semantic.description`
2. ボディ → `parseNewAgentBody()` で `ir.body` に
3. その他フィールド → `ir.extras` に
4. `ir.meta.sourceType` を設定

**`fromIR()` の実装:**
1. `ir.semantic.description` → エージェント固有のフィールド
2. `ir.body` → `serializeNewAgentBody()` でシリアライズ
3. `ir.extras` から他エージェント固有フィールドを処理:
   - `removeUnsupported` オプション時は `CLAUDE_COMMAND_FIELDS` に含まれるキーをスキップ
   - それ以外は frontmatter 等にパススルー

**`CLAUDE_COMMAND_FIELDS` の定義:**
ターゲットがサポートしないフィールドのリストを定義します。

```typescript
// 例: OpenCode は model をサポートするため、allowed-tools と argument-hint のみ
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint"] as const;

// 例: Codex は model もサポートしないため、3つ
const CLAUDE_COMMAND_FIELDS = ["allowed-tools", "argument-hint", "model"] as const;
```

### `src/converters/newagent-skill-converter.ts` (新規作成)

`SemanticConverter<NewAgentSkill>` を実装します。コマンドと同様の構造ですが、以下の追加考慮事項があります。

- **`_claude_` プレフィックス**: Claude 固有フィールドは `_claude_*` プレフィックス付きで frontmatter に保存（ラウンドトリップの忠実性のため）
- **`modelInvocationEnabled`**: セマンティックプロパティ。Claude の `disable-model-invocation` (反転) や Codex の `allow_implicit_invocation` と相互変換
- **`CLAUDE_SKILL_FIELDS`**: ターゲットがサポートしない Claude 固有スキルフィールドのリスト

---

## Step 5: ファイルユーティリティ

### `src/utils/file-utils.ts`

以下の箇所を更新します。

1. **`SkillDirectories` インターフェース** に `newagent` キーを追加
2. **`getCommandDirectories()`**: 引数に `newagentDir` を追加し、`newagent` のディレクトリ設定を返す
3. **`findCommandFiles()`**: `format` union に `"newagent"` を追加し、ディレクトリ解決に `newagent` 分岐を追加
4. **`findNewAgentCommands()`** 関数を追加（`findCommandFiles("newagent", ...)` のラッパー）
5. **`getSkillDirectories()`**: 同様に `newagentDir` を追加
6. **`findSkillDirs()`**: `format` union に `"newagent"` を追加
7. **`findNewAgentSkills()`** 関数を追加

**注意:** コマンドのサブディレクトリ名はエージェントにより異なります:
- Claude/Gemini/OpenCode: `commands/`
- Codex: `prompts/`

---

## Step 6: CLI 統合

### `src/cli/index.ts`

1. `--src` / `--dest` の説明文に新エージェント名を追加
2. `--newagent-dir` オプションを追加
3. `syncOptions` オブジェクトに `newagentDir` を追加
4. ヘルプの例に追加

### `src/cli/options.ts`

1. **`validateCLIOptions()`**: `source` / `destination` の有効値リストに追加
2. **`cliOptionsToConversionOptions()`**: `newagentDir` を追加

### `src/cli/sync.ts`

以下の **6つの関数** に新エージェントの分岐を追加します。

| 関数 | 追加箇所 |
|------|---------|
| `getSourceFiles()` | source 分岐 |
| `getSourceSkills()` | source 分岐 |
| `convertSingleFile()` | source 分岐 + destination 分岐 |
| `convertSingleSkill()` | source 分岐 + destination 分岐 |
| `handleSyncDelete()` | destination 分岐 |
| `handleSkillSyncDelete()` | destination 分岐 |

また、`getCommandDirectories()` / `getSkillDirectories()` の呼び出しに `options.newagentDir` を渡します。

**ヒント:** `directories[options.source].user` のように辞書アクセスパターンを使えば、source/target のディレクトリ解決を簡潔に書けます。

---

## Step 7: エクスポート

### `src/index.ts`

新規パーサー・コンバーターの re-export を追加します。

```typescript
export * from "./parsers/newagent-parser.js";
export * from "./converters/newagent-command-converter.js";
export * from "./converters/newagent-skill-converter.js";
```

---

## Step 8: テスト

### テストフィクスチャー (`tests/fixtures/`)

- `tests/fixtures/newagent-commands/` にサンプルコマンドファイルを配置
- `tests/fixtures/newagent-skills/test-skill/SKILL.md` にサンプルスキルを配置

### 新規テストファイル

| ファイル | テスト内容 |
|---------|-----------|
| `tests/parsers/newagent-parser.test.ts` | parse, validate, stringify |
| `tests/parsers/newagent-skill-parser.test.ts` | parse, validate, stringify, writeToDirectory |

### 既存テストへの追加

| ファイル | 追加テスト |
|---------|-----------|
| `tests/utils/body-segment-utils.test.ts` | `parseNewAgentBody` / `serializeNewAgentBody` |
| `tests/utils/file-utils.test.ts` | `findNewAgentCommands` / `findNewAgentSkills` |
| `tests/converters/command-conversion.test.ts` | 他エージェント ↔ NewAgent 変換 |
| `tests/converters/skill-conversion.test.ts` | 他エージェント ↔ NewAgent スキル変換 |
| `tests/integration/cli.test.ts` | エンドツーエンド変換テスト |
| `tests/fixtures/fixtures.test.ts` | バリデーションメッセージのアサーション更新 |

---

## Step 9: ドキュメント

### `CLAUDE.md`

以下のセクションを更新します。

- サポートフォーマット表（Commands / Skills）
- プレースホルダー変換表
- Claude 固有フィールドのセクション
- CLI オプションの例

---

## 変更ファイル一覧（チェックリスト）

### 新規作成

- [ ] `src/converters/newagent-body.ts`
- [ ] `src/converters/newagent-command-converter.ts`
- [ ] `src/converters/newagent-skill-converter.ts`
- [ ] `src/parsers/newagent-parser.ts`
- [ ] `src/parsers/newagent-skill-parser.ts`
- [ ] `tests/parsers/newagent-parser.test.ts`
- [ ] `tests/parsers/newagent-skill-parser.test.ts`
- [ ] `tests/fixtures/newagent-commands/*.md` (or `.toml`)
- [ ] `tests/fixtures/newagent-skills/test-skill/SKILL.md`

### 変更

- [ ] `src/types/intermediate.ts` — ProductType, IntermediateConversionOptions
- [ ] `src/types/command.ts` — 新コマンド型
- [ ] `src/types/skill.ts` — 新スキル型
- [ ] `src/types/index.ts` — CommandDirectories, re-exports
- [ ] `src/utils/file-utils.ts` — SkillDirectories, find 関数, ディレクトリ設定
- [ ] `src/cli/index.ts` — CLI オプション
- [ ] `src/cli/options.ts` — バリデーション, 変換
- [ ] `src/cli/sync.ts` — 6関数の分岐追加
- [ ] `src/index.ts` — エクスポート追加
- [ ] `tests/utils/body-segment-utils.test.ts`
- [ ] `tests/utils/file-utils.test.ts`
- [ ] `tests/converters/command-conversion.test.ts`
- [ ] `tests/converters/skill-conversion.test.ts`
- [ ] `tests/integration/cli.test.ts`
- [ ] `tests/fixtures/fixtures.test.ts`
- [ ] `CLAUDE.md`

### 検証コマンド

```bash
npm run lint && npm run lint:tsc && npm test && npm run build
```
