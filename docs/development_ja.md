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
# テストを実行
pnpm test

# カバレッジ付きでテストを実行
pnpm test:coverage
```

## リント & フォーマット

```bash
# コードのリントとフォーマット
pnpm lint
pnpm format

# 型チェック
pnpm lint:tsc
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
