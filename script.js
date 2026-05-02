// ============================================
// BitCraft Market Search - script.js
// ============================================

const API_BASE = 'https://bitcraft-proxy.29kiyo.workers.dev/api';
const HEADERS = { 'x-app-identifier': 'bitcraft-market-search-github-pages' };

// ============================================
// アイコンキャッシュ
// ============================================
const iconCache = new Map();
function getCachedIcon(iconAssetName) {
  if (!iconAssetName) return '';
  if (iconCache.has(iconAssetName)) return iconCache.get(iconAssetName);

  let path = iconAssetName;

  // 二重パス修正: GeneratedIcons/Other/GeneratedIcons/ → GeneratedIcons/
  path = path.replace('GeneratedIcons/Other/GeneratedIcons/', 'GeneratedIcons/');

  // プレフィックスに応じてパスを正規化
  if (path.startsWith('Items/') || path.startsWith('Resources/')) {
    // Items/ Resources/ → GeneratedIcons/ を付与
    path = 'GeneratedIcons/' + path;
  } else if (path.startsWith('PremiumItems/')) {
    // PremiumItems/ → GeneratedIcons/ を付与
    path = 'GeneratedIcons/' + path;
  } else if (path.startsWith('Emotes/')) {
    // Emotes/ → GeneratedIcons/ を付与
    path = 'GeneratedIcons/' + path;
  }
  // GeneratedIcons/ PremiumIcons/ はそのまま

  // スペースを%20に変換
  path = path.replace(/ /g, '%20');

  const url = `https://bitjita.com/${path}.webp`;
  iconCache.set(iconAssetName, url);
  return url;
}
// ============================================
// マーケットデータキャッシュ（1時間）
// ============================================
const CACHE_CLEAR_INTERVAL = 60 * 60 * 1000;
let cacheClearTimer = null;
let cachedMarketItems = null;
let fetchPromise = null;

function clearCaches() {
  iconCache.clear();
  cachedMarketItems = null;
  fetchPromise = null;
}

function startCacheClearTimer() {
  if (cacheClearTimer) clearTimeout(cacheClearTimer);
  cacheClearTimer = setTimeout(() => {
    clearCaches();
    startCacheClearTimer();
  }, CACHE_CLEAR_INTERVAL);
}
startCacheClearTimer();
window.addEventListener('pagehide', clearCaches);

// アプリ起動時にバックグラウンドでマーケットデータを取得
window.addEventListener('load', () => {
  // 少し遅延させて、ページの表示を優先
  setTimeout(() => {
    fetchAllMarketItems().catch(() => {});
  }, 1000);
});

async function fetchAllMarketItems() {
  if (cachedMarketItems) return cachedMarketItems;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const res = await fetch(`${API_BASE}/market?hasOrders=true&limit=2000`, { headers: HEADERS });
    if (!res.ok) throw new Error('fetch failed');
    const json = await res.json();
    cachedMarketItems = json?.data?.items || [];
    return cachedMarketItems;
  })();
  return fetchPromise;
}

// ============================================
// DOM要素
// ============================================
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const suggestions = document.getElementById('suggestions');
const resultSection = document.getElementById('resultSection');
const emptyState = document.getElementById('emptyState');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const searchResults = document.getElementById('searchResults');
const searchResultsList = document.getElementById('searchResultsList');
const backBtn = document.getElementById('backBtn');

// ============================================
// 状態
// ============================================
let currentItems = [];
let currentPage = 1;
let savedScrollPosition = 0;
let currentOrderPage = 1;
const ORDERS_PER_PAGE = 7;
const ITEMS_PER_PAGE = 20;
let currentOrderSort = 'asc';
let craftCurrentPage = 1;
const craftItemsPerPage = 12;
let craftCurrentQuantity = 1;
let craftSelectedItem = null;
let craftSelectedItems = []; // 複数選択用
let craftMultiSelectMode = false; // 複数選択モードフラグ
const craftRecipeIndex = {};
// APIタグ→チェックボックスvalue の正規化マップ
const TAG_NORMALIZE = { 'Precious Metal Concentrate': 'Ore Concentrate',
                        'uggo':'ugo',
                        'Profession Dungeon Loot':'Dungeon Loot',
                      };
let selectedRegion = '';
let currentOrderRegion = '';
let currentOrderClaim = '';
let currentOrderType = '';
let currentOrders = [];
let accumulatedTrades = [];
const MAX_TRADES = 50;
let debounceTimer = null;
let claimDebounceTimer = null;

// ============================================
// イベントリスナー初期化
// ============================================
backBtn.addEventListener('click', () => {
  resultSection.classList.add('hidden');
  searchResults.classList.remove('hidden');
  setTimeout(() => window.scrollTo(0, savedScrollPosition), 0);
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const item = window._currentItem;
  if (!item) return;
  cachedMarketItems = null;
  fetchPromise = null;
  await loadItemDetail(item);
});

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
searchInput.addEventListener('input', onSearchInput);
searchInput.addEventListener('blur', () => setTimeout(hideSuggestions, 200));

// クリックイベント（統合）
document.addEventListener('click', e => {
  if (!e.target.closest('.search-box')) hideSuggestions();
  if (!e.target.closest('.multi-select-wrap')) {
    document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.add('hidden'));
  }
});

// ブラウザ戻るボタン対応
window.addEventListener('popstate', () => {
  if (resultSection && !resultSection.classList.contains('hidden')) {
    resultSection.classList.add('hidden');
    searchResults.classList.remove('hidden');
    setTimeout(() => window.scrollTo(0, savedScrollPosition), 0);
  }
});

// ============================================
// 親カテゴリマッピング
// ============================================
let parentCategoryMap = {};
function buildParentCategoryMap() {
  const map = {};
  document.querySelectorAll('#categoryDropdown .ms-section').forEach(section => {
    const parentEl = section.querySelector('.ms-parent');
    if (!parentEl) return;
    const parentText = parentEl.textContent.replace(/[^\w\u4e00-\u9faf\u3040-\u30ff]/g, '').trim();
    section.querySelectorAll('.ms-child input[type="checkbox"]').forEach(input => {
      if (input.value) map[input.value] = parentText;
    });
  });
  return map;
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { parentCategoryMap = buildParentCategoryMap(); });
} else {
  parentCategoryMap = buildParentCategoryMap();
}

// ============================================
// マルチセレクト管理
// ============================================
function getCheckedValues(type) {
  const dropdown = document.getElementById(`${type}Dropdown`);
  if (!dropdown) return [];
  return [...dropdown.querySelectorAll('input[type=checkbox]:not([value=all]):checked')].map(cb => cb.value);
}

function toggleDropdown(id) {
  document.getElementById(id).classList.toggle('hidden');
}

function toggleParentCategory(el) {
  el.classList.toggle('open');
  el.nextElementSibling.classList.toggle('open');
}

function updateMultiLabel(type) {
  const values = getCheckedValues(type);
  const label = document.getElementById(`${type}Label`);
  if (!label) return;
  label.textContent = values.length === 0 ? 'すべて' : `${values.length}件選択中`;
  
  // クラフト計算フィルターの場合はapplyCraftFiltersを呼出
  if (type.startsWith('craft')) {
    doCraftSearch();
  } else {
    applyFilters();
  }
}

function handleMultiAll(type, cb) {
  const dropdown = document.getElementById(`${type}Dropdown`);
  if (!dropdown) return;
  dropdown.querySelectorAll('input[type=checkbox]:not([value=all])').forEach(c => c.checked = false);
  cb.checked = false;
  updateMultiLabel(type);
}

// ============================================
// 注文操作
// ============================================
window.changeOrderClaim = function(claim) {
  clearTimeout(claimDebounceTimer);
  claimDebounceTimer = setTimeout(() => {
    currentOrderClaim = claim;
    renderOrders(currentOrders, currentOrderType, 1, currentOrderSort, currentOrderRegion, claim);
    const input = document.getElementById('claimSearchInput');
    if (input) {
      input.value = claim;
      input.focus();
      input.setSelectionRange(claim.length, claim.length);
    }
  }, 500);
};

window.changeOrderPage = function(page) {
  renderOrders(currentOrders, currentOrderType, page, currentOrderSort, currentOrderRegion, currentOrderClaim);
};
window.changeOrderSort = function(sort) {
  renderOrders(currentOrders, currentOrderType, 1, sort, currentOrderRegion, currentOrderClaim);
};
window.changeOrderType = function(type) {
  currentOrderType = type;
  renderOrders(currentOrders, type, 1, currentOrderSort, currentOrderRegion, currentOrderClaim);
};
window.changeOrderRegion = function(region) {
  currentOrderRegion = region;
  renderOrders(currentOrders, currentOrderType, 1, currentOrderSort, region, currentOrderClaim);
};

// ============================================
// 日本語検索ユーティリティ（共通化）
// ============================================
function getMatchedEnglishNames(q) {
  const matchedEn = new Set();
  const qH = toHiragana(q);

  // 1. 読み仮名検索
  searchByYomi(q).forEach(en => matchedEn.add(en));

  // 2. ITEM_TRANSLATIONS（日本語→英語）部分一致
  const sorted = Object.entries(ITEM_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [ja, en] of sorted) {
    if (ja.includes(q) || q.includes(ja) ||
      toHiragana(ja).includes(qH) || qH.includes(toHiragana(ja))) {
      matchedEn.add(en.toLowerCase());
    }
  }

  // 3. AUTO_PARTSの逆引き（日本語訳→英語キーワード）
  // 例: "指輪"→"Ring", "リング"→"Ring"
  if (typeof AUTO_PARTS !== 'undefined') {
    for (const [en, ja] of AUTO_PARTS) {
      if (ja.includes(q) || q.includes(ja) ||
        toHiragana(ja).includes(qH) || qH.includes(toHiragana(ja))) {
        // このenキーワードを含む英語名を全てマッチ対象に
        matchedEn.add(en.toLowerCase());
      }
    }
  }

  // 4. 英語での直接部分一致（例: "ring", "argent"）
  if (/^[a-zA-Z\s'&]+$/.test(q) && q.length >= 2) {
    matchedEn.add(q.toLowerCase());
  }

  return matchedEn;
}

function filterByJapanese(items, q) {
  const matchedEn = getMatchedEnglishNames(q);
  if (matchedEn.size === 0) return [];
  return items.filter(item => {
    const name = item.name.toLowerCase();
    for (const en of matchedEn) {
      if (name.includes(en)) return true;
    }
    return false;
  });
}

// ============================================
// 検索オートサジェスト
// ============================================
async function onSearchInput() {
  const q = searchInput.value.trim();
  if (q.length < 2) { hideSuggestions(); return; }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchSuggestions(searchInput.value.trim()), 500);
}

async function fetchSuggestions(q) {
  try {
    const allItems = await fetchAllMarketItems();
    const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(q);
    let filtered = hasJapanese
      ? filterByJapanese(allItems, q)
      : allItems.filter(item => item.name.toLowerCase().includes(q.toLowerCase()));
    filtered = filtered.slice(0, 8);
    if (filtered.length === 0) { hideSuggestions(); return; }
    showSuggestions(filtered);
  } catch(err) {
    console.error('fetchSuggestions error:', err);
    hideSuggestions();
  }
}

