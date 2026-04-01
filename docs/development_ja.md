# 開発ガイド

<div align="center"> <a href="development.md">en</a> | ja </div>

## セットアップ

```bash
# 依存関係をインストール
pnpm install

# プロジェクトをビルド
pnpm build

# 開発モード（ウォッチ）
pnpm dev
```

## テスト

```bash
# 整形状態だけ確認
pnpm format:check

# ファイルを整形して保存
pnpm format

# lint の確認だけ実行
pnpm lint

# 自動修正と整形を適用してから検証
pnpm tidy

# 型チェック
pnpm typecheck

# テストを実行
pnpm test

# カバレッジ付きでテストを実行
pnpm test:coverage

# PR 前や CI 向けの総合検証
pnpm verify
```

## パブリッシング

```bash
# パッケージ内容を確認
pnpm pack --dry-run

# パッチバージョンを更新（1.0.0 → 1.0.1）
pnpm version patch

# マイナーバージョンを更新（1.0.0 → 1.1.0）
pnpm version minor

# メジャーバージョンを更新（1.0.0 → 2.0.0）
pnpm version major

# パッケージを公開
pnpm publish
```
