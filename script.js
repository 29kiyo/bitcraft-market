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
  if (!iconCache.has(iconAssetName)) {
    iconCache.set(iconAssetName, `https://bitjita.com/${iconAssetName}.webp`);
  }
  return iconCache.get(iconAssetName);
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
  applyFilters();
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
        <img class="s-icon" src="${iconUrl}" alt="${item.name}" onerror="this.style.display='none'">
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
  const pageItems = filtered.slice(0, LOG_PER_PAGE * LOG_MAX_PAGES).slice(0, LOG_PER_PAGE);
  const tbody = document.querySelector('#tradeLog tbody');
  if (tbody) tbody.innerHTML = renderLogRows(pageItems);
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
  const existing = window._calcList.find(i => i.itemName === itemName && i.claimName === order.claimName);
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