function showSuggestions(items) {
  suggestions.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    const jaName = getJaName(item.name);
    const iconUrl = getCachedIcon(item.iconAssetName);
    const useJaName = jaName && jaName.length > 2 && item.name.toLowerCase() !== jaName.toLowerCase();
    const parentCategory = parentCategoryMap[item.tag] || '';
    const jaParentCategory = getJaName(parentCategory) || parentCategory;
    div.innerHTML = `
      <div class="s-top">
        <img class="s-icon" src="${iconUrl}" alt="${item.name}" loading="lazy" onerror="this.style.display='none'">
        <div class="s-text">
          <span class="s-name">${useJaName ? jaName : item.name}</span>
          ${useJaName ? `<span class="s-sub">${item.name}</span>` : ''}
        </div>
      </div>
      <div class="s-tags">
        ${item.tier && item.tier > 0 ? `<span class="s-tier">T${item.tier}</span>` : ''}
        <span class="s-rarity rarity-${item.rarityStr?.toLowerCase()}">${item.rarityStr || ''}</span>
        ${parentCategory ? `<span class="s-parent-category">${jaParentCategory}</span>` : ''}
        ${item.tag ? `<span class="s-tag">${getJaName(item.tag) || item.tag}</span>` : ''}
      </div>
    `;
    div.addEventListener('click', () => {
      searchInput.value = item.name;
      hideSuggestions();
      doSearch();
    });
    suggestions.appendChild(div);
  });
  suggestions.classList.remove('hidden');
}

function hideSuggestions() {
  suggestions.classList.add('hidden');
}

