// BitCraft アイテム名 日本語⇔英語 変換テーブル（BitCraft準拠）
const ITEM_TRANSLATIONS = {

  // ===== 素材品質プレフィックス =====
  "粗い": "Rough",
  "シンプル": "Simple",
  "ファイン": "Fine",
  "頑丈な": "Sturdy",
  "装飾的な": "Ornate",
  "卓越した": "Exquisite",
  "比類なき": "Peerless",
  "注入された": "Infused",

  // ===== 金属・鉱石系 =====
  "フェラライト": "Ferralith",
  "フェラライト鉱石": "Ferralith Ore Chunk",
  "フェラライト精鉱": "Ferralith Ore Concentrate",
  "フェラライトインゴット": "Ferralith Ingot",
  "フェラライト釘": "Ferralith Nails",
  "パイライト": "Pyrelite",
  "パイライト鉱石": "Pyrelite Ore Chunk",
  "パイライト精鉱": "Pyrelite Ore Concentrate",
  "パイライトインゴット": "Pyrelite Ingot",
  "ルミナイト": "Luminite",
  "ルミナイト鉱石": "Luminite Ore Chunk",
  "ルミナイトインゴット": "Luminite Ingot",
  "エレンバー": "Elenvar",
  "エレンバー鉱石": "Elenvar Ore Chunk",
  "エレンバーインゴット": "Elenvar Ingot",
  "エマリウム": "Emarium",
  "エマリウム鉱石": "Emarium Ore Chunk",
  "エマリウムインゴット": "Emarium Ingot",
  "ラシウム": "Rathium",
  "ラシウム鉱石": "Rathium Ore Chunk",
  "ラシウムインゴット": "Rathium Ingot",
  "オーラムマイト": "Aurumite",
  "オーラムマイトインゴット": "Aurumite Ingot",
  "アルジェント": "Argent",
  "アルジェント鉱石": "Argent Ore",
  "アルジェント粒": "Argent Nugget",
  "アルジェントインゴット": "Argent Ingot",
  "溶融パイライト": "Molten Ferralith",
  "溶融パイライト": "Molten Pyrelite",
  "溶融ルミナイト": "Molten Luminite",
  "溶融エレンバー": "Molten Elenvar",
  "古代金属破片": "Ancient Metal Fragments",
  "精製フェラライトインゴット": "Refined Ferralith Ingot",
  "精製エレンバーインゴット": "Refined Elenvar Ingot",

  // ===== 木材系 =====
  "木": "Wood Log",
  "木材": "Wood Log",
  "丸太": "Wood Log",
  "板": "Plank",
  "板材": "Plank",
  "棒": "Stick",
  "スティック": "Stick",
  "樹液": "Tree Sap",
  "樹脂": "Amber Resin",
  "琥珀樹脂": "Amber Resin",
  "剥いた木": "Stripped Wood",
  "材木": "Timber",
  "幹": "Trunk",
  "樹皮": "Tree Bark",
  "ピッチ": "Pitch",
  "松": "Pine",
  "松の種": "Pine Seed",
  "オーク": "Oak",
  "オークの種": "Oak Seed",
  "バーチ": "Birch",
  "白樺の種": "Birch Seed",
  "スプルース": "Spruce",
  "スプルースの種": "Spruce Seed",
  "ブナの種": "Beech Seed",
  "サイプレスの種": "Cypress Seed",
  "デンドロの種": "Dendro Seed",
  "木の磨き剤": "Wood Polish",

  // ===== 石材系 =====
  "石": "Stone Chunk",
  "石材": "Stone Chunk",
  "レンガ": "Brick",
  "砂利": "Pebbles",
  "砂": "Sand",
  "粘土": "Clay Lump",
  "石英": "Gypsite",
  "粗いレンガスラブ": "Rough Brick Slab",
  "未焼成レンガ": "Unfired Rough Brick",

  // ===== 繊維・革系 =====
  "革": "Leather",
  "皮": "Leather",
  "なめし革": "Tanned Pelt",
  "生皮": "Raw Pelt",
  "毛皮": "Fur",
  "動物の毛": "Animal Hair",
  "布": "Cloth",
  "布地": "Cloth",
  "クロス": "Cloth",
  "布ストリップ": "Cloth Strip",
  "繊維": "Plant Fiber",
  "植物繊維": "Plant Fiber",
  "ロープ": "Rope",
  "ウィスプウィーブ": "Wispweave",
  "ウィスプウィーブ繊維": "Wispweave Filament",
  "ウィスプウィーブの種": "Wispweave Seeds",
  "糸": "Spool Of Thread",
  "スプール": "Spool Of Thread",
  "藁": "Straw",
  "テキスタイル": "Textile",
  "タンニン": "Tannin",
  "なめし剤": "Tannin",
  "革処理剤": "Leather Treatment",
  "帆布": "Sail Cloth",
  "タープ": "Cloth Tarp",

  // ===== 宝石系 =====
  "宝石": "Gem",
  "ダイヤ": "Diamond",
  "ダイヤモンド": "Diamond",
  "ルビー": "Ruby",
  "エメラルド": "Emerald",
  "サファイア": "Sapphire",
  "ジオード": "Geode",
  "ブラクサイト": "Braxite",
  "ジプサイト": "Gypsite",
  "宝石付きリング": "Gem Encrusted Ring",
  "未カットダイヤ": "Uncut Rough Diamond",
  "未カットルビー": "Uncut Rough Ruby",
  "未カットエメラルド": "Uncut Rough Emerald",
  "未カットサファイア": "Uncut Rough Sapphire",

  // ===== 食料・農業系 =====
  "食料": "Food",
  "肉": "Raw Meat",
  "生肉": "Raw Meat",
  "魚": "Fish",
  "ベリー": "Berry",
  "きのこ": "Mushroom",
  "キノコ": "Mushroom",
  "スターバルブ": "Starbulb",
  "玉ねぎ": "Starbulb",
  "エンバーグレイン": "Embergrain",
  "穀物": "Embergrain",
  "小麦": "Embergrain",
  "生地": "Embergrain Dough",
  "パン": "Plain Bread",
  "砂糖": "Sugar",
  "塩": "Salt",
  "肥料": "Fertilizer",
  "植物の根": "Plant Roots",
  "野生の種": "Wild Grain Seeds",
  "作物油": "Crop Oil",
  "魚油": "Fish Oil",
  "食品廃棄物": "Food Waste",
  "花": "Flower",
  "スキッチ肉": "Cooked Skitch Meat",
  "焼き魚": "Plain Roasted Fish",
  "焼き肉": "Plain Roasted Meat",
  "肉サンド": "Plain Meat Sandwich",
  "マッシュバルブ": "Plain Mashed Bulbs",
  "お茶": "Plain Hot Tea",
  "冷茶": "Plain Chilling Tea",

  // ===== ポーション・消耗品系 =====
  "回復ポーション": "Healing Potion",
  "スタミナポーション": "Stamina Potion",
  "建築エリクサー": "Building Elixir",
  "採集エリクサー": "Gathering Elixir",
  "クラフトエリクサー": "Crafting Elixir",
  "触媒": "Chemical Catalyst",
  "インク": "Ink",
  "顔料": "Pigment",
  "ガラス瓶": "Glass Vial",
  "羊皮紙": "Parchment",
  "ファイアサンド": "Firesand",
  "金属溶剤": "Metal Solvent",
  "再鍛造溶剤": "Reforging Solvent",
  "土器ミックス": "Potter's Mix",
  "バーサーカーキノコ": "Berserker Mushroom",

  // ===== ツール系 =====
  "斧": "Axe",
  "つるはし": "Pickaxe",
  "ピッケル": "Pickaxe",
  "鍬": "Hoe",
  "ナイフ": "Knife",
  "マチェーテ": "Machete",
  "ノコギリ": "Saw",
  "ハンマー": "Hammer",
  "ノミ": "Chisel",
  "ロッド": "Rod",
  "羽根ペン": "Quill",
  "ハサミ": "Scissors",
  "弓": "Bow",
  "フリントツール": "Flint",

  // ===== 武器・防具系 =====
  "剣": "Shortsword",
  "ショートソード": "Shortsword",
  "クレイモア": "Claymore",
  "槍": "Spear",
  "盾": "Shield",
  "クロスボウ": "Crossbow",
  "短剣": "Daggers",
  "メイス": "Mace",
  "鎧": "Plated Armor",
  "デュエリスト鎧": "Duelist Armor",
  "ベルト": "Belt",
  "ブーツ": "Boots",
  "ブレーサー": "Bracers",
  "ヘルム": "Helm",
  "レッグガード": "Legguards",
  "アクセサリー": "Amulet",
  "ネックレス": "Amulet",
  "指輪": "Ring",

  // ===== 魚系 =====
  "ブライニーリナス": "Briny Linus",
  "ブライニーアルガス": "Briny Argus",
  "ブライニーグッピー": "Briny Guppi",
  "アズールセントロ": "Azure Centro",
  "アズールスフィラ": "Azure Sphyra",
  "アズールミニ": "Azure Minni",
  "グリーンホーンドロ": "Greenhorn Dolo",
  "グリーンホーンゴルブ": "Greenhorn Gorbu",
  "ムッディオンコル": "Muddy Oncor",
  "ムッディアウラトゥス": "Muddy Auratus",
  "フィレ": "Filet",
  "鱗": "Scale",
  "魚の切り身": "Filet",
  "エサ": "Bait",
  "撒き餌": "Chum",

  // ===== 動物・素材系 =====
  "ジャキル毛皮": "Jakyl Fur",
  "ジャキル牙": "Jakyl Fang",
  "スキッチ甲殻": "Chitin",
  "甲殻": "Chitin",
  "硬化した殻": "Hardened Shell",
  "刺": "Stinger",
  "致死毒針": "Deadly Stinger",
  "乾燥アラクニルの毒": "Dried Araknir Venom",
  "昆虫の翅": "Insect Wing",
  "アンブラ毛皮": "Umbura Fur",
  "アンブラ牙": "Umbura Fang",
  "結晶化したスライム": "Crystalized Slime",

  // ===== 建築・クラフト素材 =====
  "ガラス": "Glass",
  "空のバケツ": "Empty Bucket",
  "水入りバケツ": "Water Bucket",
  "スティック": "Stick",
  "釘": "Nails",
  "フレーム": "Frames",
  "ヘキサイトカプセル": "Hexite Capsule",
  "焚き火キット": "Campfire Kit",
  "植物スポット": "Potted",

  // ===== 研究・コーデックス =====
  "コーデックス": "Codex",
  "研究": "Research",
  "石版": "Stone Carvings",
  "石の図": "Stone Diagrams",
  "学習帳": "Study Journal",
  "布研究": "Cloth Research",
  "革研究": "Leather Research",
  "金属研究": "Metal Research",
  "石材研究": "Stone Research",
  "木材研究": "Wood Research",

  // ===== センチネル装備 =====
  "センチネルの剣": "Sentinel's Shortsword",
  "センチネルの槍": "Sentinel's Spear & Shield",
  "センチネルのクレイモア": "Sentinel's Claymore",
  "センチネルの紋章": "Sentinel's Insignia",

  // ===== その他 =====
  "ヘックスコイン": "Hex Coins",
  "コイン": "Hex Coins",
  "バウチャー": "Business Voucher",
  "ロストシップメント": "Lost Shipment",
  "帆": "Sail Cloth",
  "塩": "Salt",
  "砂糖": "Sugar",
};

