// BitCraft アイテム名 日本語⇔英語 変換テーブル
const ITEM_TRANSLATIONS = {
  // 木材系
  "木": "Wood",
  "木材": "Wood",
  "原木": "Log",
  "丸太": "Log",
  "板": "Plank",
  "板材": "Plank",
  "棒": "Stick",
  "枝": "Branch",
  "樹液": "Sap",
  "樹脂": "Resin",
  "松": "Pine",
  "松の木": "Pine",
  "松材": "Pine Wood",
  "オーク": "Oak",
  "オークの木": "Oak",
  "バーチ": "Birch",
  "白樺": "Birch",
  "マホガニー": "Mahogany",
  "チーク": "Teak",
  "エボニー": "Ebony",

  // 鉱石・金属系
  "石": "Stone",
  "岩": "Rock",
  "鉱石": "Ore",
  "石炭": "Coal",
  "銅": "Copper",
  "銅鉱石": "Copper Ore",
  "銅インゴット": "Copper Ingot",
  "鉄": "Iron",
  "鉄鉱石": "Iron Ore",
  "鉄インゴット": "Iron Ingot",
  "鉄棒": "Iron Bar",
  "銀": "Silver",
  "銀鉱石": "Silver Ore",
  "銀インゴット": "Silver Ingot",
  "金": "Gold",
  "金鉱石": "Gold Ore",
  "金インゴット": "Gold Ingot",
  "ミスリル": "Mithril",
  "ミスリル鉱石": "Mithril Ore",
  "アダマント": "Adamant",
  "鋼": "Steel",
  "鋼鉄": "Steel",
  "鋼インゴット": "Steel Ingot",
  "アストラライト": "Astralite",

  // 食料系
  "食料": "Food",
  "食べ物": "Food",
  "肉": "Meat",
  "魚": "Fish",
  "パン": "Bread",
  "小麦": "Wheat",
  "小麦粉": "Flour",
  "野菜": "Vegetable",
  "果物": "Fruit",
  "りんご": "Apple",
  "ベリー": "Berry",
  "キノコ": "Mushroom",
  "きのこ": "Mushroom",
  "ハーブ": "Herb",
  "スープ": "Soup",
  "料理": "Cooked",
  "干し肉": "Jerky",

  // 繊維系
  "繊維": "Fiber",
  "布": "Cloth",
  "糸": "Thread",
  "綿": "Cotton",
  "麻": "Flax",
  "亜麻": "Flax",
  "革": "Leather",
  "皮": "Hide",
  "毛皮": "Fur",
  "絹": "Silk",
  "羊毛": "Wool",

  // ツール系
  "ツール": "Tool",
  "道具": "Tool",
  "斧": "Axe",
  "つるはし": "Pickaxe",
  "ピッケル": "Pickaxe",
  "鍬": "Hoe",
  "鎌": "Sickle",
  "のこぎり": "Saw",
  "ハンマー": "Hammer",
  "錬金術": "Alchemy",

  // 武器系
  "武器": "Weapon",
  "剣": "Sword",
  "刀": "Sword",
  "弓": "Bow",
  "槍": "Spear",
  "盾": "Shield",
  "短剣": "Dagger",
  "大剣": "Greatsword",
  "弓矢": "Arrow",
  "矢": "Arrow",

  // 防具系
  "防具": "Armor",
  "鎧": "Armor",
  "兜": "Helmet",
  "胴鎧": "Chestplate",
  "脚鎧": "Leggings",
  "ブーツ": "Boots",
  "手袋": "Gloves",

  // 宝石・素材系
  "宝石": "Gem",
  "クリスタル": "Crystal",
  "水晶": "Crystal",
  "サファイア": "Sapphire",
  "ルビー": "Ruby",
  "エメラルド": "Emerald",
  "ダイヤ": "Diamond",
  "ダイヤモンド": "Diamond",
  "アメジスト": "Amethyst",

  // その他素材
  "砂": "Sand",
  "砂岩": "Sandstone",
  "粘土": "Clay",
  "土": "Dirt",
  "骨": "Bone",
  "羽根": "Feather",
  "羽": "Feather",
  "蜂蜜": "Honey",
  "蜜蝋": "Beeswax",
  "油": "Oil",
  "コイン": "Coin",
  "インゴット": "Ingot",
};

// 英語→日本語（逆引き用）
const ITEM_TRANSLATIONS_EN_JA = {};
for (const [ja, en] of Object.entries(ITEM_TRANSLATIONS)) {
  if (!ITEM_TRANSLATIONS_EN_JA[en]) {
    ITEM_TRANSLATIONS_EN_JA[en] = ja;
  }
}

/**
 * 日本語のクエリを英語に変換（部分一致）
 * 英語の場合はそのまま返す
 */
function translateQuery(query) {
  const q = query.trim();

  // 完全一致チェック
  if (ITEM_TRANSLATIONS[q]) return ITEM_TRANSLATIONS[q];

  // 部分一致チェック
  for (const [ja, en] of Object.entries(ITEM_TRANSLATIONS)) {
    if (q.includes(ja) || ja.includes(q)) {
      return en;
    }
  }

  // 英語の場合そのまま返す
  return q;
}

/**
 * 英語アイテム名に対応する日本語を返す（なければ英語のまま）
 */
function getJaName(enName) {
  return ITEM_TRANSLATIONS_EN_JA[enName] || null;
}