// ============================================
// メイン検索
// ============================================
async function doSearch() {
  const q = searchInput.value.trim();
  if (q !== window._lastSearchQuery) {
    ['tier', 'rarity', 'category'].forEach(type => {
      document.querySelectorAll(`#${type}Dropdown input[type=checkbox]`).forEach(cb => cb.checked = false);
      document.getElementById(`${type}Label`).textContent = 'すべて';
    });
    window._lastSearchQuery = q;
  }

  const tiers = getCheckedValues('tier');
  const rarities = getCheckedValues('rarity');
  const categories = getCheckedValues('category');
  if (!q && tiers.length === 0 && rarities.length === 0 && categories.length === 0) return;

  hideSuggestions();
  showLoading();
  clearError();

  try {
    const allItems = await fetchAllMarketItems();
    const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(q);
    let filtered = allItems;

    if (q) {
      filtered = hasJapanese
        ? filterByJapanese(allItems, q)
        : allItems.filter(item => item.name.toLowerCase().includes(q.toLowerCase()));
    }

    if (tiers.length > 0) filtered = filtered.filter(item => tiers.includes(String(item.tier)));
    if (rarities.length > 0) filtered = filtered.filter(item => rarities.includes(String(item.rarity)));
    if (categories.length > 0) {
  const allTags = new Set();
  const kwFilters = []; // { tag, keyword }

  categories.forEach(cat => {
    if (cat.startsWith('__kw__')) {
      const parts = cat.split('__').filter(Boolean);
      // parts: ['kw', 'Weapon', 'Claymore']
      kwFilters.push({ tag: parts[1], keyword: parts[2] });
    } else if (cat.startsWith('__group__')) {
      const options = [...document.querySelectorAll('#categoryDropdown input[type=checkbox]')];
      const groupIdx = options.findIndex(o => o.value === cat);
      for (let i = groupIdx + 1; i < options.length; i++) {
        if (options[i].value.startsWith('__group__')) break;
        if (!options[i].value.startsWith('__kw__')) allTags.add(options[i].value);
      }
    } else {
      allTags.add(cat);
    }
  });

  filtered = filtered.filter(item => {
    const tag = TAG_NORMALIZE[item.tag] || item.tag;
    if (allTags.has(tag)) return true;
    return kwFilters.some(f => f.tag === tag && item.name.toLowerCase().includes(f.keyword.toLowerCase()));
  });
}

    currentItems = filtered;
    if (currentItems.length === 0) {
      showError('アイテムが見つかりませんでした。別のキーワードで試してください。');
      return;
    }
    currentPage = 1;
    renderSearchResults(currentItems, currentPage);
  } catch (err) {
    showError(`エラーが発生しました: ${err.message}`);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// ============================================
// 検索結果描画
// ============================================
function renderSearchResults(items, page = 1) {
  hideSuggestions();
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const pageItems = items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const paginationHtml = totalPages > 1 ? `
    <div class="pagination">
      <button class="page-btn" onclick="changePage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← 前へ</button>
      <span class="page-info">${page} / ${totalPages}</span>
      <button class="page-btn" onclick="changePage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>次へ →</button>
    </div>` : '';

  searchResultsList.innerHTML = `
    <h3 class="section-title">🔍 検索結果 <span class="order-count">${items.length}件</span></h3>
    ${paginationHtml}
    <div class="result-grid">
      ${pageItems.map(item => {
        const jaName = getJaName(item.name);
        const useJaName = jaName && jaName.length > 2;
        return `
          <div class="result-card" onclick="selectItem('${item.id}')">
            <div class="s-top">
              <img class="s-icon" src="${getCachedIcon(item.iconAssetName)}" alt="${item.name}" onerror="this.style.display='none'">
              <div class="s-text">
                <span class="s-name">${useJaName ? jaName : item.name}</span>
                ${useJaName ? `<span class="s-sub">${item.name}</span>` : ''}
              </div>
            </div>
            <div class="s-tags">
              ${item.tier && item.tier > 0 ? `<span class="s-tier">T${item.tier}</span>` : ''}
              <span class="s-rarity rarity-${item.rarityStr?.toLowerCase()}">${item.rarityStr || ''}</span>
              ${item.tag ? `
                ${parentCategoryMap[item.tag] ? `<span class="s-parent-category">${getJaName(parentCategoryMap[item.tag]) || parentCategoryMap[item.tag]}</span>` : ''}
                <span class="s-tag">${getJaName(item.tag) || item.tag}</span>
              ` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
    ${paginationHtml}
  `;

  searchResults.classList.remove('hidden');
  resultSection.classList.add('hidden');
  emptyState.classList.add('hidden');
}

window.selectItem = async function(itemId) {
  const item = currentItems.find(i => i.id === itemId);
  if (!item) return;
  savedScrollPosition = window.scrollY;
  searchResults.classList.add('hidden');
  await loadItemDetail(item);
  history.pushState({ page: 'detail', itemId: item.id }, '');
  window.scrollTo(0, 0);
};

window.changePage = function(page) {
  currentPage = page;
  renderSearchResults(currentItems, currentPage);
  window.scrollTo(0, 0);
};

// ============================================
// アイテム詳細取得
// ============================================
async function loadItemDetail(item) {
  showLoading();
  try {
    const itemOrCargo = item.itemType === 1 ? 'cargo' : 'item';
    const [marketRes, priceRes] = await Promise.all([
      fetch(`${API_BASE}/market/${itemOrCargo}/${item.id}`, { headers: HEADERS }),
      fetch(`${API_BASE}/market/${itemOrCargo}/${item.id}/price-history?bucket=1+day&limit=7`, { headers: HEADERS })
    ]);
    const marketData = marketRes.ok ? await marketRes.json() : null;
    const priceData = priceRes.ok ? await priceRes.json() : null;

    currentOrders = [];
    if (marketData) {
      const sells = (marketData.sellOrders || []).map(o => ({ ...o, orderType: 'sell' }));
      const buys = (marketData.buyOrders || []).map(o => ({ ...o, orderType: 'buy' }));
      currentOrders = [...sells, ...buys];
    }

    const enrichedItem = {
      ...item,
      lowestSellPrice: marketData?.stats?.lowestSell,
      highestBuyPrice: marketData?.stats?.highestBuy,
      itemOrCargo,
    };
    window._currentItem = enrichedItem;
    currentOrderType = '';
    renderResult(enrichedItem, priceData, currentOrders, '');
    
    // クラフト計算からの来訪の場合は戻るボタンを変更
    if (window._fromCraftModal) {
      const backBtn = document.getElementById('backBtn');
      if (backBtn) {
        backBtn.textContent = '← クラフト計算に戻る';
        backBtn.onclick = () => {
          returnToCraftModal();
          window._fromCraftModal = false;
        };
      }
    }
  } catch (err) {
    showError(`詳細取得エラー: ${err.message}`);
    console.error(err);
  } finally {
    hideLoading();
  }
}

// ============================================
// フィルター適用
// ============================================
function applyFilters() {
  const tiers = getCheckedValues('tier');
  const rarities = getCheckedValues('rarity');
  const categories = getCheckedValues('category');
  if (searchInput.value.trim() || tiers.length > 0 || rarities.length > 0 || categories.length > 0) {
    doSearch();
  }
}

// ============================================
// 描画
// ============================================
function renderResult(item, priceData, orders, orderType) {
  renderItemHeader(item);
  renderPriceSummary(item, priceData);
  renderPriceChart(priceData);
  renderSupplyDemand(orders);
  renderOrders(orders, orderType);
  renderTradeLog(priceData);
  resultSection.classList.remove('hidden');
  emptyState.classList.add('hidden');
  updatePriceByRegion();
}

function renderItemHeader(item) {
  const jaName = getJaName(item.name);
  const useJaName = jaName && jaName.length > 2;
  document.getElementById('itemHeader').innerHTML = `
    <div class="item-title">
      <img class="item-icon" src="${getCachedIcon(item.iconAssetName)}" alt="${item.name}" onerror="this.style.display='none'">
      <div class="item-title-text">
        <div class="item-name-row">
          <h2 class="item-ja-name">${useJaName ? jaName : item.name}</h2>
          ${useJaName ? `<span class="item-en-name">/ ${item.name}</span>` : ''}
        </div>
        <div class="item-badges">
          ${item.tier && item.tier > 0 ? `<span class="badge tier">Tier ${item.tier}</span>` : ''}
          <span class="s-rarity rarity-${item.rarityStr?.toLowerCase()}">${item.rarityStr || ''}</span>
          ${item.tag ? `
            ${parentCategoryMap[item.tag] ? `<span class="s-parent-category">${getJaName(parentCategoryMap[item.tag]) || parentCategoryMap[item.tag]}</span>` : ''}
            <span class="s-tag">${getJaName(item.tag) || item.tag}</span>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderPriceSummary(item, priceData) {
  const stats = priceData?.priceStats || {};
  const lowestSell = item.lowestSellPrice ?? stats.allTimeLow ?? '—';
  const highestBuy = item.highestBuyPrice ?? '—';
  const avg24h = stats.avg24h ?? '—';
  const avg7d = stats.avg7d ?? '—';
  const volume24h = priceData?.priceData?.[0]?.volume ?? 0;
  const change24h = stats.priceChange24h;
  const change7d = stats.priceChange7d;

  const changeBadge = (v) => v != null
    ? `<span class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%</span>`
    : '';

  const regions = [...new Set(currentOrders.map(o => o.regionName).filter(Boolean))].sort();
  const regionOptions = regions.map(r => {
    const rid = currentOrders.find(o => o.regionName === r)?.regionId || '';
    return `<option value="${r}">${r} (R${rid})</option>`;
  }).join('');

  document.getElementById('priceSummary').innerHTML = `
    <h3 class="section-title">💰 価格情報</h3>
    <div class="price-region-filter">
      <select id="priceRegionFilter" onchange="updatePriceByRegion()">
        <option value="">全リージョン</option>${regionOptions}
      </select>
    </div>
    <div class="price-cards">
      <div class="price-card sell"><div class="pc-label">最低売値</div><div class="pc-value" id="pcLowestSell">${formatPrice(lowestSell)}</div><div class="pc-sub">Lowest Sell</div></div>
      <div class="price-card buy"><div class="pc-label">最高買値</div><div class="pc-value" id="pcHighestBuy">${formatPrice(highestBuy)}</div><div class="pc-sub">Highest Buy</div></div>
      <div class="price-card avg-sell"><div class="pc-label">平均売値</div><div class="pc-value" id="pcAvgSell">—</div><div class="pc-sub">Avg Sell</div></div>
      <div class="price-card avg-buy"><div class="pc-label">平均買値</div><div class="pc-value" id="pcAvgBuy">—</div><div class="pc-sub">Avg Buy</div></div>
      <div class="price-card avg"><div class="pc-label">24h平均</div><div class="pc-value" id="pcAvg24h">${formatPrice(avg24h)} ${changeBadge(change24h)}</div><div class="pc-sub">24h Average</div></div>
      <div class="price-card avg7"><div class="pc-label">7日平均</div><div class="pc-value" id="pcAvg7d">${formatPrice(avg7d)} ${changeBadge(change7d)}</div><div class="pc-sub">7-day Average</div></div>
      <div class="price-card vol"><div class="pc-label">24h取引量</div><div class="pc-value" id="pcVol">${formatNum(volume24h)}</div><div class="pc-sub">24h Volume</div></div>
    </div>
  `;
}

window.updatePriceByRegion = function() {
  const region = document.getElementById('priceRegionFilter')?.value || '';
  const filtered = region ? currentOrders.filter(o => o.regionName === region) : currentOrders;
  const sells = filtered.filter(o => o.orderType === 'sell');
  const buys = filtered.filter(o => o.orderType === 'buy');

  const lowestSell = sells.length > 0 ? Math.min(...sells.map(o => Number(o.priceThreshold))) : null;
  const highestBuy = buys.length > 0 ? Math.max(...buys.map(o => Number(o.priceThreshold))) : null;
  const avgSell = sells.length > 0 ? Math.floor(sells.reduce((s, o) => s + Number(o.priceThreshold), 0) / sells.length) : null;
  const avgBuy = buys.length > 0 ? Math.floor(buys.reduce((s, o) => s + Number(o.priceThreshold), 0) / buys.length) : null;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  set('pcLowestSell', formatPrice(lowestSell ?? '—'));
  set('pcHighestBuy', formatPrice(highestBuy ?? '—'));
  set('pcAvgSell', formatPrice(avgSell ?? '—'));
  set('pcAvgBuy', formatPrice(avgBuy ?? '—'));
  if (region) {
    set('pcAvg24h', '—');
    set('pcAvg7d', '—');
    set('pcVol', '—');
  }
};

const CHART_OPTIONS = (scale = {}) => ({
  responsive: true,
  plugins: { legend: { labels: { color: '#aaa' } } },
  scales: {
    x: { ticks: { color: '#aaa', maxRotation: 45, autoSkip: false }, grid: { color: 'rgba(255,255,255,0.15)' }, ...scale.x },
    y: { ticks: { color: '#aaa' }, grid: { color: 'rgba(255,255,255,0.15)' }, ...scale.y }
  }
});

function renderPriceChart(priceData, period = '7d') {
  const data = priceData?.priceData || [];
  document.getElementById('priceChart').innerHTML = `
    <h3 class="section-title">📈 価格推移・取引量</h3>
    <div class="period-btns">
      <button class="period-btn ${period === '24h' ? 'active' : ''}" onclick="changePeriod('24h')">24H</button>
      <button class="period-btn ${period === '7d' ? 'active' : ''}" onclick="changePeriod('7d')">7D</button>
      <button class="period-btn ${period === '30d' ? 'active' : ''}" onclick="changePeriod('30d')">30D</button>
    </div>
    ${data.length === 0 ? '<p class="no-orders">データがありません</p>' : `
      <div class="chart-wrap"><canvas id="priceCanvas"></canvas></div>
      <div class="chart-wrap" style="margin-top:16px"><canvas id="volumeCanvas"></canvas></div>
    `}
  `;
  if (data.length === 0) return;

  const sorted = [...data].reverse();
  const labels = sorted.map(d => {
    const date = new Date(d.bucket);
    return period === '24h' ? `${date.getHours()}:00` : `${date.getMonth()+1}/${date.getDate()}`;
  });

  new Chart(document.getElementById('priceCanvas'), {
    type: 'line',
    data: { labels, datasets: [{ label: '平均価格', data: sorted.map(d => Math.round(d.avgPrice)), borderColor: '#00c896', backgroundColor: 'rgba(0,200,150,0.1)', tension: 0.3, fill: true, pointBackgroundColor: '#00c896' }] },
    options: CHART_OPTIONS()
  });
  new Chart(document.getElementById('volumeCanvas'), {
    type: 'bar',
    data: { labels, datasets: [{ label: '取引量', data: sorted.map(d => d.volume), backgroundColor: 'rgba(91,156,246,0.5)', borderColor: '#5b9cf6', borderWidth: 1 }] },
    options: CHART_OPTIONS()
  });
}

window.changePeriod = async function(period) {
  const item = window._currentItem;
  if (!item) return;
  const bucketMap = { '24h': '1+hour', '7d': '1+day', '30d': '1+day' };
  const limitMap = { '24h': 24, '7d': 7, '30d': 30 };
  const res = await fetch(`${API_BASE}/market/${item.itemOrCargo}/${item.id}/price-history?bucket=${bucketMap[period]}&limit=${limitMap[period]}`, { headers: HEADERS });
  renderPriceChart(res.ok ? await res.json() : null, period);
};

function renderSupplyDemand(orders) {
  const regions = [...new Set(orders.map(o => o.regionName).filter(Boolean))].sort();
  document.getElementById('supplyDemand').innerHTML = `
    <h3 class="section-title">📊 需要と供給</h3>
    <div class="sd-region-filter">
      <select id="sdRegionFilter" onchange="updateSupplyDemand()">
        <option value="">全リージョン</option>
        ${regions.map(r => {
          const rid = orders.find(o => o.regionName === r)?.regionId || '';
          return `<option value="${r}">${r} (R${rid})</option>`;
        }).join('')}
      </select>
    </div>
    <div id="sdContent"></div>
  `;
  window._sdOrders = orders;
  updateSupplyDemand();
}

window.updateSupplyDemand = function() {
  const region = document.getElementById('sdRegionFilter')?.value || '';
  const orders = window._sdOrders || [];
  const filtered = region ? orders.filter(o => o.regionName === region) : orders;
  const sellOrders = filtered.filter(o => o.orderType === 'sell');
  const buyOrders = filtered.filter(o => o.orderType === 'buy');
  const totalSupply = sellOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  const totalDemand = buyOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  const total = totalSupply + totalDemand;
  const supplyPct = total > 0 ? Math.round((totalSupply / total) * 100) : 50;
  const demandPct = 100 - supplyPct;

  document.getElementById('sdContent').innerHTML = `
    <div class="sd-wrap">
      <div class="sd-info">
        <div class="sd-item sell">
          <span class="sd-label">📦 供給（売り）</span>
          <span class="sd-count">${sellOrders.length}件</span>
          <span class="sd-qty">${formatNum(totalSupply)} 個</span>
        </div>
        <div class="sd-item buy">
          <span class="sd-label">🛒 需要（買い）</span>
          <span class="sd-count">${buyOrders.length}件</span>
          <span class="sd-qty">${formatNum(totalDemand)} 個</span>
        </div>
      </div>
      <div class="sd-bar-wrap">
        <div class="sd-bar">
          <div class="sd-fill sell-fill" style="width:${supplyPct}%"><span>${supplyPct}%</span></div>
          <div class="sd-fill buy-fill" style="width:${demandPct}%"><span>${demandPct}%</span></div>
        </div>
        <div class="sd-bar-labels">
          <span>供給 ${supplyPct}%</span>
          <span>需要 ${demandPct}%</span>
        </div>
      </div>
    </div>
  `;
};

// ============================================
// 注文一覧描画
// ============================================
function claimLink(o) {
  if (o.claimLocationX == null) return o.claimName || '—';
  const n = Math.round(o.claimLocationZ / 3), e = Math.round(o.claimLocationX / 3);
  const name = (o.claimName || '').replace(/'/g, "\\'");
  return `<span onclick="openMapModal(${n},${e},'${name}')" style="color:#00c896;cursor:pointer;text-decoration:underline;">${o.claimName || '—'}</span>`;
}

function renderOrders(orders, orderType, page = 1, sort = 'asc', regionFilter = '', claimFilter = '') {
  currentOrderPage = page;
  currentOrderSort = sort;
  const effectiveOrderType = currentOrderType;

  let filtered = [...orders];
  if (effectiveOrderType === 'sell') filtered = filtered.filter(o => o.orderType === 'sell');
  if (effectiveOrderType === 'buy') filtered = filtered.filter(o => o.orderType === 'buy');
  if (regionFilter) filtered = filtered.filter(o => o.regionName === regionFilter);
  if (claimFilter) filtered = filtered.filter(o => o.claimName?.toLowerCase().includes(claimFilter.toLowerCase()));

  filtered.sort((a, b) => sort === 'asc'
    ? Number(a.priceThreshold) - Number(b.priceThreshold)
    : Number(b.priceThreshold) - Number(a.priceThreshold));

  const totalPages = Math.ceil(filtered.length / ORDERS_PER_PAGE);
  // 各注文に固有UIDを付与（未設定のもののみ）
  filtered.forEach(o => { if (!o._uid) o._uid = `${o.sellerUsername||""}_${o.priceThreshold}_${o.claimName||""}_${o.quantity}_${Math.random()}`; });
  const pageOrders = filtered.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);
  const sellCount = filtered.filter(o => o.orderType === 'sell').length;
  const buyCount = filtered.filter(o => o.orderType === 'buy').length;

  const regions = [...new Set(orders.map(o => o.regionName).filter(Boolean))].sort();
  const regionOptions = regions.map(r => {
    const rid = orders.find(o => o.regionName === r)?.regionId || '';
    return `<option value="${r}" ${regionFilter === r ? 'selected' : ''}>${r} (R${rid})</option>`;
  }).join('');

  const pagination = totalPages > 1 ? `
    <div class="pagination">
      <button class="page-btn" onclick="changeOrderPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← 前へ</button>
      <span class="page-info">${page} / ${totalPages}</span>
      <button class="page-btn" onclick="changeOrderPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>次へ →</button>
    </div>` : '';

  const html = filtered.length === 0
    ? '<p class="no-orders">注文が見つかりませんでした</p>'
    : `
      ${pagination}
      <div class="orders-table-wrap">
        <table class="orders-table">
          <thead><tr>
            <th>種別</th>
            <th style="white-space:nowrap;">価格
              <span style="display:inline-flex;flex-direction:column;gap:2px;margin-left:4px;vertical-align:middle;">
                <button class="sort-btn ${sort === 'asc' ? 'active' : ''}" onclick="changeOrderSort('asc')">↑</button>
                <button class="sort-btn ${sort === 'desc' ? 'active' : ''}" onclick="changeOrderSort('desc')">↓</button>
              </span>
            </th>
            <th>数量</th><th>領地名</th><th>リージョン</th><th>座標</th><th></th>
          </tr></thead>
          <tbody>
            ${pageOrders.map(o => `
              <tr class="order-row ${o.orderType}">
                <td><span class="order-badge ${o.orderType}">${o.orderType === 'sell' ? '売り' : '買い'}</span></td>
                <td class="price-cell">${formatPrice(o.priceThreshold)}</td>
                <td>${formatNum(o.quantity)}</td>
                <td class="claim-name">${claimLink(o)}</td>
                <td>${o.regionName ? `${o.regionName} (R${o.regionId})` : '—'}</td>
                <td class="coords">${formatCoords(o)}</td>
                ${o.orderType === 'sell'
                  ? (() => {
                      const uid = o._uid;
                      const added = window._addedOrderUids?.has(uid);
                      return `<td><button
                        onclick="if(!this.disabled){addToCalcList(${JSON.stringify({...o,_uid:uid}).replace(/"/g,'&quot;')},'${(window._currentItem?.name||'').replace(/'/g,"\'")}',this)}"
                        ${added ? 'disabled' : ''}
                        style="${added
                          ? 'background:rgba(255,255,255,0.05);border:1px solid #444;color:#666;padding:2px 8px;border-radius:4px;cursor:default;font-size:12px;'
                          : 'background:rgba(0,200,150,0.1);border:1px solid rgba(0,200,150,0.3);color:#00c896;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:12px;'}"
                      >${added ? '追加済み' : '追加'}</button></td>`;
                    })()
                  : '<td></td>'}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${pagination}`;

  document.getElementById('ordersList').innerHTML = `
    <div class="orders-list-header">
      <h3 class="section-title">📋 注文一覧 <span class="order-count">${filtered.length}件</span></h3>
      <div class="order-type-tabs">
        <button class="tab-btn ${effectiveOrderType === '' ? 'active' : ''}" onclick="changeOrderType('')">売り＆買い (${filtered.length})</button>
        <button class="tab-btn ${effectiveOrderType === 'sell' ? 'active' : ''}" onclick="changeOrderType('sell')">売り (${sellCount})</button>
        <button class="tab-btn ${effectiveOrderType === 'buy' ? 'active' : ''}" onclick="changeOrderType('buy')">買い (${buyCount})</button>
        <select class="region-order-filter" onchange="changeOrderRegion(this.value)">
          <option value="">全リージョン</option>${regionOptions}
        </select>
      </div>
      <div class="orders-search-bar">
        <input type="text" id="claimSearchInput" class="claim-search" placeholder="領地名検索..." oninput="changeOrderClaim(this.value)" value="${claimFilter}">
      </div>
    </div>
    ${html}
  `;
}

// ============================================
// 取引ログ
// ============================================
let currentLogPage = 1;
const LOG_PER_PAGE = 20;
const LOG_MAX_PAGES = 5;

function renderTradeLog(priceData) {
  const newTrades = priceData?.recentTrades || [];
  if (newTrades.length === 0) { document.getElementById('tradeLog').innerHTML = ''; return; }
  const existingIds = new Set(accumulatedTrades.map(t => t.id));
  accumulatedTrades = [...newTrades.filter(t => !existingIds.has(t.id)), ...accumulatedTrades].slice(0, MAX_TRADES);
  window._tradeLogs = accumulatedTrades;
  currentLogPage = 1;
  renderLogTable(accumulatedTrades, 1);
}

function renderLogTable(trades, page) {
  const limited = trades.slice(0, LOG_PER_PAGE * LOG_MAX_PAGES);
  const totalPages = Math.ceil(limited.length / LOG_PER_PAGE);
  const pageItems = limited.slice((page - 1) * LOG_PER_PAGE, page * LOG_PER_PAGE);
  const pagination = totalPages > 1 ? `
    <div class="pagination">
      <button class="page-btn" onclick="changeLogPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← 前へ</button>
      <span class="page-info">${page} / ${totalPages}</span>
      <button class="page-btn" onclick="changeLogPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>次へ →</button>
    </div>` : '';

  const regions = [...new Set(trades.map(t => t.regionName).filter(Boolean))].sort();
  const currentRegion = document.getElementById('logRegionFilter')?.value || '';
  const regionOptions = regions.map(r => {
    const rid = trades.find(t => t.regionName === r)?.regionId || '';
    return `<option value="${r}" ${currentRegion === r ? 'selected' : ''}>${r} (R${rid})</option>`;
  }).join('');

  document.getElementById('tradeLog').innerHTML = `
    <h3 class="section-title">📜 取引ログ <span class="order-count">${limited.length}件</span></h3>
    <button class="refresh-btn" onclick="refreshTradeLog()">🔄 ログ更新</button>
    <div class="log-filter">
      <select id="logRegionFilter" onchange="filterTradeLog()">
        <option value="">全リージョン</option>${regionOptions}
      </select>
    </div>
    ${pagination}
    <div class="log-table-wrap">
      <table class="log-table">
        <thead><tr>
          <th>日時</th><th>買い手</th><th>売り手</th><th>リージョン</th><th>単価</th><th>数量</th><th>合計</th>
        </tr></thead>
        <tbody>${renderLogRows(pageItems)}</tbody>
      </table>
    </div>
    ${pagination}
  `;
}

function renderLogRows(trades) {
  return trades.map(t => {
    const date = new Date(t.timestamp);
    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    return `<tr>
      <td>${dateStr}</td>
      <td>${t.buyerUsername || '—'}</td>
      <td>${t.sellerUsername || '—'}</td>
      <td>${t.regionName || '—'} (R${t.regionId || ''})</td>
      <td class="price-cell">${formatPrice(t.unitPrice)}</td>
      <td>${formatNum(t.quantity)}</td>
      <td class="price-cell">${formatPrice(t.price)}</td>
    </tr>`;
  }).join('');
}

window.changeLogPage = function(page) {
  currentLogPage = page;
  const region = document.getElementById('logRegionFilter')?.value || '';
  const trades = window._tradeLogs || [];
  renderLogTable(region ? trades.filter(t => t.regionName === region) : trades, page);
};

window.refreshTradeLog = async function() {
  const item = window._currentItem;
  if (!item) return;
  const res = await fetch(`${API_BASE}/market/${item.itemOrCargo}/${item.id}/price-history?bucket=1+day&limit=7`, { headers: HEADERS });
  if (res.ok) renderTradeLog(await res.json());
};

window.filterTradeLog = function() {
  const region = document.getElementById('logRegionFilter')?.value || '';
  const trades = window._tradeLogs || [];
  const filtered = region ? trades.filter(t => t.regionName === region) : trades;
  currentLogPage = 1;
  renderLogTable(filtered, 1);
};

// ============================================
// フィルタークリア
// ============================================
window.clearAllFilters = function() {
  ['tier', 'rarity', 'category'].forEach(type => {
    document.querySelectorAll(`#${type}Dropdown input[type=checkbox]`).forEach(cb => cb.checked = false);
    document.getElementById(`${type}Label`).textContent = 'すべて';
  });
  document.querySelectorAll('#categoryDropdown .ms-item').forEach(el => el.style.display = '');
  document.querySelectorAll('#categoryDropdown .ms-section').forEach(el => el.style.display = '');
  document.querySelectorAll('#categoryDropdown .ms-parent').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('#categoryDropdown .ms-section-body').forEach(el => el.classList.remove('open'));
  searchInput.value = '';
  searchResults.classList.add('hidden');
  resultSection.classList.add('hidden');
  emptyState.classList.remove('hidden');
  currentItems = [];
  currentOrderType = '';
};

// ============================================
// マーカー情報表示（既存SVGマップ用）
// ============================================
window.showMarkerInfo = function(idx) {
  const marker = window._mapMarkers?.[idx];
  if (!marker) return;
  const info = document.getElementById('markerInfo');
  const mapLink = `https://map.bitjita.com/?center=${Math.round(marker.z/3)},${Math.round(marker.x/3)}&zoom=1.5`;
  info.innerHTML = `
    <div class="mi-header">
      <strong>${marker.orders[0]?.claimName || '不明な領地'}</strong>
      <span class="mi-region">${marker.orders[0]?.regionName || ''}</span>
    </div>
    <div class="mi-coords">📍 N:${Math.round(marker.z/3)}, E:${Math.round(marker.x/3)}</div>
    <div class="mi-orders">
      ${marker.orders.map(o => `
        <div class="mi-order ${o.orderType}">
          <span class="order-badge ${o.orderType}">${o.orderType === 'sell' ? '売り' : '買い'}</span>
          <span>${formatPrice(o.priceThreshold)}</span>
          <span>×${formatNum(o.quantity)}</span>
        </div>`).join('')}
    </div>
    <a href="${mapLink}" target="_blank" class="mi-maplink">🗺 マップで見る</a>
    <button onclick="document.getElementById('markerInfo').classList.add('hidden')" class="mi-close">✕</button>
  `;
  info.classList.remove('hidden');
};

window.highlightMarker = function() {};

// ============================================
// ユーティリティ
// ============================================
function formatPrice(val) {
  if (val == null || val === '—') return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return Math.floor(n).toLocaleString('ja-JP') + ' <span class="coin">🪙</span>';
}

function formatNum(val) {
  if (val == null) return '0';
  return Number(val).toLocaleString('ja-JP');
}

function formatCoords(order) {
  if (order.claimLocationX == null) return '—';
  return `N:${Math.round(order.claimLocationZ / 3)}, E:${Math.round(order.claimLocationX / 3)}`;
}

function showLoading() {
  loading.classList.remove('hidden');
  resultSection.classList.add('hidden');
  emptyState.classList.add('hidden');
}

function hideLoading() { loading.classList.add('hidden'); }

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  emptyState.classList.add('hidden');
  resultSection.classList.add('hidden');
}