// 英語→日本語（逆引き用）
const ITEM_TRANSLATIONS_EN_JA = {};
for (const [ja, en] of Object.entries(ITEM_TRANSLATIONS)) {
  if (!ITEM_TRANSLATIONS_EN_JA[en]) {
    ITEM_TRANSLATIONS_EN_JA[en] = ja;
  }
}

function translateQuery(query) {
  const q = query.trim();
  if (!q) return q;

  // 日本語が含まれているか判定
  const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(q);
  if (!hasJapanese) return q; // 英語ならそのまま

  // 完全一致
  if (ITEM_TRANSLATIONS[q]) return ITEM_TRANSLATIONS[q];

  // 部分一致（長いキーを優先）
  const sorted = Object.entries(ITEM_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [ja, en] of sorted) {
    if (q.includes(ja)) return en;
  }

  // 逆方向：入力がキーに含まれる場合（「パイ」→「ピュレライト」など）
  for (const [ja, en] of sorted) {
    if (ja.includes(q)) return en;
  }

  return q;
}

function getJaName(enName) {
  if (!enName) return null;
  // 完全一致のみ返す（部分一致は使わない）
  if (ITEM_TRANSLATIONS_EN_JA[enName]) return ITEM_TRANSLATIONS_EN_JA[enName];
  return null;
}
