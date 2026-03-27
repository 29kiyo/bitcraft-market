# BitCraft Market Search

BitCraftのマーケット情報をリアルタイムで検索・確認できるWebアプリです。

## 🔗 サイト
https://29kiyo.github.io/bitcraft-market/

## ✨ 機能
- アイテム名検索（日本語・英語対応、あいまい検索）
- 検索候補のオートサジェスト（アイコン・日英名・レア度表示）
- Tier・レア度・カテゴリーの複数選択フィルター
- フィルター一括クリアボタン
- 名前なしでフィルターだけでも検索可能
- 検索結果一覧表示（ページネーション付き）
- 詳細ページから一覧に戻った際のスクロール位置・検索条件の保持
- 売り・買い注文一覧（価格順ソート・ページネーション・タブ切り替え）
- 注文一覧のリージョン・領地名絞り込み
- 価格情報・需要と供給のリージョン別表示
- 価格推移グラフ（24H・7D・30D切り替え）
- 取引量グラフ
- 取引ログ（直近最大50件蓄積・リージョン絞り込み）
- スマートフォン対応

## 🗂️ カテゴリー一覧
🪵 木材・建材 / ⛏ 鉱石・金属 / 🧵 繊維・革 / 🍖 食料 / 🐟 魚 / 💎 宝石・素材 / ⚗️ ポーション・消耗品 / 🔧 ツール / ⚔️ 武器・防具 / 📚 研究・知識 / 🏠 家具・装飾 / 🌿 農業 / 🗡️ ダンジョン / 🪨 石材 / 🏗️ 建築素材 / 🔨 クラフト素材 / 🐾 動物 / 📦 その他

## 🛠 技術構成
- フロントエンド: HTML / CSS / JavaScript
- ホスティング: GitHub Pages
- APIプロキシ: Cloudflare Workers
- データ提供: [Bitjita API](https://bitjita.com)
- グラフ: [Chart.js](https://www.chartjs.org/)

## 🌐 外部通信
本ツールは以下の外部サービスと通信を行います。
- **Bitjita API**: マーケットデータの取得 → [https://bitjita.com/docs/api](https://bitjita.com/docs/api)
- **Cloudflare Workers**: CORSプロキシ経由でAPIにアクセス → [https://bitcraft-proxy.29kiyo.workers.dev](https://bitcraft-proxy.29kiyo.workers.dev)

収集・保存する個人情報はありません。

### Cloudflare Workers ソースコード
CORSプロキシのソースコードは以下の通りです。

```javascript
const BITJITA_BASE = 'https://bitjita.com/api';
const ALLOWED_ORIGINS = ['https://29kiyo.github.io'];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiPath = url.pathname.replace(/^\/?api/, '');
    const targetUrl = `${BITJITA_BASE}${apiPath}${url.search}`;

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'bitcraft-market-search/1.0',
          'x-app-identifier': 'bitcraft-market-search-github-pages',
          'Accept': 'application/json',
        },
      });
      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-identifier',
  };
}
```

### アクセス制限
Cloudflare WorkersはOriginヘッダーによるアクセス制限を行っています。
`https://29kiyo.github.io`
以外からのアクセスは拒否されます。

## 🤖 開発について
このプロジェクトはClaude (Anthropic)を活用して開発しました。

## 🐛 不具合・要望
問題点や改善要望があれば [Issues](https://github.com/29kiyo/bitcraft-market/issues) からご連絡ください。
（翻訳ミス、カテゴリ分けが間違っている等）

## ⚠️ 免責事項
- このサイトはClockwork Labsとは無関係です
- データはBitjita APIから取得しています
- ツールの利用は自己責任でお願いします

## 📄 ライセンス
MIT License