function clearError() {
  errorMsg.classList.add('hidden');
  errorMsg.textContent = '';
}

// ============================================
// 集計リスト
// ============================================
window._calcList = [];

function updateCalcListCount() {
  const el = document.getElementById('calcListCount');
  if (el) el.textContent = window._calcList.length > 0 ? `(${window._calcList.length})` : '';
}

// 追加済み注文のUID管理
window._addedOrderUids = window._addedOrderUids || new Set();

window.addToCalcList = function(order, itemName, btnEl) {
  const uid = order._uid;
  window._calcList.push({ ...order, itemName, buyQty: 0 });
  window._addedOrderUids.add(uid);
  updateCalcListCount();
  // ボタンを押された状態に変更
  if (btnEl) {
    btnEl.textContent = '追加済み';
    btnEl.disabled = true;
    btnEl.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid #444;color:#666;padding:2px 8px;border-radius:4px;cursor:default;font-size:12px;';
  }
  const toast = document.createElement('div');
  toast.textContent = `「${itemName}」を集計リストに追加しました`;
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0d1827;border:1px solid #00c896;color:#00c896;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;pointer-events:none;transition:opacity 0.5s;';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
};

window.openCalcList = function() {
  const renderContent = () => {
    const list = window._calcList;
    const total = list.reduce((sum, i) => sum + Number(i.priceThreshold) * i.buyQty, 0);
    return `
      <div style="background:#0d1827;border:1px solid #2a4f72;border-radius:14px;padding:24px;width:100%;max-width:680px;max-height:85vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 class="section-title" style="margin:0;">🛒 集計リスト</h3>
          <button onclick="document.getElementById('calcListModal').remove()" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;">✕</button>
        </div>
        ${list.length === 0 ? '<p style="color:#666;text-align:center;padding:40px 0;">リストが空です</p>' : `
          <table class="orders-table" style="margin-bottom:20px;">
            <thead><tr>
              <th>アイテム</th><th>領地名</th><th>リージョン</th><th>単価</th><th>個数</th><th>小計</th><th></th>
            </tr></thead>
            <tbody>
              ${list.map((i, idx) => {
                const n = Math.round(i.claimLocationZ / 3), e = Math.round(i.claimLocationX / 3);
                const name = (i.claimName || '').replace(/'/g, "\\'");
                const claimCell = i.claimLocationX != null
                  ? `<span onclick="openMapModal(${n},${e},'${name}')" style="color:#00c896;cursor:pointer;text-decoration:underline;">${i.claimName || '—'}</span>
                     <div style="font-size:10px;color:#666;">N:${n}, E:${e}</div>`
                  : (i.claimName || '—');
                return `
                <tr class="order-row">
                  <td style="color:#e0e0e0;font-size:12px;">${i.itemName}</td>
                  <td class="claim-name">${claimCell}</td>
                  <td style="font-size:12px;">${i.regionName ? `${i.regionName} (R${i.regionId})` : '—'}</td>
                  <td class="price-cell">${formatPrice(i.priceThreshold)}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap;">
                      <button onclick="updateCalcListQty(${idx},window._calcList[${idx}].buyQty-10)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#aaa;width:32px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">-10</button>
                      <button onclick="updateCalcListQty(${idx},window._calcList[${idx}].buyQty-1)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:14px;">－</button>
                      <input type="number" min="0" max="${i.quantity}" value="${i.buyQty}"
                        style="width:50px;background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;border-radius:4px;padding:2px 4px;font-size:12px;text-align:center;"
                        onchange="updateCalcListQty(${idx},this.value)">
                      <button onclick="updateCalcListQty(${idx},window._calcList[${idx}].buyQty+1)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:14px;">＋</button>
                      <button onclick="updateCalcListQty(${idx},window._calcList[${idx}].buyQty+10)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#aaa;width:32px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">+10</button>
                      <span style="font-size:10px;color:#666;">/${formatNum(i.quantity)}</span>
                    </div>
                  </td>
                  <td class="price-cell calc-subtotal">${formatPrice(Number(i.priceThreshold) * i.buyQty)}</td>
                  <td><button onclick="removeCalcListItem(${idx})" style="background:none;border:none;color:#ff4d6d;cursor:pointer;font-size:16px;">✕</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div style="text-align:right;font-family:'Rajdhani',sans-serif;font-size:1.6rem;font-weight:700;color:#fff;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
            合計: <span id="calcListTotal">${formatPrice(total)}</span>
          </div>
          <button onclick="window._calcList=[];updateCalcListCount();openCalcList();"
            style="margin-top:12px;background:rgba(255,77,109,0.1);border:1px solid rgba(255,77,109,0.3);color:#ff4d6d;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;">
            ✕ クリア
          </button>
        `}
      </div>`;
  };

  let modal = document.getElementById('calcListModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'calcListModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }
  modal.innerHTML = renderContent();

  window.updateCalcListQty = function(idx, qty) {
    const item = window._calcList[idx];
    if (!item) return;
    item.buyQty = Math.max(0, Math.min(Number(qty), Number(item.quantity)));
    const inputs = document.querySelectorAll('#calcListModal input[type=number]');
    if (inputs[idx]) inputs[idx].value = item.buyQty;
    const subtotals = document.querySelectorAll('#calcListModal .calc-subtotal');
    if (subtotals[idx]) subtotals[idx].innerHTML = formatPrice(Number(item.priceThreshold) * item.buyQty);
    const totalEl = document.getElementById('calcListTotal');
    if (totalEl) totalEl.innerHTML = formatPrice(window._calcList.reduce((sum, i) => sum + Number(i.priceThreshold) * i.buyQty, 0));
  };

  window.removeCalcListItem = function(idx) {
    const removed = window._calcList[idx];
    if (removed?._uid) window._addedOrderUids?.delete(removed._uid);
    window._calcList.splice(idx, 1);
    updateCalcListCount();
    modal.innerHTML = renderContent();
    // 注文一覧のボタンを再描画
    renderOrders(currentOrders, currentOrderType, currentOrderPage, currentOrderSort, currentOrderRegion, currentOrderClaim);
  };
};

// ============================================
// マップモーダル（iframe）
// ============================================
window.openMapModal = function(n, e, claimName) {
  let modal = document.getElementById('mapIframeModal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'mapIframeModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px;';
  const url = `https://map.bitjita.com/?center=${n},${e}&zoom=1.5`;
  modal.innerHTML = `
    <div style="background:#0d1827;border:1px solid #2a4f72;border-radius:14px;width:100%;max-width:900px;height:80vh;display:flex;flex-direction:column;overflow:hidden;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid #1e3048;flex-shrink:0;">
        <div>
          <span style="font-weight:700;color:#fff;font-size:15px;"> ${claimName || 'マップ'}</span>
          <span style="font-size:11px;color:#666;margin-left:8px;">N:${n}, E:${e}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <a href="${url}" target="_blank" style="color:#00c896;font-size:12px;text-decoration:none;border:1px solid rgba(0,200,150,0.3);padding:4px 10px;border-radius:4px;">別タブで開く</a>
          <button onclick="document.getElementById('mapIframeModal').remove()" style="background:none;border:none;color:#aaa;font-size:22px;cursor:pointer;line-height:1;">✕</button>
        </div>
      </div>
      <iframe src="${url}" style="flex:1;border:none;width:100%;height:100%;" allowfullscreen></iframe>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
};

// ============================================
// クラフト計算機
// ============================================

window.openCraftModal = function() {
  const craftModal = document.getElementById('craftModal');
  if (craftModal) craftModal.classList.remove('hidden');
  
  // 選択したアイテムがあればそのツリーを表示
  if (craftSelectedItem && recipeCache[craftSelectedItem.id]) {
    const quantity = parseInt(document.getElementById('craftQuantity')?.value) || 1;
    const tree = buildTreeFromCache(craftSelectedItem.id, quantity);
    renderCraftTree(tree);
    renderCraftItemTabs();
  } else if (craftSelectedItems.length > 0) {
    renderCraftItemTabs();
  }
  // 状態が保存されていれば復元
  else if (craftModalState.query || craftModalState.currentResult) {
    const craftSearchInput = document.getElementById('craftSearchInput');
    if (craftSearchInput && craftModalState.query) {
      craftSearchInput.value = craftModalState.query;
    }
    if (craftModalState.currentResult) {
      const craftResult = document.getElementById('craftResult');
      if (craftResult) craftResult.innerHTML = craftModalState.currentResult;
    }
  } else {
    const craftSearchInput = document.getElementById('craftSearchInput');
    if (craftSearchInput) craftSearchInput.focus();
  }
};

window.closeCraftModal = function() {
  const craftModal = document.getElementById('craftModal');
  if (craftModal) craftModal.classList.add('hidden');
  const craftSuggestions = document.getElementById('craftSuggestions');
  if (craftSuggestions) craftSuggestions.classList.add('hidden');
  const craftResult = document.getElementById('craftResult');
  if (craftResult) craftResult.innerHTML = '';
  // 選択アイテムは保持（キャッシュは維持）
};

window.clearCraftCache = function() {
  // キャッシュをクリア
  Object.keys(recipeCache).forEach(k => delete recipeCache[k]);
  Object.keys(marketDataCache).forEach(k => delete marketDataCache[k]);
  craftSelectedItems = [];
  craftSelectedItem = null;
  craftMultiSelectMode = false;
  const btn = document.getElementById('craftMultiToggle');
  if (btn) btn.classList.remove('active');
  const tabs = document.getElementById('craftItemTabs');
  if (tabs) tabs.innerHTML = '';
  const result = document.getElementById('craftResult');
  if (result) result.innerHTML = '';
};

// ESCで閉じる
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.closeCraftModal();
});

// オーバーレイクリックで閉じる
document.getElementById('craftModal').addEventListener('click', e => {
  if (e.target.id === 'craftModal') window.closeCraftModal();
});

// サジェスト
document.getElementById('craftSearchInput').addEventListener('input', function() {
  const q = this.value.trim();
  if (q.length < 2) {
    document.getElementById('craftSuggestions').classList.add('hidden');
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchCraftSuggestions(q), 500);
});

async function fetchCraftSuggestions(q) {
  try {
    const allItems = await fetchAllMarketItems();
    const hasJa = /[\u3040-\u30ff\u4e00-\u9faf]/.test(q);
    let filtered;
    if (hasJa) {
      filtered = filterByJapanese(allItems, q);
    } else {
      filtered = allItems.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
    }
    filtered = filtered.slice(0, 8);
    if (filtered.length === 0) {
      document.getElementById('craftSuggestions').classList.add('hidden');
      return;
    }
    showCraftSuggestions(filtered);
  } catch(e) {
    console.error('fetchCraftSuggestions error:', e);
    document.getElementById('craftSuggestions').classList.add('hidden');
  }
}

function showCraftSuggestions(items) {
  const sugg = document.getElementById('craftSuggestions');
  sugg.innerHTML = items.map(item => {
    const ja = getJaName(item.name);
    const icon = `https://bitjita.com/${item.iconAssetName}.webp`;
    const isSelected = craftSelectedItems.find(i => i.id === item.id);
    return `<div class="craft-suggest-item" onclick="selectCraftItem('${item.id}','${item.name.replace(/'/g,"\\'")}', ${craftMultiSelectMode})">
      <img src="${icon}" width="28" height="28" style="border-radius:4px;background:var(--bg2)" loading="lazy" onerror="this.style.display='none'">
      <div>
        <div style="font-size:13px;font-weight:500">${ja || item.name}</div>
        ${ja ? `<div style="font-size:11px;color:var(--text3)">${item.name}</div>` : ''}
      </div>
      ${isSelected ? '<span style="color:var(--accent);font-size:14px;">✓</span>' : ''}
    </div>`;
  }).join('');
  sugg.classList.remove('hidden');
}

window.toggleMultiSelectMode = function() {
  craftMultiSelectMode = !craftMultiSelectMode;
  const btn = document.getElementById('craftMultiToggle');
  if (btn) btn.classList.toggle('active', craftMultiSelectMode);
};

document.getElementById('craftSearchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') doCraftSearch();
});

