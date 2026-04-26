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

  // Items/ や Resources/ で始まる場合は GeneratedIcons/ を付与
  if (path.startsWith('Items/') || path.startsWith('Resources/') || path.startsWith('PremiumIcons/')) {
    // PremiumIconsはそのまま
    if (!path.startsWith('PremiumIcons/')) {
      path = 'GeneratedIcons/' + path;
    }
  }

  // スペースをアンダースコアまたは%20に変換
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
  searchByYomi(q).forEach(en => matchedEn.add(en));
  const sorted = Object.entries(ITEM_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [ja, en] of sorted) {
    if (ja.includes(q) || q.includes(ja) ||
      toHiragana(ja).includes(toHiragana(q)) || toHiragana(q).includes(toHiragana(ja))) {
      matchedEn.add(en.toLowerCase());
    }
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
    if (allTags.has(item.tag)) return true;
    return kwFilters.some(f => f.tag === item.tag && item.name.toLowerCase().includes(f.keyword.toLowerCase()));
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
                  ? `<td><button onclick="addToCalcList(${JSON.stringify(o).replace(/"/g, '&quot;')}, '${window._currentItem?.name || ''}')" style="background:rgba(0,200,150,0.1);border:1px solid rgba(0,200,150,0.3);color:#00c896;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:12px;">追加</button></td>`
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

window.addToCalcList = function(order, itemName) {
  const existing = window._calcList.find(i => i.itemName === itemName && i.claimName === order.claimName && i.priceThreshold === order.priceThreshold);
  if (existing) {
    const toast = document.createElement('div');
    toast.textContent = `「${itemName}」はすでに同じ領地でリストに追加されています`;
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0d1827;border:1px solid #f0a500;color:#f0a500;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;pointer-events:none;transition:opacity 0.5s;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
    return;
  }
  window._calcList.push({ ...order, itemName, buyQty: 0 });
  updateCalcListCount();
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
    window._calcList.splice(idx, 1);
    updateCalcListCount();
    modal.innerHTML = renderContent();
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
    if (craftSearchInput) setTimeout(() => craftSearchInput.focus(), 100);
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
      const itemTag = item.tag || '';
      const itemCategory = parentCategoryMap[itemTag] || '';
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
// 手動レシピDB
// ============================================
const TIER_MATS = {
  1:{ingot:1050001,rope:1090004,plank:1020003,leather:1070004,cloth:1090002,strip:1464553255},
  2:{ingot:2050001,rope:2090004,plank:2020003,leather:2070004,cloth:2090002,strip:1537459864},
  3:{ingot:3050001,rope:3090004,plank:3020003,leather:3070004,cloth:3090002,strip:989485035},
  4:{ingot:4050001,rope:4090004,plank:4020003,leather:4070004,cloth:4090002,strip:1442354536},
  5:{ingot:5050001,rope:5090004,plank:5020003,leather:5070004,cloth:5090002,strip:1481097878},
  6:{ingot:6050001,rope:6090004,plank:6020003,leather:6070004,cloth:6090002,strip:487923809},
  7:{ingot:1899017490,rope:625147590,plank:1639308227,leather:806992520,cloth:1610800379,strip:2049788179},
  8:{ingot:1464752960,rope:1224328894,plank:28056473,leather:1743778001,cloth:136406464,strip:1568797710},
  9:{ingot:1979722091,rope:471802228,plank:1227914325,leather:1580025475,cloth:282660928,strip:2065775136},
  10:{ingot:2069757207,rope:547017087,plank:117329467,leather:711364475,cloth:35270576,strip:1836205414},
};
const ANC_METAL = 1718148009;

// k: 'tool'=Ingot×4+Rope×2+Plank×2+Leather×2, 'plated'=Ingot×5+Cloth×2
//    'duelist'=Ingot×4+Leather×2+Cloth×1+AncMetal×15, 'prev'=前Tierのみ
//    'direct'=素材を直接指定
const CRAFT_DB = {
  // ツール・武器 T2-T6
'Pyrelite Axe':{p:1201067083,t:2,k:'tool'},'Pyrelite Bow':{p:2054875237,t:2,k:'tool'},
'Pyrelite Chisel':{p:1831352039,t:2,k:'tool'},'Pyrelite Claymore':{p:252729537,t:2,k:'weapon'},
'Pyrelite Crossbow':{p:1471860856,t:2,k:'weapon'},'Pyrelite Daggers':{p:747689943,t:2,k:'weapon'},
'Pyrelite Hammer':{p:1669114499,t:2,k:'tool'},'Pyrelite Hoe':{p:273473901,t:2,k:'tool'},
'Pyrelite Knife':{p:1503159114,t:2,k:'tool'},'Pyrelite Mace':{p:1823909616,t:2,k:'weapon'},
'Pyrelite Machete':{p:571682698,t:2,k:'tool'},'Pyrelite Pickaxe':{p:1704711141,t:2,k:'tool'},
'Pyrelite Quill':{p:530006562,t:2,k:'tool'},'Pyrelite Rod':{p:544541723,t:2,k:'tool'},
'Pyrelite Saw':{p:1355330989,t:2,k:'tool'},'Pyrelite Scissors':{p:1125962328,t:2,k:'tool'},
'Pyrelite Shortsword':{p:194332661,t:2,k:'weapon'},'Pyrelite Spear & Shield':{p:1826240904,t:2,k:'weapon'},

'Emarium Axe':{p:1605904571,t:3,k:'tool'},'Emarium Bow':{p:1034184552,t:3,k:'tool'},
'Emarium Chisel':{p:1413938165,t:3,k:'tool'},'Emarium Claymore':{p:620508449,t:3,k:'weapon'},
'Emarium Crossbow':{p:1512593047,t:3,k:'weapon'},'Emarium Daggers':{p:465856554,t:3,k:'weapon'},
'Emarium Hammer':{p:482196569,t:3,k:'tool'},'Emarium Hoe':{p:1644135836,t:3,k:'tool'},
'Emarium Knife':{p:1316428000,t:3,k:'tool'},'Emarium Mace':{p:1598024081,t:3,k:'weapon'},
'Emarium Machete':{p:223757569,t:3,k:'tool'},'Emarium Pickaxe':{p:513104323,t:3,k:'tool'},
'Emarium Quill':{p:414853205,t:3,k:'tool'},'Emarium Rod':{p:843645212,t:3,k:'tool'},
'Emarium Saw':{p:412214433,t:3,k:'tool'},'Emarium Scissors':{p:343569714,t:3,k:'tool'},
'Emarium Shortsword':{p:333188935,t:3,k:'weapon'},'Emarium Spear & Shield':{p:2098377887,t:3,k:'weapon'},

'Elenvar Axe':{p:1486054968,t:4,k:'tool'},'Elenvar Bow':{p:1219038577,t:4,k:'tool'},
'Elenvar Chisel':{p:438003010,t:4,k:'tool'},'Elenvar Claymore':{p:480170023,t:4,k:'weapon'},
'Elenvar Crossbow':{p:1176798477,t:4,k:'weapon'},'Elenvar Daggers':{p:412987444,t:4,k:'weapon'},
'Elenvar Hammer':{p:398791964,t:4,k:'tool'},'Elenvar Hoe':{p:1043267104,t:4,k:'tool'},
'Elenvar Knife':{p:971385983,t:4,k:'tool'},'Elenvar Mace':{p:1145327846,t:4,k:'weapon'},
'Elenvar Machete':{p:1229547048,t:4,k:'tool'},'Elenvar Pickaxe':{p:2124079079,t:4,k:'tool'},
'Elenvar Quill':{p:1221634026,t:4,k:'tool'},'Elenvar Rod':{p:1094163061,t:4,k:'tool'},
'Elenvar Saw':{p:1930789220,t:4,k:'tool'},'Elenvar Scissors':{p:803429716,t:4,k:'tool'},
'Elenvar Spear & Shield':{p:1888091519,t:4,k:'weapon'},'Elenvar Shortsword':{p:1143890441,t:4,k:'weapon'},

'Luminite Axe':{p:489724302,t:5,k:'tool'},'Luminite Bow':{p:735626470,t:5,k:'tool'},
'Luminite Chisel':{p:2122350182,t:5,k:'tool'},'Luminite Claymore':{p:1800349844,t:5,k:'weapon'},
'Luminite Crossbow':{p:1184634453,t:5,k:'weapon'},'Luminite Daggers':{p:1800053684,t:5,k:'weapon'},
'Luminite Hammer':{p:382339978,t:5,k:'tool'},'Luminite Hoe':{p:1891681591,t:5,k:'tool'},
'Luminite Knife':{p:268156651,t:5,k:'tool'},'Luminite Machete':{p:1342482833,t:5,k:'tool'},
'Luminite Pickaxe':{p:2015514055,t:5,k:'tool'},'Luminite Quill':{p:139776334,t:5,k:'tool'},
'Luminite Rod':{p:1858500155,t:5,k:'tool'},'Luminite Saw':{p:1115966209,t:5,k:'tool'},
'Luminite Scissors':{p:582320225,t:5,k:'tool'},'Luminite Spear & Shield':{p:1800572877,t:5,k:'weapon'},
'Luminite Mace':{p:1841497848,t:5,k:'weapon'},'Luminite Shortsword':{p:988443947,t:5,k:'weapon'},

'Rathium Chisel':{p:1771114282,t:6,k:'tool'},'Rathium Scissors':{p:783907612,t:6,k:'tool'},
"Rathium Axe":{p:'724409328',t:5,k:'tool'},"Rathium Bow":{p:'1300016557',t:5,k:'tool'},
"Rathium Claymore":{p:'580810311',t:5,k:'weapon'},"Rathium Crossbow":{p:'673207772',t:5,k:'weapon'},
"Rathium Daggers":{p:'2126197692',t:5,k:'weapon'},"Rathium Hammer":{p:'851522677',t:5,k:'tool'},
"Rathium Hoe":{p:'615404092',t:5,k:'tool'},"Rathium Knife":{p:'48557171',t:5,k:'tool'},
"Rathium Mace":{p:'637858677',t:5,k:'weapon'},"Rathium Machete":{p:'1536392855',t:5,k:'tool'},
"Rathium Pickaxe":{p:'496053871',t:5,k:'tool'},"Rathium Quill":{p:'191522893',t:5,k:'tool'},
"Rathium Rod":{p:'1758200750',t:5,k:'tool'},"Rathium Saw":{p:'404233507',t:5,k:'tool'},
"Rathium Shortsword":{p:'144598614',t:5,k:'weapon'},"Rathium Spear & Shield":{p:'554291192',t:5,k:'weapon'},
  // T7-T10 ツール・武器
'Aurumite Axe':{p:1553464985,t:7,k:'tool'},'Aurumite Bow':{p:1491113278,t:7,k:'tool'},
'Aurumite Chisel':{p:1428413909,t:7,k:'tool'},'Aurumite Claymore':{p:977876862,t:7,k:'weapon'},
'Aurumite Crossbow':{p:2031755509,t:7,k:'weapon'},'Aurumite Daggers':{p:1308904989,t:7,k:'weapon'},
'Aurumite Hammer':{p:353834323,t:7,k:'tool'},'Aurumite Hoe':{p:1821220821,t:7,k:'tool'},
'Aurumite Knife':{p:270820549,t:7,k:'tool'},'Aurumite Mace':{p:1134539652,t:7,k:'weapon'},
'Aurumite Machete':{p:1941748536,t:7,k:'tool'},'Aurumite Pickaxe':{p:1019977008,t:7,k:'tool'},
'Aurumite Quill':{p:1039518462,t:7,k:'tool'},'Aurumite Rod':{p:1677637105,t:7,k:'tool'},
'Aurumite Saw':{p:1753110534,t:7,k:'tool'},'Aurumite Scissors':{p:1828085396,t:7,k:'tool'},
'Aurumite Shortsword':{p:1704320467,t:7,k:'weapon'},'Aurumite Spear & Shield':{p:1428680361,t:7,k:'weapon'},

'Celestium Axe':{p:1337511485,t:8,k:'tool'},'Celestium Bow':{p:1144166893,t:8,k:'tool'},
'Celestium Chisel':{p:789795936,t:8,k:'tool'},'Celestium Claymore':{p:1814060816,t:8,k:'weapon'},
'Celestium Crossbow':{p:1341361216,t:8,k:'weapon'},'Celestium Daggers':{p:1002395423,t:8,k:'weapon'},
'Celestium Hammer':{p:1047843413,t:8,k:'tool'},'Celestium Hoe':{p:110205879,t:8,k:'tool'},
'Celestium Knife':{p:178238273,t:8,k:'tool'},'Celestium Mace':{p:1710015327,t:8,k:'weapon'},
'Celestium Machete':{p:728445804,t:8,k:'tool'},'Celestium Pickaxe':{p:1926302459,t:8,k:'tool'},
'Celestium Quill':{p:1165036582,t:8,k:'tool'},'Celestium Rod':{p:1406728773,t:8,k:'tool'},
'Celestium Saw':{p:1176061468,t:8,k:'tool'},'Celestium Scissors':{p:1700689396,t:8,k:'tool'},
'Celestium Shortsword':{p:502541107,t:8,k:'weapon'},'Celestium Spear & Shield':{p:1641524052,t:8,k:'weapon'},

'Umbracite Axe':{p:1967177382,t:9,k:'tool'},'Umbracite Bow':{p:1255416131,t:9,k:'tool'},
'Umbracite Chisel':{p:247800929,t:9,k:'tool'},'Umbracite Claymore':{p:1242957888,t:9,k:'weapon'},
'Umbracite Crossbow':{p:176089093,t:9,k:'weapon'},'Umbracite Daggers':{p:2118322388,t:9,k:'weapon'},
'Umbracite Hammer':{p:1925316516,t:9,k:'tool'},'Umbracite Hoe':{p:1393188394,t:9,k:'tool'},
'Umbracite Knife':{p:1297341889,t:9,k:'tool'},'Umbracite Mace':{p:1999151730,t:9,k:'weapon'},
'Umbracite Machete':{p:568446581,t:9,k:'tool'},'Umbracite Pickaxe':{p:1840720045,t:9,k:'tool'},
'Umbracite Quill':{p:1384947495,t:9,k:'tool'},'Umbracite Rod':{p:1285380429,t:9,k:'tool'},
'Umbracite Saw':{p:2138097685,t:9,k:'tool'},'Umbracite Scissors':{p:598915758,t:9,k:'tool'},
'Umbracite Shortsword':{p:1214952757,t:9,k:'weapon'},'Umbracite Spear & Shield':{p:1176526661,t:9,k:'weapon'},

'Astralite Axe':{p:1845657486,t:10,k:'tool'},'Astralite Bow':{p:1508575560,t:10,k:'tool'},
'Astralite Chisel':{p:1469116327,t:10,k:'tool'},'Astralite Claymore':{p:450178430,t:10,k:'weapon'},
'Astralite Crossbow':{p:1408136102,t:10,k:'weapon'},'Astralite Daggers':{p:1792766140,t:10,k:'weapon'},
'Astralite Hammer':{p:318446982,t:10,k:'tool'},'Astralite Hoe':{p:2109745066,t:10,k:'tool'},
'Astralite Knife':{p:1260356897,t:10,k:'tool'},'Astralite Mace':{p:1744196359,t:10,k:'weapon'},
'Astralite Machete':{p:527234707,t:10,k:'tool'},'Astralite Pickaxe':{p:909366533,t:10,k:'tool'},
'Astralite Quill':{p:237861696,t:10,k:'tool'},'Astralite Rod':{p:150640331,t:10,k:'tool'},
'Astralite Saw':{p:108221358,t:10,k:'tool'},'Astralite Scissors':{p:1184202153,t:10,k:'tool'},
'Astralite Shortsword':{p:1820283901,t:10,k:'weapon'},'Astralite Spear & Shield':{p:1252434161,t:10,k:'weapon'},

  // Plated T2-T6
'Pyrelite Plated Armor':{p:422440070,t:2,k:'plated_ar'},'Pyrelite Plated Belt':{p:922569705,t:2,k:'plated_be'},
'Pyrelite Plated Boots':{p:155776141,t:2,k:'plated_bo'},'Pyrelite Plated Helm':{p:1919532147,t:2,k:'plated_he'},
'Pyrelite Plated Bracers':{p:87535478,t:2,k:'plated_br'},'Pyrelite Plated Legguards':{p:826048995,t:2,k:'plated_le'},

'Emarium Plated Armor':{p:1268204743,t:3,k:'plated_ar'},'Emarium Plated Belt':{p:1682637898,t:3,k:'plated_be'},
'Emarium Plated Boots':{p:763048785,t:3,k:'plated_bo'},'Emarium Plated Helm':{p:2077008468,t:3,k:'plated_he'},
'Emarium Plated Bracers':{p:292570178,t:3,k:'plated_br'},'Emarium Plated Legguards':{p:1103185737,t:3,k:'plated_le'},

'Elenvar Plated Armor':{p:543757315,t:4,k:'plated_ar'},'Elenvar Plated Belt':{p:2093870307,t:4,k:'plated_be'},
'Elenvar Plated Boots':{p:1871358332,t:4,k:'plated_bo'},'Elenvar Plated Helm':{p:1382820561,t:4,k:'plated_he'},
'Elenvar Plated Bracers':{p:2057075881,t:4,k:'plated_br'},'Elenvar Plated Legguards':{p:1467877529,t:4,k:'plated_le'},

'Luminite Plated Armor':{p:1614334993,t:5,k:'plated_ar'},'Luminite Plated Belt':{p:803904452,t:5,k:'plated_be'},
'Luminite Plated Boots':{p:1205236443,t:5,k:'plated_bo'},'Luminite Plated Helm':{p:525926772,t:5,k:'plated_he'},
'Luminite Plated Bracers':{p:1284279632,t:5,k:'plated_br'},'Luminite Plated Legguards':{p:754775218,t:5,k:'plated_le'},

'Rathium Plated Armor':{p:1793408922,t:6,k:'plated_ar'},'Rathium Plated Belt':{p:1896878792,t:6,k:'plated_be'},
'Rathium Plated Boots':{p:1423216650,t:6,k:'plated_bo'},'Rathium Plated Helm':{p:1115040228,t:6,k:'plated_he'},
'Rathium Plated Bracers':{p:1555011340,t:6,k:'plated_br'},'Rathium Plated Legguards':{p:1426381959,t:6,k:'plated_le'},
  // Plated T7-T10 
'Aurumite Plated Armor':{p:1288616853,t:7,k:'plated_ar'},'Aurumite Plated Belt':{p:136895150,t:7,k:'plated_be'},
'Aurumite Plated Boots':{p:1766218099,t:7,k:'plated_bo'},'Aurumite Plated Helm':{p:1168955390,t:7,k:'plated_he'},
'Aurumite Plated Bracers':{p:2092460854,t:7,k:'plated_br'},'Aurumite Plated Legguards':{p:1402365193,t:7,k:'plated_le'},

'Celestium Plated Armor':{p:1539382157,t:8,k:'plated_ar'},'Celestium Plated Belt':{p:85682890,t:8,k:'plated_be'},
'Celestium Plated Boots':{p:937990529,t:8,k:'plated_bo'},'Celestium Plated Helm':{p:1578036637,t:8,k:'plated_he'},
'Celestium Plated Bracers':{p:2092460854,t:8,k:'plated_br'},'Celestium Plated Legguards':{p:706040362,t:8,k:'plated_le'},

'Umbracite Plated Armor':{p:1206079882,t:9,k:'plated_ar'},'Umbracite Plated Belt':{p:1342061977,t:9,k:'plated_be'},
'Umbracite Plated Boots':{p:33263838,t:9,k:'plated_bo'},'Umbracite Plated Helm':{p:999002692,t:9,k:'plated_he'},
'Umbracite Plated Bracers':{p:1481337975,t:9,k:'plated_br'},'Umbracite Plated Legguards':{p:1143633588,t:9,k:'plated_le'},

'Astralite Plated Armor':{p:676999714,t:10,k:'plated_ar'},'Astralite Plated Belt':{p:1134288202,t:10,k:'plated_be'},
'Astralite Plated Boots':{p:451224316,t:10,k:'plated_bo'},'Astralite Plated Helm':{p:394704078,t:10,k:'plated_he'},
'Astralite Plated Bracers':{p:675288287,t:10,k:'plated_br'},'Astralite Plated Legguards':{p:2092181285,t:10,k:'plated_le'},
  // Duelist T2-T6 
'Pyrelite Duelist Armor':{p:1554355057,t:2,k:'duelist_ar'},'Pyrelite Duelist Belt':{p:288183013,t:2,k:'duelist_be'},
'Pyrelite Duelist Boots':{p:664595734,t:2,k:'duelist_bo'},'Pyrelite Duelist Helm':{p:152653749,t:2,k:'duelist_he'},
'Pyrelite Duelist Bracers':{p:2044169478,t:2,k:'duelist_br'},'Pyrelite Duelist Legguards':{p:1918416442,t:2,k:'duelist_le'},

'Emarium Duelist Armor':{p:712055376,t:3,k:'duelist_ar'},'Emarium Duelist Belt':{p:1654952717,t:3,k:'duelist_be'},
'Emarium Duelist Boots':{p:1792280603,t:3,k:'duelist_bo'},'Emarium Duelist Helm':{p:1779898711,t:3,k:'duelist_he'},
'Emarium Duelist Bracers':{p:1409596491,t:3,k:'duelist_br'},'Emarium Duelist Legguards':{p:1867856730,t:3,k:'duelist_le'},

'Elenvar Duelist Armor':{p:1302571061,t:4,k:'duelist_ar'},'Elenvar Duelist Belt':{p:420782305,t:4,k:'duelist_be'},
'Elenvar Duelist Boots':{p:1883555938,t:4,k:'duelist_bo'},'Elenvar Duelist Helm':{p:947997324,t:4,k:'duelist_he'},
'Elenvar Duelist Bracers':{p:650219251,t:4,k:'duelist_br'},'Elenvar Duelist Legguards':{p:477821530,t:4,k:'duelist_le'},

'Luminite Duelist Armor':{p:1381073895,t:5,k:'duelist_ar'},'Luminite Duelist Belt':{p:2047631399,t:5,k:'duelist_be'},
'Luminite Duelist Boots':{p:134007121,t:5,k:'duelist_bo'},'Luminite Duelist Helm':{p:941973321,t:5,k:'duelist_he'},
'Luminite Duelist Bracers':{p:274271761,t:5,k:'duelist_br'},'Luminite Duelist Legguards':{p:209639785,t:5,k:'duelist_le'},

'Rathium Duelist Armor':{p:2139660051,t:6,k:'duelist_ar'},'Rathium Duelist Belt':{p:247907334,t:6,k:'duelist_be'},
'Rathium Duelist Boots':{p:62198748,t:6,k:'duelist_bo'},'Rathium Duelist Helm':{p:262655142,t:6,k:'duelist_he'},
'Rathium Duelist Bracers':{p:406791749,t:6,k:'duelist_br'},'Rathium Duelist Legguards':{p:1927576181,t:6,k:'duelist_le'},
  
  // Duelist T7-T10
'Aurumite Duelist Armor':{p:1759574046,t:7,k:'duelist_ar'},'Aurumite Duelist Belt':{p:1867643778,t:7,k:'duelist_be'},
'Aurumite Duelist Boots':{p:1113464036,t:7,k:'duelist_bo'},'Aurumite Duelist Bracers':{p:1371681362,t:7,k:'duelist_br'},
'Aurumite Duelist Helm':{p:1272659593,t:7,k:'duelist_he'},'Aurumite Duelist Legguards':{p:933553170,t:7,k:'duelist_le'},

'Celestium Duelist Armor':{p:1511926353,t:8,k:'duelist_ar'},'Celestium Duelist Belt':{p:663979557,t:8,k:'duelist_be'},
'Celestium Duelist Boots':{p:1596933905,t:8,k:'duelist_bo'},'Celestium Duelist Bracers':{p:835268734,t:8,k:'duelist_br'},
'Celestium Duelist Helm':{p:332321387,t:8,k:'duelist_he'},'Celestium Duelist Legguards':{p:952839179,t:8,k:'duelist_le'},

'Umbracite Duelist Armor':{p:1573634427,t:9,k:'duelist_ar'},'Umbracite Duelist Belt':{p:1333527025,t:9,k:'duelist_be'},
'Umbracite Duelist Boots':{p:479699131,t:9,k:'duelist_bo'},'Umbracite Duelist Bracers':{p:1622384894,t:9,k:'duelist_br'},
'Umbracite Duelist Helm':{p:2113725252,t:9,k:'duelist_he'},'Umbracite Duelist Legguards':{p:1236430591,t:9,k:'duelist_le'},

'Astralite Duelist Armor':{p:453964810,t:10,k:'duelist_ar'},'Astralite Duelist Belt':{p:663456834,t:10,k:'duelist_be'},
'Astralite Duelist Boots':{p:379236578,t:10,k:'duelist_bo'},'Astralite Duelist Bracers':{p:679524038,t:10,k:'duelist_br'},
'Astralite Duelist Helm':{p:638425412,t:10,k:'duelist_he'},'Astralite Duelist Legguards':{p:1758467540,t:10,k:'duelist_le'},

// 革装備 T2-T6
'simple leather belt':{p:1548924604,t:2,k:'leather_be'},'simple leather boots':{p:442339538,t:2,k:'leather_bo'},
'simple leather cap':{p:1437965200,t:2,k:'leather_ca'},'simple leather gloves':{p:471537919,t:2,k:'leather_gl'},
'simple leather Leggings':{p:1911943829,t:2,k:'leather_le'},'simple leather Shirt':{p:1911943829,t:2,k:'leather_sh'},

'sturdy leather belt':{p:1911943829,t:3,k:'leather_be'}, 'sturdy leather boots':{p:45851234,t:3,k:'leather_bo'},
'sturdy leather cap':{p:475668425,t:3,k:'leather_ca'}, 'sturdy leather gloves':{p:104188419,t:3,k:'leather_gl'},
'sturdy leather leggings':{p:1475691769,t:3,k:'leather_le'}, 'sturdy leather shirt':{p:767288477,t:3,k:'leather_sh'},

'fine leather belt':{p:267188619,t:4,k:'leather_be'}, 'fine leather boots':{p:687015665,t:4,k:'leather_bo'},
'fine leather cap':{p:2092519490,t:4,k:'leather_ca'}, 'fine leather gloves':{p:119486624,t:4,k:'leather_gl'},
'fine leather leggings':{p:1764915050,t:4,k:'leather_le'}, 'fine leather shirt':{p:1790099921,t:4,k:'leather_sh'},

'exquisite leather belt':{p:1148010649,t:5,k:'leather_be'}, 'exquisite leather boots':{p:1576306916,t:5,k:'leather_bo'},
'exquisite leather cap':{p:519083873,t:5,k:'leather_ca'}, 'exquisite leather gloves':{p:1388204483,t:5,k:'leather_gl'},
'exquisite leather leggings':{p:501062290,t:5,k:'leather_le'}, 'exquisite leather shirt':{p:975181088,t:5,k:'leather_sh'},

'peerless leather belt':{p:1738310260,t:6,k:'leather_be'}, 'peerless leather boots':{p:1600561783,t:6,k:'leather_bo'},
'peerless leather cap':{p:390309715,t:6,k:'leather_ca'}, 'peerless leather gloves':{p:248609097,t:6,k:'leather_gl'},
'peerless leather leggings':{p:1245381696,t:6,k:'leather_le'}, 'peerless leather shirt':{p:327065735,t:6,k:'leather_sh'},
//革装備 T7-T10
'ornate leather belt':{p:1639525324,t:7,k:'leather_be'}, 'ornate leather boots':{p:27075659,t:7,k:'leather_bo'},
'ornate leather cap':{p:1259363783,t:7,k:'leather_ca'}, 'ornate leather gloves':{p:411811927,t:7,k:'leather_gl'},
'ornate leather leggings':{p:1422988853,t:7,k:'leather_le'}, 'ornate leather shirt':{p:275250276,t:7,k:'leather_sh'},

'pristine leather belt':{p:1639525324,t:8,k:'leather_be'}, 'pristine leather boots':{p:27075659,t:8,k:'leather_bo'},
'pristine leather cap':{p:1259363783,t:8,k:'leather_ca'}, 'pristine leather gloves':{p:411811927,t:8,k:'leather_gl'},
'pristine leather leggings':{p:1422988853,t:8,k:'leather_le'}, 'pristine leather shirt':{p:275250276,t:8,k:'leather_sh'},

'magnificent leather belt':{p:1392853274,t:9,k:'leather_be'}, 'magnificent leather boots':{p:1027946022,t:9,k:'leather_bo'},
'magnificent leather cap':{p:1488876546,t:9,k:'leather_ca'}, 'magnificent leather gloves':{p:1474288184,t:9,k:'leather_gl'},
'magnificent leather leggings':{p:172806342,t:9,k:'leather_le'}, 'magnificent leather shirt':{p:60984074,t:9,k:'leather_sh'},

'flawless leather belt':{p:148416223,t:10,k:'leather_be'}, 'flawless leather shoes':{p:566693853,t:10,k:'leather_bo'},
'flawless leather cap':{p:371225209,t:10,k:'leather_ca'}, 'flawless leather gloves':{p:817248199,t:10,k:'leather_gl'},
'flawless leather leggings':{p:982285702,t:10,k:'leather_le'}, 'flawless leather shirt':{p:495020093,t:10,k:'leather_sh'},

//布装備 T2-T6
'simple woven belt':{p:922569704,t:2,k:'woven_be'},'simple woven shoes':{p:155776140,t:2,k:'woven_shoes'},
'simple woven cap':{p:1919532146,t:2,k:'woven_cap'},'simple woven gloves':{p:87535477,t:2,k:'woven_gloves'},
'simple woven shorts':{p:826048994,t:2,k:'woven_shorts'},'simple woven shirt':{p:422440069,t:2,k:'woven_shirt'},

'sturdy woven belt':{p:726338348,t:3,k:'woven_be'},'sturdy woven shoes':{p:346206325,t:3,k:'woven_shoes'},
'sturdy woven cap':{p:29896794,t:3,k:'woven_cap'},'sturdy woven gloves':{p:2020078588,t:3,k:'woven_gloves'},
'sturdy woven shorts':{p:543187335,t:3,k:'woven_shorts'},'sturdy woven shirt':{p:479534285,t:3,k:'woven_shirt'},

'fine woven belt':{p:83640847,t:4,k:'woven_be'},'fine woven shoes':{p:331949206,t:4,k:'woven_shoes'},
'fine woven cap':{p:162644991,t:4,k:'woven_cap'},'fine woven gloves':{p:259933928,t:4,k:'woven_gloves'},
'fine woven shorts':{p:1352602844,t:4,k:'woven_shorts'},'fine woven shirt':{p:511280124,t:4,k:'woven_shirt'},

'exquisite woven belt':{p:441797484,t:5,k:'woven_be'},'exquisite woven shoes':{p:1162422512,t:5,k:'woven_shoes'},
'exquisite woven cap':{p:620814151,t:5,k:'woven_cap'},'exquisite woven gloves':{p:1617307693,t:5,k:'woven_gloves'},
'exquisite woven shorts':{p:442252346,t:5,k:'woven_shorts'},'exquisite woven shirt':{p:365162243,t:5,k:'woven_shirt'},

'peerless woven belt':{p:1349195810,t:6,k:'woven_be'},'peerless woven shoes':{p:1945743787,t:6,k:'woven_shoes'},
'peerless woven cap':{p:559085155,t:6,k:'woven_cap'},'peerless woven gloves':{p:207881,t:6,k:'woven_gloves'},
'peerless woven shorts':{p:2128345856,t:6,k:'woven_shorts'},'peerless woven shirt':{p:1447863644,t:6,k:'woven_shirt'},

//布装備 T7-T10 8からはまた今度追加する
'ornate woven belt':{p:1688584641,t:7,k:'woven_be'},'ornate woven shoes':{p:116606120,t:7,k:'woven_shoes'},
'ornate woven cap':{p:635237877,t:7,k:'woven_cap'},'ornate woven gloves':{p:1475629311,t:7,k:'woven_gloves'},
'ornate woven shorts':{p:1531238524,t:7,k:'woven_shorts'},'ornate woven shirt':{p:325112899,t:7,k:'woven_shirt'},
}


function getManualRecipe(itemId, itemName, tier) {
  if (!itemName) return null;
  const d = CRAFT_DB[itemName];
  if (!d) return null;
  let stacks;
  const m = d.t ? TIER_MATS[d.t] : null;
  if (d.k === 'direct') {
    stacks = d.s.map(x => ({item_id:x.id,quantity:x.q,item_type:'item'}));
  } else if (d.k === 'tool' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 4, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' },
    { item_id: m.plank, quantity: 2, item_type: 'item' },
    { item_id: m.rope, quantity: 2, item_type: 'item' }
  ];
  } else if (d.k === 'weapon' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 5, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: m.plank, quantity: 1, item_type: 'item' },
    { item_id: m.rope, quantity: 1, item_type: 'item' }
  ];
  } else if (d.k === 'plated_ar' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 5, item_type: 'item' },
    { item_id: m.cloth, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'plated_be' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'plated_bo' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'plated_he' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 4, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'plated_br' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'plated_le' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 4, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'duelist_ar' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 4, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 15, item_type: 'item' }
  ];

} else if (d.k === 'duelist_be' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 5, item_type: 'item' }
  ];

} else if (d.k === 'duelist_bo' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 5, item_type: 'item' }
  ];

} else if (d.k === 'duelist_br' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 5, item_type: 'item' }
  ];

} else if (d.k === 'duelist_he' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 3, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 10, item_type: 'item' }
  ];

} else if (d.k === 'duelist_le' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 3, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 10, item_type: 'item' }
  ];

} else if (d.k === 'leather_be' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'leather_bo' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'leather_ca' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 4, item_type: 'item' },
    { item_id: m.ingot, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'leather_gl' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'leather_le' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 4, item_type: 'item' },
    { item_id: m.ingot, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'leather_sh' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 5, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'woven_be' && m) {
  // belt
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'woven_shoes' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'woven_cap' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 4, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'woven_gloves' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'woven_shorts' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 4, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'woven_shirt' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 5, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'prev' && d.p) {
    stacks = [{item_id:d.p,quantity:1,item_type:'item'}];
  } else return null;
  return {
    consumedItemStacks: stacks.filter(s => s.item_id),
    craftedItemStacks: [{item_id:itemId,quantity:1}],
    recipeType: 'manual',
    name: '手動クラフト (新規クラフト)',
  };
}

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
