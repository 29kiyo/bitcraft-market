# BitCraft Market Search

BitCraftのマーケット情報をリアルタイムで検索・確認できるWebアプリです。

## 🔗 サイト
https://29kiyo.github.io/bitcraft-market/

## ✨ 機能
- アイテム名検索（日本語・英語対応、あいまい検索）
- 検索候補のオートサジェスト（アイコン・日英名・レア度表示）
- Tier・レア度・カテゴリー・注文種別でフィルタリング
- 名前なしでTier・レア度・カテゴリーだけでも検索可能
- 検索結果一覧表示（ページネーション付き）
- 詳細ページから一覧に戻った際のスクロール位置・検索条件の保持
- 売り・買い注文一覧（価格順ソート・ページネーション・タブ切り替え）
- 注文一覧のリージョン・領地名絞り込み（R~併記）
- 価格推移グラフ（24H・7D・30D切り替え）
- 取引量グラフ
- 需要と供給の表示
- 取引ログ（買い手・売り手・リージョン・価格・数量・合計）
- 取引ログのリージョン絞り込み
- スマートフォン対応

## 🛠 技術構成
- フロントエンド: HTML / CSS / JavaScript
- ホスティング: GitHub Pages
- APIプロキシ: Cloudflare Workers
- データ提供: [Bitjita API](https://bitjita.com)
- グラフ: [Chart.js](https://www.chartjs.org/)

## 🤖 開発について
このプロジェクトはClaude (Anthropic)を活用して開発しました。

## 🐛 不具合・要望
問題点や改善要望があれば [Issues](https://github.com/29kiyo/bitcraft-market/issues) からご連絡ください。
（翻訳ミスなど）

## ⚠️ 免責事項
- このサイトはClockwork Labsとは無関係です
- データはBitjita APIから取得しています

## 📄 ライセンス
MIT License