document.addEventListener('click', e => {
  if (!e.target.closest('.craft-search-wrap') && !e.target.closest('.craft-suggestions')) {
    document.getElementById('craftSuggestions').classList.add('hidden');
  }
});

window.doCraftSearch = async function() {
  const q = document.getElementById('craftSearchInput').value.trim();
  clearTimeout(debounceTimer);
  document.getElementById('craftSuggestions').classList.add('hidden');
  const allItems = await fetchAllMarketItems();
  let filtered;
  
  if (q) {
    const hasJa = /[\u3040-\u30ff\u4e00-\u9faf]/.test(q);
    if (hasJa) {
      filtered = filterByJapanese(allItems, q);
    } else {
      filtered = allItems.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
    }
  } else {
    // 検索ボックスが空の場合は全アイテム
    filtered = allItems;
  }
  
  // フィルター適用
  filtered = applyCraftFilters(filtered);
  
  // ページネーション
  const totalPages = Math.ceil(filtered.length / craftItemsPerPage);
  let start = (craftCurrentPage - 1) * craftItemsPerPage;
  let end = start + craftItemsPerPage;
  let pageItems = filtered.slice(start, end);
  
  if (pageItems.length === 0 && filtered.length > 0) {
    craftCurrentPage = totalPages;
    start = (craftCurrentPage - 1) * craftItemsPerPage;
    end = start + craftItemsPerPage;
    pageItems = filtered.slice(start, end);
  }
  
  if (filtered.length === 0) {
    document.getElementById('craftResult').innerHTML =
      `<div class="craft-no-recipe">${q ? `「${q}」は見つかりませんでした` : 'フィルター条件に一致するものなし'}</div>`;
    return;
  }
  
  // 検索結果一覧を表示
  const resultHtml = pageItems.map(item => {
    const ja = getJaName(item.name);
    const icon = `https://bitjita.com/${item.iconAssetName}.webp`;
    const parentCategory = parentCategoryMap[item.tag] || '';
    const jaParentCategory = getJaName(parentCategory) || parentCategory;
    return `<div class="craft-result-item" onclick="selectCraftItem('${item.id}','${item.name.replace(/'/g,"\\'")}', ${craftMultiSelectMode})">
      <img src="${icon}" width="32" height="32" style="border-radius:4px;background:var(--bg2)" loading="lazy" onerror="this.style.display='none'">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:14px;font-weight:500">${ja || item.name}</span>
          ${craftMultiSelectMode && craftSelectedItems.find(i => i.id === item.id) ? '<span style="color:var(--accent);">✓</span>' : ''}
          <div class="s-tags">
            ${item.tier && item.tier > 0 ? `<span class="s-tier">T${item.tier}</span>` : ''}
            <span class="s-rarity rarity-${item.rarityStr?.toLowerCase()}">${item.rarityStr || ''}</span>
            ${parentCategory ? `<span class="s-parent-category">${jaParentCategory}</span>` : ''}
            ${item.tag ? `<span class="s-tag">${getJaName(item.tag) || item.tag}</span>` : ''}
          </div>
        </div>
        ${ja ? `<div style="font-size:12px;color:var(--text3)">${item.name}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  
  // ページネーションボタン
  let paginationHtml = '';
  if (totalPages > 1) {
    paginationHtml = `<div class="craft-pagination">`;
    if (craftCurrentPage > 1) {
      paginationHtml += `<button class="craft-page-btn" onclick="changeCraftPage(${craftCurrentPage - 1})">← 前</button>`;
    }
    paginationHtml += `<span class="craft-page-info">${craftCurrentPage} / ${totalPages}</span>`;
    if (craftCurrentPage < totalPages) {
      paginationHtml += `<button class="craft-page-btn" onclick="changeCraftPage(${craftCurrentPage + 1})">次 →</button>`;
    }
    paginationHtml += `</div>`;
  }
  
  document.getElementById('craftResult').innerHTML =
    `${paginationHtml}<div class="craft-result-list">${resultHtml}</div>${paginationHtml}`;
};

window.changeCraftPage = function(page) {
  craftCurrentPage = page;
  doCraftSearch();
};

function applyCraftFilters(items) {
  // マルチセレクトのチェックボックス値を取得
  const tierValues = getCheckedValues('craftTier');
  const rarityValues = getCheckedValues('craftRarity');
  const categoryValues = getCheckedValues('craftCategory');
  
  return items.filter(item => {
    // Tier フィルター
    if (tierValues.length > 0 && !tierValues.includes(String(item.tier))) {
      return false;
    }
    // レア度フィルター
    if (rarityValues.length > 0 && !rarityValues.includes(String(item.rarity))) {
      return false;
    }
    // カテゴリーフィルター
    if (categoryValues.length > 0) {
      const itemTag = TAG_NORMALIZE[item.tag] || item.tag || '';
      const itemCategory = parentCategoryMap[itemTag] || parentCategoryMap[item.tag] || '';
      const jaItemCategory = getJaName(itemCategory) || itemCategory;
      
      // グループ値をチェック
      const groupValues = categoryValues.filter(v => v.startsWith('__group__'));
      if (groupValues.length > 0) {
        const matchedGroup = groupValues.some(gv => {
          const groupName = gv.replace('__group__', '');
          return jaItemCategory.includes(groupName) || itemCategory.includes(groupName);
        });
        if (matchedGroup) return true;
      }
      
      // 個別アイテム値をチェック
      const itemValues = categoryValues.filter(v => !v.startsWith('__group__') && !v.startsWith('__kw__'));
      if (itemValues.length > 0) {
        if (itemValues.includes(itemTag)) return true;
      }
      
      // キーワード値をチェック
      const kwValues = categoryValues.filter(v => v.startsWith('__kw__'));
      if (kwValues.length > 0) {
        const matchedKw = kwValues.some(kw => {
          const parts = kw.split('__');
          if (parts.length >= 3) {
            const kwCategory = parts[2];
            const kwSubcategory = parts[3] || '';
            return itemTag.includes(kwCategory) || (kwSubcategory && itemTag.includes(kwSubcategory));
          }
          return false;
        });
        if (matchedKw) return true;
      }
      
      // どのフィルターにも一致しない場合は除外
      if (groupValues.length > 0 || itemValues.length > 0 || kwValues.length > 0) {
        return false;
      }
    }
    return true;
  });
}

window.handleCraftMultiAll = function(type, checkbox) {
  const dropdownId = `craft${type.charAt(0).toUpperCase() + type.slice(1)}Dropdown`;
  const checkboxes = document.querySelectorAll(`#${dropdownId} input[type="checkbox"]`);
  checkboxes.forEach(cb => {
    cb.checked = checkbox.checked;
  });
  updateCraftMultiLabel(type);
  const q = document.getElementById('craftSearchInput').value.trim();
  if (q) doCraftSearch();
};

window.updateCraftMultiLabel = function(type) {
  const dropdownId = `craft${type.charAt(0).toUpperCase() + type.slice(1)}Dropdown`;
  const labelId = `craft${type.charAt(0).toUpperCase() + type.slice(1)}Label`;
  const checkboxes = document.querySelectorAll(`#${dropdownId} input[type="checkbox"]:checked`);
  const values = Array.from(checkboxes).map(cb => cb.value).filter(v => v !== 'all');
  const label = document.getElementById(labelId);
  
  if (values.length === 0) {
    label.textContent = 'すべて';
  } else if (values.length === 1) {
    if (type === 'tier') {
      label.textContent = `Tier ${values[0]}`;
    } else if (type === 'rarity') {
      const rarityNames = ['Default', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
      label.textContent = rarityNames[values[0]] || values[0];
    } else {
      label.textContent = `${values.length} 選択中`;
    }
  } else {
    label.textContent = `${values.length} 選択中`;
  }
  
  const q = document.getElementById('craftSearchInput').value.trim();
  if (q) doCraftSearch();
};

window.clearCraftFilters = function() {
  ['craftTier', 'craftRarity', 'craftCategory'].forEach(type => {
    const dropdownId = `${type}Dropdown`;
    document.querySelectorAll(`#${dropdownId} input[type="checkbox"]`).forEach(cb => cb.checked = false);
    const labelId = `${type}Label`;
    const label = document.getElementById(labelId);
    if (label) label.textContent = 'すべて';
  });
  // 検索ボックスもクリア
  const searchInput = document.getElementById('craftSearchInput');
  if (searchInput) searchInput.value = '';
  // 個数をリセット
  const quantityInput = document.getElementById('craftQuantity');
  if (quantityInput) quantityInput.value = '1';
  craftCurrentQuantity = 1;
  craftSelectedItem = null;
  // 検索結果をクリア
  const craftResult = document.getElementById('craftResult');
  if (craftResult) craftResult.innerHTML = '';
  const craftSuggestions = document.getElementById('craftSuggestions');
  if (craftSuggestions) craftSuggestions.classList.add('hidden');
};

// フィルター変更時に自動で検索を再実行
document.addEventListener('DOMContentLoaded', () => {
  // 既存のイベントリスナーは不要（updateCraftMultiLabel内で処理）
});

window.selectCraftItem = async function(itemId, itemName, addToList = false) {
  if (addToList) {
    // 複数選択モード
    if (!craftSelectedItems.find(i => i.id === itemId)) {
      craftSelectedItems.push({ id: itemId, name: itemName });
      // プリフェッチ
      prefetchAllItemData(itemId).then(() => prefetchAllMarketData(itemId));
    }
    renderCraftItemTabs();
    return;
  }
  
  // 単一選択モード
  if (!craftSelectedItems.find(i => i.id === itemId)) {
    craftSelectedItems.push({ id: itemId, name: itemName });
  }
  craftSelectedItem = { id: itemId, name: itemName };
  craftCurrentPage = 1;
  const quantity = parseInt(document.getElementById('craftQuantity')?.value) || 1;
  document.getElementById('craftResult').innerHTML =
    '<div class="craft-loading"><div class="spinner" style="margin:0 auto 12px"></div>読み込み中...</div>';
  
  // データ読み込み後に自動再レンダリング
  await prefetchAllItemData(itemId);
  await prefetchAllMarketData(itemId);
  buildAndRenderCraftTree(itemId, quantity);
  renderCraftItemTabs();
};

// 選択アイテムのタブを表示
function renderCraftItemTabs() {
  const container = document.getElementById('craftItemTabs');
  if (!container) return;
  
  if (craftSelectedItems.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = craftSelectedItems.map(item => `
    <div class="craft-item-tab" onclick="switchCraftItem('${item.id}')" style="
      background: ${craftSelectedItem?.id === item.id ? 'var(--accent)' : '#1a2535'};
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    ">
      <span>${item.name}</span>
      <span onclick="event.stopPropagation(); removeCraftItem('${item.id}')" style="
        color: #888;
        font-size: 14px;
        line-height: 1;
      ">×</span>
    </div>
  `).join('');
}

// ツリー構築 & データ読み込み完了后再レンダリング
async function buildAndRenderCraftTree(itemId, quantity, depth = 0) {
  // データがなければプリフェッチ
  if (!recipeCache[itemId]) {
    await prefetchAllItemData(itemId);
    await prefetchAllMarketData(itemId);
  }
  
  // 再帰的な子ロードは削除（prefetchで十分）
  
  const tree = buildTreeFromCache(itemId, quantity);
  renderCraftTree(tree);
}

// アイテム切り替え
window.switchCraftItem = function(itemId) {
  const item = craftSelectedItems.find(i => i.id === itemId);
  if (item) {
    craftSelectedItem = { id: item.id, name: item.name };
    const quantity = parseInt(document.getElementById('craftQuantity')?.value) || 1;
    buildAndRenderCraftTree(item.id, quantity);
    renderCraftItemTabs();
  }
};

// レシピ切り替え
window.switchCraftRecipe = function(itemId, recipeIndex) {
  craftRecipeIndex[itemId] = parseInt(recipeIndex);
  const tree = buildTreeFromCache(itemId, craftCurrentQuantity);
  if (tree && tree.allRecipes && tree.allRecipes[recipeIndex]) {
    const recipe = tree.allRecipes[recipeIndex];
    const ingredients = [];
    for (const stack of (recipe.consumedItemStacks || [])) {
      const child = buildTreeFromCache(stack.item_id, stack.quantity * craftCurrentQuantity, 1);
      if (child) ingredients.push(child);
    }
    tree.recipes = [{
      craftedQty: recipe.craftedItemStacks?.[0]?.quantity || 1,
      ingredients,
    }];
    renderCraftTree(tree);
  }
};

// アイテム削除
window.removeCraftItem = function(itemId) {
  craftSelectedItems = craftSelectedItems.filter(i => i.id !== itemId);
  if (craftSelectedItem?.id === itemId) {
    craftSelectedItem = craftSelectedItems[0] || null;
  }
  renderCraftItemTabs();
  if (craftSelectedItem) {
    const quantity = parseInt(document.getElementById('craftQuantity')?.value) || 1;
    buildAndRenderCraftTree(craftSelectedItem.id, quantity);
  }
};

// ピン留め（リストに追加）
window.pinCraftItem = function(itemId, itemName) {
  const isPinned = craftSelectedItems.find(i => i.id === itemId);
  if (isPinned) {
    // ピン留め解除
    craftSelectedItems = craftSelectedItems.filter(i => i.id !== itemId);
    if (craftSelectedItem?.id === itemId) {
      craftSelectedItem = craftSelectedItems[0] || null;
    }
    if (craftSelectedItem) {
      const quantity = parseInt(document.getElementById('craftQuantity')?.value) || 1;
      buildAndRenderCraftTree(craftSelectedItem.id, quantity);
    }
  } else {
    // ピン留め追加
    craftSelectedItems.push({ id: itemId, name: itemName });
    craftSelectedItem = { id: itemId, name: itemName };
    const quantity = parseInt(document.getElementById('craftQuantity')?.value) || 1;
    buildAndRenderCraftTree(itemId, quantity);
  }
  renderCraftItemTabs();
};

window.updateCraftRegion = function() {
  const regionSelect = document.getElementById('craftRegion');
  if (regionSelect) {
    selectedRegion = regionSelect.value;
    // キャッシュからツリーを再描画
    if (craftSelectedItem) {
      const craftResultEl = document.getElementById('craftResult');
      if (craftResultEl) {
        const quantity = parseInt(document.getElementById('craftQuantity')?.value) || 1;
        const tree = buildTreeFromCache(craftSelectedItem.id, quantity);
        renderCraftTree(tree);
      }
    }
  }
};

window.updateCraftQuantity = function(delta = 0) {
  const quantityInput = document.getElementById('craftQuantity');
  if (!quantityInput) return;
  let quantity;
  if (delta === 0) {
    // 直接入力された場合
    quantity = parseInt(quantityInput.value) || 1;
  } else {
    // ボタンクリックの場合
    quantity = craftCurrentQuantity + delta;
  }
  if (quantity < 1) quantity = 1;
  if (quantity > 999) quantity = 999;
  quantityInput.value = quantity;
  craftCurrentQuantity = quantity;
  
  // 現在選択されているアイテムがあれば再計算（キャッシュから）
  if (craftSelectedItem) {
    const tree = buildTreeFromCache(craftSelectedItem.id, quantity);
    renderCraftTree(tree);
  }
};

// レシピキャッシュ
const recipeCache = {};
// 市場データキャッシュ
const marketDataCache = {};

// クラフトモーダルの状態を保存
let craftModalState = {
  query: '',
  currentResult: null
};

// 素材アイテムのIDは文字列として保持
window.viewIngredientDetail = function(itemId, itemName) {
  closeCraftModal();
  setTimeout(() => {
    const item = currentItems.find(i => String(i.id) === String(itemId));
    if (item) {
      selectItem(item.id);
    } else {
      searchAndSelectItem(itemId);
    }
  }, 50);
};

// アイテムを検索して詳細を表示
async function searchAndSelectItem(itemId) {
  const allItems = await fetchAllMarketItems();
  const item = allItems.find(i => String(i.id) === String(itemId));
  if (item) {
    savedScrollPosition = window.scrollY;
    searchResults.classList.add('hidden');
    await loadItemDetail(item);
    history.pushState({ page: 'detail', itemId: item.id }, '');
    window.scrollTo(0, 0);
  }
}

// クラフト計算に戻る
window.returnToCraftModal = function() {
  // 詳細ページを非表示
  resultSection.classList.add('hidden');
  emptyState.classList.remove('hidden');
  // クラフトモーダルを開く
  openCraftModal();
  // 状態を復元（検索クエリと結果のみ）
  const craftSearchInput = document.getElementById('craftSearchInput');
  const craftResult = document.getElementById('craftResult');
  if (craftSearchInput && craftModalState.query) {
    craftSearchInput.value = craftModalState.query;
  }
  if (craftResult && craftModalState.currentResult) {
    craftResult.innerHTML = craftModalState.currentResult;
  }
};

// APIの生データを取得（デバッグ用）
async function fetchItemDataRaw(itemId) {
  try {
    const res = await fetch(`${API_BASE}/items/${itemId}`, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    return null;
  }
}

async function fetchItemData(itemId) {
  if (recipeCache[itemId]) return recipeCache[itemId];
  try {
    const res = await fetch(`${API_BASE}/items/${itemId}`, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`Item ${itemId} not found (${res.status})`);
      return null;
    }
    const data = await res.json();
    recipeCache[itemId] = data;
    return data;
  } catch (err) {
    console.error(`Error fetching item ${itemId}:`, err);
    return null;
  }
}

async function fetchMarketData(itemId) {
  if (marketDataCache[itemId]) return marketDataCache[itemId];
  try {
    const res = await fetch(`${API_BASE}/market/item/${itemId}`, { headers: HEADERS });
    if (!res.ok) {
      if (res.status === 404) return null;
      console.warn(`Market data ${itemId} failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    marketDataCache[itemId] = data;
    return data;
  } catch (err) {
    return null;
  }
}

// 必要なアイテムIDを収集（重複去除）- recipesUsingItemも対象
function collectAllItemIds(itemId, depth = 0) {
  const ids = new Set([itemId]);
  if (depth >= 5) return ids; // 深度5まで許可
  
  const data = recipeCache[itemId];
  if (!data) return ids;
  
  // craftingRecipes: このアイテムを的材料にして作れるもの
  if (data.craftingRecipes?.[0]) {
    for (const stack of (data.craftingRecipes[0].consumedItemStacks || [])) {
      if (depth + 1 < 5) {
        ids.add(String(stack.item_id));
      }
    }
  }
  
  // recipesUsingItem: このアイテムを作れるレシピの材料のみ（自分自身は除外）
  if (data.recipesUsingItem?.length && depth < 5) {
    for (const recipe of data.recipesUsingItem) {
      // 材料に自分自身が含まれていたらその材料を追加しない
      for (const stack of (recipe.consumedItemStacks || [])) {
        if (depth + 1 < 5 && String(stack.item_id) !== String(itemId)) {
          ids.add(String(stack.item_id));
        }
      }
    }
  }
  
  return ids;
}

// プリフェッチ: 全素材データを並列取得

// ============================================
async function prefetchAllItemData(itemId) {
  const data = await fetchItemData(itemId);
  if (!data) return;
  const mIds = new Set();
  const colM = (id,d=0) => {
    if(d>3) return; const r=recipeCache[id]; if(!r?.item) return;
    const mr=getManualRecipe(id,r.item.name,r.item.tier);
    if(mr) mr.consumedItemStacks.forEach(s=>{const sid=String(s.item_id);if(sid&&sid!=="0"){mIds.add(sid);colM(sid,d+1);}});
  };
  colM(String(itemId));
  const allIds = collectAllItemIds(itemId, 0);
  mIds.forEach(id=>allIds.add(id));
  await Promise.all([...allIds].filter(id=>!recipeCache[id]).map(id=>fetchItemData(id)));
  colM(String(itemId)); mIds.forEach(id=>allIds.add(id));
  await Promise.all([...allIds].filter(id=>!recipeCache[id]).map(id=>fetchItemData(id)));
}

// プリフェッチ: 全市場データを並列取得
async function prefetchAllMarketData(itemId) {
  const data = recipeCache[itemId];
  if (!data) return;
  const allIds = collectAllItemIds(itemId, 0);
  const addM = (id,d=0) => {
    if(d>3) return; const r=recipeCache[id]; if(!r?.item) return;
    const mr=getManualRecipe(id,r.item.name,r.item.tier);
    if(mr) mr.consumedItemStacks.forEach(s=>{const sid=String(s.item_id);if(sid&&sid!=="0"){allIds.add(sid);addM(sid,d+1);}});
  };
  addM(String(itemId));
  await Promise.all([...allIds].filter(id=>!marketDataCache[id]).map(id=>fetchMarketData(id)));
}

// キャッシュ使用のツリービルド（プリフェッチ後で使用）
function buildTreeFromCache(itemId, quantity, depth = 0) {
  const data = recipeCache[itemId];
  if (!data) return null;

  const item = data.item;
  const craftingRecipes = data.craftingRecipes || [];
  const recipesUsingItem = data.recipesUsingItem || [];
  
  // 全レシピを収集（重複去除）
  let allRecipes = [];
  
  // 手動レシピを最優先で追加
  const _mr = getManualRecipe(itemId, item.name, item.tier);
  if (_mr) allRecipes.push(_mr);
  // craftingRecipesを追加
  if (craftingRecipes.length > 0) {
    craftingRecipes.forEach(r => { allRecipes.push({...r, recipeType:'crafting'}); });
  }
  // recipesUsingItemを追加（ 材料に自分自身が含まれていないもの）
  if (recipesUsingItem.length > 0) {
    recipesUsingItem.forEach(r => {
      const materials = r.consumedItemStacks || [];
      const selfCount = materials.filter(s => String(s.item_id) === String(itemId)).length;
      // 材料の半分以上が自分じゃないなら追加
      if (materials.length === 0 || selfCount / materials.length < 0.5) {
        allRecipes.push({
          ...r,
          recipeType: 'using'
        });
      }
    });
  }
  
  // 重複去除（同じ材料セットのレシピは除外）
  const uniqueRecipes = [];
  const seenMaterials = new Set();
  allRecipes.forEach(r => {
    const matKey = (r.consumedItemStacks || [])
      .map(s => s.item_id)
      .sort()
      .join(',');
    if (!seenMaterials.has(matKey)) {
      seenMaterials.add(matKey);
      uniqueRecipes.push(r);
    }
  });
  
  const recipes = uniqueRecipes;
  
  const marketData = marketDataCache[itemId] || {};
  const sells = (marketData?.sellOrders || []).sort((a, b) =>
    Number(a.priceThreshold) - Number(b.priceThreshold));
  const lowestSell = sells[0] ? {
    price: Math.floor(Number(sells[0].priceThreshold)),
    claimName: sells[0].claimName || '—',
    regionName: sells[0].regionName || '—',
    regionId: sells[0].regionId || '',
  } : null;

  const node = {
    itemId, quantity,
    name: item.name,
    jaName: getJaName(item.name),
    icon: item.iconAssetName || '',
    lowestSell,
    sellOrders: sells,
    recipes: [],
  };

  if (recipes.length > 0 && depth < 5) {
    // 複数のレシピがある場合は選択可能
    node.allRecipes = recipes.map(r => ({
      consumedItemStacks: r.consumedItemStacks || [],
      craftedItemStacks: r.craftedItemStacks || [],
      name: r.name || 'Recipe',
      recipeType: r.recipeType || 'unknown'
    }));
    // 最初のレシピを使用（自分自身を除く）
    const recipe = recipes[0];
    const ingredients = [];
    for (const stack of (recipe.consumedItemStacks || [])) {
      // 材料が自分と同じものは除外（無限ループ防止）
      if (String(stack.item_id) !== String(itemId)) {
        const child = buildTreeFromCache(stack.item_id, stack.quantity * quantity, depth + 1);
        if (child) ingredients.push(child);
      }
    }
    node.recipes.push({
      craftedQty: recipe.craftedItemStacks?.[0]?.quantity || 1,
      ingredients,
    });
  }

  return node;
}

function calcTotalCost(node) {
  if (!node) return 0;
  if (node.recipes.length === 0 || !node.recipes[0].ingredients.length) {
    // リージョン別に最安値を取得
    let lowestPrice = 0;
    if (node.sellOrders && selectedRegion) {
      const regionOrders = node.sellOrders.filter(order => order.regionName === selectedRegion);
      if (regionOrders.length > 0) {
        lowestPrice = Math.floor(Number(regionOrders[0].priceThreshold));
      }
    } else if (node.lowestSell) {
      lowestPrice = node.lowestSell.price;
    }
    return lowestPrice * node.quantity;
  }
  return node.recipes[0].ingredients.reduce((sum, child) => sum + calcTotalCost(child), 0);
}

function renderCraftTree(tree) {
  const craftResultEl = document.getElementById('craftResult');
  if (!craftResultEl) return;
  if (!tree) {
    craftResultEl.innerHTML =
      '<div class="craft-no-recipe">データが取得できませんでした</div>';
    return;
  }
  const totalCost = calcTotalCost(tree);
  
  // リージョンのリストを取得
  const regions = new Set(['']); // すべてのリージョンを含む
  function collectRegions(node) {
    if (node.sellOrders) {
      node.sellOrders.forEach(order => {
        if (order.regionName) regions.add(order.regionName);
      });
    }
    if (node.recipes && node.recipes[0] && node.recipes[0].ingredients) {
      node.recipes[0].ingredients.forEach(child => collectRegions(child));
    }
  }
  collectRegions(tree);
  
  // リージョン選択UIを更新
  const regionSelect = document.getElementById('craftRegion');
  if (regionSelect) {
    const currentRegion = regionSelect.value;
    regionSelect.innerHTML = '';
    regions.forEach(region => {
      const option = document.createElement('option');
      option.value = region;
      // リージョンIDを取得
      let regionIdText = '';
      if (region && tree.sellOrders) {
        const order = tree.sellOrders.find(o => o.regionName === region);
        if (order && order.regionId) {
          regionIdText = ` R${order.regionId}`;
        }
      }
      option.textContent = region ? `${region}${regionIdText}` : 'すべてのリージョン';
      if (region === currentRegion) option.selected = true;
      regionSelect.appendChild(option);
    });
  }
  
  const html = `
    <div class="craft-item-header" style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="https://bitjita.com/${tree.icon}.webp" width="48" height="48"
          style="border-radius:6px;background:var(--bg2)" onerror="this.style.display='none'">
        <div>
          <div class="craft-item-name">${tree.jaName || tree.name}</div>
          ${tree.jaName ? `<div class="craft-item-sub">${tree.name}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="craft-quantity-selector" style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap;">
          <button onclick="updateCraftQuantity(-10)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#aaa;width:32px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">-10</button>
          <button onclick="updateCraftQuantity(-1)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:14px;">－</button>
          <input type="number" id="craftQuantity" min="1" max="999" value="${craftCurrentQuantity}"
            style="width:50px;background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;border-radius:4px;padding:2px 4px;font-size:12px;text-align:center;"
            onchange="updateCraftQuantity(0)">
          <button onclick="updateCraftQuantity(1)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:14px;">＋</button>
          <button onclick="updateCraftQuantity(10)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#aaa;width:32px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">+10</button>
          <span style="font-size:10px;color:#666;">個</span>
        </div>
        <button onclick="pinCraftItem('${tree.itemId}','${tree.name.replace(/'/g,"\\'")}')" title="ピン留め" style="
          background: ${craftSelectedItems.some(i => i.id === tree.itemId) ? 'var(--accent)' : '#1a2535'};
          border: 1px solid ${craftSelectedItems.some(i => i.id === tree.itemId) ? 'var(--accent)' : 'rgba(255,255,255,0.15)'};
          color: ${craftSelectedItems.some(i => i.id === tree.itemId) ? '#000' : '#aaa'};
          width:32px;height:32px;border-radius:4px;cursor:pointer;font-size:16px;
        ">📌</button>
      </div>
    </div>
    ${tree.allRecipes && tree.allRecipes.length > 1 ? `
      <div class="craft-recipe-selector" style="margin: 12px 0; display: flex; gap: 8px; align-items: center;">
        <span style="font-size:12px;color:#888;">レシピ:</span>
        <select onchange="switchCraftRecipe('${tree.itemId}', this.value)" style="
          background:#1a2535;
          color:#e0e0e0;
          border:1px solid rgba(255,255,255,0.15);
          padding:4px 8px;
          border-radius:4px;
          font-size:12px;
          max-width:200px;
        ">
          ${tree.allRecipes.map((r, idx) => `
            <option value="${idx}" ${idx === (craftRecipeIndex[tree.itemId] || 0) ? 'selected' : ''}>
              ${r.name || 'レシピ ' + (idx + 1)} ${r.recipeType === 'crafting' || r.recipeType === 'manual' ? '(新規クラフト)' : '(再利用・改造)'}
            </option>
          `).join('')}
        </select>
      </div>
    ` : ''}
    ${tree.recipes.length === 0
      ? '<div class="craft-no-recipe">このアイテムのクラフトレシピはありません</div>'
      : renderIngredients(tree.recipes[0].ingredients)
    }
    ${tree.recipes.length > 0 ? `
    <div class="craft-total">
      <span class="craft-total-label">素材合計コスト（推定）</span>
      <span class="craft-total-value">${totalCost.toLocaleString('ja-JP')} 🪙</span>
    </div>` : ''}
  `;
  craftResultEl.innerHTML = html;
}

function renderIngredients(ingredients, depth = 0) {
  return `
    <div class="craft-recipe${depth > 0 ? ' craft-sub-recipe' : ''}">
      ${depth === 0 ? '<div class="craft-recipe-title">必要素材</div>' : ''}
      ${ingredients.map(ing => {
        const hasCraft = ing.recipes.length > 0 && ing.recipes[0].ingredients.length > 0;
        const craftCost = calcTotalCost(ing);
        
        // リージョン別に最安値を取得
        let lowestSell = null;
        let regionLabel = '';
        if (selectedRegion && ing.sellOrders && ing.sellOrders.length > 0) {
          const regionOrders = ing.sellOrders.filter(order => order.regionName === selectedRegion);
          if (regionOrders.length > 0) {
            lowestSell = {
              price: Math.floor(Number(regionOrders[0].priceThreshold)),
              claimName: regionOrders[0].claimName || '—',
              regionName: regionOrders[0].regionName || '—',
              regionId: regionOrders[0].regionId || '',
            };
            regionLabel = `(${selectedRegion})`;
          }
        } else if (ing.lowestSell) {
          lowestSell = ing.lowestSell;
        }
        
        const buyCost = lowestSell ? lowestSell.price * ing.quantity : null;
        const cheaper = hasCraft && buyCost !== null
          ? (craftCost < buyCost ? 'craft' : 'buy') : null;
        return `
          <div class="craft-ingredient" onclick="viewIngredientDetail('${ing.itemId}','${ing.name.replace(/'/g,"\\'")}')">
            <img src="https://bitjita.com/${ing.icon}.webp" class="craft-ingredient-icon"
              onerror="this.style.display='none'">
            <div class="craft-ingredient-info">
              <div class="craft-ingredient-name">${ing.jaName || ing.name}</div>
              ${ing.jaName ? `<div style="font-size:11px;color:var(--text)">${ing.name}</div>` : ''}
              <div class="craft-ingredient-qty">× ${ing.quantity}</div>
              ${cheaper === 'craft' ? `<span style="font-size:11px;color:#f0a500">⚒ クラフトの方が安い (${craftCost.toLocaleString('ja-JP')} 🪙)</span>` : ''}
              ${cheaper === 'buy' ? `<span style="font-size:11px;color:var(--accent)">🛒 購入の方が安い</span>` : ''}
            </div>
            <div class="craft-ingredient-price">
              ${lowestSell
                ? `<div class="craft-ingredient-sell">${(lowestSell.price * ing.quantity).toLocaleString('ja-JP')} 🪙</div>
                   <div class="craft-ingredient-claim">${lowestSell.claimName} / ${lowestSell.regionName}${lowestSell.regionId ? ` (R~${lowestSell.regionId})` : ''} ${regionLabel}</div>
                   <div class="craft-ingredient-claim">${lowestSell.price.toLocaleString('ja-JP')} 🪙 × ${ing.quantity}</div>`
                : '<div style="font-size:12px;color:var(--text3)">売り注文なし</div>'
              }
            </div>
          </div>
          ${hasCraft ? renderIngredients(ing.recipes[0].ingredients, depth + 1) : ''}
        `;
      }).join('')}
    </div>
  `;
}
