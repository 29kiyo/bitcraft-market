まだ完成してません

# BitCraft Market Search

BitCraft のマーケット情報を日本語・英語で検索できるWebサイトです。

[Bitjita API](https://bitjita.com/docs/api) を使用しています。

## 機能

- 🔍 アイテム名検索（日本語・英語対応）
- 💰 価格情報（最低売値・最高買値・24h/7d平均・取引量）
- 📊 需要と供給の可視化
- 📋 売り/買い注文一覧（領地名・座標・リージョン）
- 🗺 領地マップ（SVGビジュアライザー + BitCraft Mapリンク）
- 🔧 フィルター（Tier・カテゴリ・注文種別）

## 使い方

1. 検索ボックスにアイテム名を入力（例：「革」「lether」）
2. Tier・カテゴリでフィルタリング
3. 結果からマップで領地の位置を確認
4. 「BitCraft Mapで開く」ボタンで詳細マップへ

## セットアップ (GitHub Pages)

1. このリポジトリをFork
2. Settings → Pages → Source: `main` ブランチの `/root` を選択
3. `https://<username>.github.io/<repo-name>` でアクセス

## 技術スタック

- HTML / CSS / JavaScript（フレームワーク不要）
- [Bitjita API](https://bitjita.com/docs/api)
- GitHub Pages

## 注意

- Bitjita API に非公式ツールとして接続しています
- `x-app-identifier` ヘッダーを設定済みです
- レート制限: 250リクエスト/分

