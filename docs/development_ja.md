# 開発ガイド

<div align="center"> <a href="development.md">en</a> | ja </div>

## セットアップ

```bash
# 依存関係をインストール
npm install

# プロジェクトをビルド
npm run build

# 開発モード（ウォッチ）
npm run dev
```

## テスト

```bash
# テストを実行
npm test

# カバレッジ付きでテストを実行
npm run test:coverage
```

## リント & フォーマット

```bash
# コードのリントとフォーマット
npm run lint
npm run format

# 型チェック
npm run lint:tsc
```

## パブリッシング

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
