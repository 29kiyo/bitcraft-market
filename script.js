// ============================================
// BitCraft Market Search - script.js
// ============================================

const API_BASE = 'https://bitcraft-proxy.29kiyo.workers.dev/api';

// アイコン画像をキャッシュして再ロードを防ぐ
const iconCache = new Map();
function getCachedIcon(iconAssetName) {
  if (!iconAssetName) return '';
  if (iconCache.has(iconAssetName)) return iconCache.get(iconAssetName);
  const url = `https://bitjita.com/${iconAssetName}.webp`;
  iconCache.set(iconAssetName, url);
  return url;
}

// キャッシュ自動削除機能
let cacheClearTimer = null;
const CACHE_CLEAR_INTERVAL = 60 * 60 * 1000; // 1時間

function clearCaches() {
  // アイコンキャッシュをクリア
  iconCache.clear();
  // マーケットデータキャッシュをクリア
  cachedMarketItems = null;
  fetchPromise = null;
  console.log('キャッシュをクリアしました');
}

function startCacheClearTimer() {
  if (cacheClearTimer) clearTimeout(cacheClearTimer);
  cacheClearTimer = setTimeout(() => {
    clearCaches();
    startCacheClearTimer(); // 再度タイマー開始
  }, CACHE_CLEAR_INTERVAL);
}

// ページ読み込み時にタイマー開始
startCacheClearTimer();

// ページを閉じるときにキャッシュをクリア
window.addEventListener('beforeunload', () => {
  clearCaches();
});

// リロード時にもキャッシュをクリア（beforeunloadはリロード時にも発火するが念のため）
window.addEventListener('pagehide', () => {
  clearCaches();
});


const HEADERS = { 'x-app-identifier': 'bitcraft-market-search-github-pages' };

// BitCraft Map用のベースURL（座標→マップリンク）
const MAP_BASE = 'https://map.bitcraft.com';

// DOM要素
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const suggestions = document.getElementById('suggestions');
const orderTypeFilter = null; // 削除済み
const resultSection = document.getElementById('resultSection');
const emptyState = document.getElementById('emptyState');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const searchResults = document.getElementById('searchResults');
const searchResultsList = document.getElementById('searchResultsList');
const backBtn = document.getElementById('backBtn');



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

// 状態
let currentItems = [];
let currentPage = 1;
let savedScrollPosition = 0;
let currentOrderPage = 1;
const ORDERS_PER_PAGE = 7;
let currentOrderSort = 'asc';
let currentOrderRegion = '';
let currentOrderClaim = '';
let currentOrderType = '';

let claimDebounceTimer = null;
window.changeOrderClaim = function(claim) {
  clearTimeout(claimDebounceTimer);
  claimDebounceTimer = setTimeout(() => {
    currentOrderClaim = claim;
    renderOrders(currentOrders, currentOrderType, 1, currentOrderSort, currentOrderRegion, claim);
    const input = document.getElementById('claimSearchInput');
    if (input) {
      input.value = claim;
      input.focus();
      // カーソルを末尾に移動
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

const ITEMS_PER_PAGE = 20;
let currentOrders = [];

// マルチセレクト管理
function getCheckedValues(type) {
  const dropdown = document.getElementById(`${type}Dropdown`);
  if (!dropdown) return [];
  return [...dropdown.querySelectorAll('input[type=checkbox]:not([value=all]):checked')]
    .map(cb => cb.value);
}

function toggleDropdown(id) {
  const dropdown = document.getElementById(id);
  dropdown.classList.toggle('hidden');
}

function toggleParentCategory(el) {
  el.classList.toggle('open');
  el.nextElementSibling.classList.toggle('open');
}

// 親カテゴリマッピングを生成する関数
function buildParentCategoryMap() {
  const map = {};
  const sections = document.querySelectorAll('#categoryDropdown .ms-section');
  sections.forEach(section => {
    const parentEl = section.querySelector('.ms-parent');
    if (!parentEl) return;
    const parentText = parentEl.textContent.replace(/[^\w\u4e00-\u9faf\u3040-\u30ff]/g, '').trim();
    const childInputs = section.querySelectorAll('.ms-child input[type="checkbox"]');
    childInputs.forEach(input => {
      const tag = input.value;
      if (tag) map[tag] = parentText;
    });
  });
  return map;
}
let parentCategoryMap = {};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    parentCategoryMap = buildParentCategoryMap();
  });
} else {
  parentCategoryMap = buildParentCategoryMap();
}


function updateMultiLabel(type) {
  const values = getCheckedValues(type);
  const label = document.getElementById(`${type}Label`);
  if (!label) return;
  if (values.length === 0) {
    label.textContent = 'すべて';
  } else {
    label.textContent = `${values.length}件選択中`;
  }
  applyFilters();
}

function handleMultiAll(type, cb) {
  const dropdown = document.getElementById(`${type}Dropdown`);
  if (!dropdown) return;
  const checkboxes = [...dropdown.querySelectorAll('input[type=checkbox]:not([value=all])')];
  checkboxes.forEach(c => c.checked = false);
  cb.checked = false;
  updateMultiLabel(type);
}

// ドロップダウン外クリックで閉じる
document.addEventListener('click', e => {
  if (!e.target.closest('.search-box')) hideSuggestions();
  if (!e.target.closest('.multi-select-wrap')) {
    document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.add('hidden'));
  }
});

let accumulatedTrades = [];
const MAX_TRADES = 50;
let debounceTimer = null;

let cachedMarketItems = null;
let fetchPromise = null;

async function fetchAllMarketItems() {
  if (cachedMarketItems) return cachedMarketItems;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    // offsetが効かない場合があるので固定で大きめに1回取得
    const res = await fetch(
      `${API_BASE}/market?hasOrders=true&limit=2000`,
      { headers: HEADERS }
    );
    if (!res.ok) throw new Error('fetch failed');
    const json = await res.json();
    cachedMarketItems = json?.data?.items || [];
    return cachedMarketItems;
  })();

  return fetchPromise;
}

// ============================================
// 初期化
// ============================================
searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});
searchInput.addEventListener('input', onSearchInput);
document.addEventListener('click', e => {
  if (!e.target.closest('.search-box')) hideSuggestions();
});

// if (orderTypeFilter) orderTypeFilter.addEventListener('change', applyFilters); // 削除済み
searchInput.addEventListener('blur', () => {
  setTimeout(() => hideSuggestions(), 200);
});

// ============================================
// 検索オートサジェスト
// ============================================
async function onSearchInput() {
  const q = searchInput.value.trim();
  if (q.length < 2) { hideSuggestions(); return; }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // タイムアウト時に最新の値を取得
    const latestQ = searchInput.value.trim();
    fetchSuggestions(latestQ);
  }, 500);
}

async function fetchSuggestions(q) {
  try {
    const allItems = await fetchAllMarketItems();
    const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(q);
    
    let filtered = [];
    
    if (hasJapanese) {
      // 日本語の場合：マッチする全ての翻訳候補で検索
      const matchedEn = new Set();
      // 読み仮名（ひらがな・カタカナ）検索も追加
const yomiMatched = searchByYomi(q);
yomiMatched.forEach(en => matchedEn.add(en));
      const sorted = Object.entries(ITEM_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
      for (const [ja, en] of sorted) {
        if (ja.includes(q) || q.includes(ja) ||
    toHiragana(ja).includes(toHiragana(q)) || toHiragana(q).includes(toHiragana(ja))) {
          matchedEn.add(en.toLowerCase());
        }
      }
      
      if (matchedEn.size > 0) {
        filtered = allItems.filter(item => {
          const name = item.name.toLowerCase();
          for (const en of matchedEn) {
            if (name.includes(en)) return true;
          }
          return false;
        });
      }
    } else {
      // 英語の場合：そのまま検索
      filtered = allItems.filter(item =>
        item.name.toLowerCase().includes(q.toLowerCase())
      );
    }

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
// 日本語名が英語名より短すぎる場合（プレフィックスのみ）は使わない
const useJaName = jaName && jaName.length > 2 && item.name.toLowerCase() !== jaName.toLowerCase();

const parentCategory = parentCategoryMap[item.tag] || '';
const jaParentCategory = getJaName(parentCategory) || parentCategory;

const displayName = useJaName ? `${jaName} ${item.name}` : item.name;
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

  // 検索ワードが変わったときだけフィルターをクリア
  if (q !== window._lastSearchQuery) {
    document.querySelectorAll('#tierDropdown input[type=checkbox]').forEach(cb => cb.checked = false);
    document.getElementById('tierLabel').textContent = 'すべて';
    document.querySelectorAll('#rarityDropdown input[type=checkbox]').forEach(cb => cb.checked = false);
    document.getElementById('rarityLabel').textContent = 'すべて';
    document.querySelectorAll('#categoryDropdown input[type=checkbox]').forEach(cb => cb.checked = false);
    document.getElementById('categoryLabel').textContent = 'すべて';
// const otf = document.getElementById('orderTypeFilter');
// if (otf) otf.value = ''; // 削除済み
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

    // 検索ワードがある場合のみ名前フィルタリング
    if (q) {
      if (hasJapanese) {
        const matchedEn = new Set();
        // 読み仮名（ひらがな・カタカナ）検索も追加
const yomiMatched = searchByYomi(q);
yomiMatched.forEach(en => matchedEn.add(en));
        const sorted = Object.entries(ITEM_TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
        for (const [ja, en] of sorted) {
          if (ja.includes(q) || q.includes(ja) ||
    toHiragana(ja).includes(toHiragana(q)) || toHiragana(q).includes(toHiragana(ja))) matchedEn.add(en.toLowerCase());
        }
        if (matchedEn.size > 0) {
          filtered = filtered.filter(item => {
            const name = item.name.toLowerCase();
            for (const en of matchedEn) {
              if (name.includes(en)) return true;
            }
            return false;
          });
        }
      } else {
        filtered = filtered.filter(item =>
          item.name.toLowerCase().includes(q.toLowerCase())
        );
      }
    }

    if (tiers.length > 0) {
  filtered = filtered.filter(item => tiers.includes(String(item.tier)));
}
if (rarities.length > 0) {
  filtered = filtered.filter(item => rarities.includes(String(item.rarity)));
}
if (categories.length > 0) {
  const allTags = new Set();
  const select = document.getElementById('categoryDropdown');
  categories.forEach(cat => {
    if (cat.startsWith('__group__')) {
      const options = [...document.querySelectorAll(`#categoryDropdown input[type=checkbox]`)];
      const groupIdx = options.findIndex(o => o.value === cat);
      for (let i = groupIdx + 1; i < options.length; i++) {
        if (options[i].value.startsWith('__group__')) break;
        allTags.add(options[i].value);
      }
    } else {
      allTags.add(cat);
    }
  });
  filtered = filtered.filter(item => allTags.has(item.tag));
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
function renderSearchResults(items, page = 1) {
  hideSuggestions();
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = items.slice(start, end);

  searchResultsList.innerHTML = `
    <h3 class="section-title">🔍 検索結果 <span class="order-count">${items.length}件</span></h3>
    ${totalPages > 1 ? `
  <div class="pagination">
    <button class="page-btn" onclick="changePage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← 前へ</button>
    <span class="page-info">${page} / ${totalPages}</span>
    <button class="page-btn" onclick="changePage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>次へ →</button>
  </div>
` : ''}

    <div class="result-grid">
      ${pageItems.map(item => {
        const iconUrl = getCachedIcon(item.iconAssetName);
        const jaName = getJaName(item.name);
        const useJaName = jaName && jaName.length > 2;
        const displayName = useJaName ? `${jaName} ${item.name}` : item.name;
        return `
          <div class="result-card" onclick="selectItem('${item.id}')">
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
              ${item.tag ? `
                ${parentCategoryMap[item.tag] ? `<span class="s-parent-category">${getJaName(parentCategoryMap[item.tag]) || parentCategoryMap[item.tag]}</span>` : ''}
                <span class="s-tag">${getJaName(item.tag) || item.tag}</span>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${totalPages > 1 ? `
      <div class="pagination">
        <button class="page-btn" onclick="changePage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← 前へ</button>
        <span class="page-info">${page} / ${totalPages}</span>
        <button class="page-btn" onclick="changePage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>次へ →</button>
      </div>
    ` : ''}
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
const orderType = '';
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

    // 現在のアイテムを保存（期間切り替え用）
    window._currentItem = enrichedItem;

    // 注文種別フィルターをリセット
    currentOrderType = '';

    renderResult(enrichedItem, priceData, currentOrders, orderType);
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
  const q = searchInput.value.trim();
  if (q || tiers.length > 0 || rarities.length > 0 || categories.length > 0) {
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
  renderTradeLog(priceData); // 追加

  resultSection.classList.remove('hidden');
  emptyState.classList.add('hidden');
  updatePriceByRegion();
}

function renderItemHeader(item) {
  const jaName = getJaName(item.name);
  const useJaName = jaName && jaName.length > 2;
  const iconUrl = getCachedIcon(item.iconAssetName);

  
  document.getElementById('itemHeader').innerHTML = `
    <div class="item-title">
      <img class="item-icon" src="${iconUrl}" alt="${item.name}" onerror="this.style.display='none'">
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

  const changeHtml = change24h != null
    ? `<span class="${change24h >= 0 ? 'pos' : 'neg'}">${change24h >= 0 ? '▲' : '▼'} ${Math.abs(change24h).toFixed(1)}%</span>`
    : '';
  const change7dHtml = change7d != null
    ? `<span class="${change7d >= 0 ? 'pos' : 'neg'}">${change7d >= 0 ? '▲' : '▼'} ${Math.abs(change7d).toFixed(1)}%</span>`
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
        <option value="">全リージョン</option>
        ${regionOptions}
      </select>
    </div>
    <div class="price-cards">
      <div class="price-card sell">
        <div class="pc-label">最低売値</div>
        <div class="pc-value" id="pcLowestSell">${formatPrice(lowestSell)}</div>
        <div class="pc-sub">Lowest Sell</div>
      </div>
      <div class="price-card buy">
        <div class="pc-label">最高買値</div>
        <div class="pc-value" id="pcHighestBuy">${formatPrice(highestBuy)}</div>
        <div class="pc-sub">Highest Buy</div>
      </div>
      <div class="price-card avg-sell">
        <div class="pc-label">平均売値</div>
        <div class="pc-value" id="pcAvgSell">—</div>
        <div class="pc-sub">Avg Sell</div>
      </div>
      <div class="price-card avg-buy">
        <div class="pc-label">平均買値</div>
        <div class="pc-value" id="pcAvgBuy">—</div>
        <div class="pc-sub">Avg Buy</div>
      </div>
      <div class="price-card avg">
        <div class="pc-label">24h平均</div>
        <div class="pc-value" id="pcAvg24h">${formatPrice(avg24h)} ${changeHtml}</div>
        <div class="pc-sub">24h Average</div>
      </div>
      <div class="price-card avg7">
        <div class="pc-label">7日平均</div>
        <div class="pc-value" id="pcAvg7d">${formatPrice(avg7d)} ${change7dHtml}</div>
        <div class="pc-sub">7-day Average</div>
      </div>
      <div class="price-card vol">
        <div class="pc-label">24h取引量</div>
        <div class="pc-value" id="pcVol">${formatNum(volume24h)}</div>
        <div class="pc-sub">24h Volume</div>
      </div>
    </div>
  `;
}

window.updatePriceByRegion = function() {
  const region = document.getElementById('priceRegionFilter')?.value || '';
  const filtered = region ? currentOrders.filter(o => o.regionName === region) : currentOrders;
  
  const sells = filtered.filter(o => o.orderType === 'sell');
  const buys = filtered.filter(o => o.orderType === 'buy');
  
  const lowestSell = sells.length > 0
    ? Math.min(...sells.map(o => Number(o.priceThreshold)))
    : null;
  const highestBuy = buys.length > 0
    ? Math.max(...buys.map(o => Number(o.priceThreshold)))
    : null;

  const pcLowestSell = document.getElementById('pcLowestSell');
  const pcHighestBuy = document.getElementById('pcHighestBuy');
  const pcAvg24h = document.getElementById('pcAvg24h');
  const pcAvg7d = document.getElementById('pcAvg7d');
  const pcVol = document.getElementById('pcVol');

  const avgSell = sells.length > 0
    ? Math.floor(sells.reduce((s, o) => s + Number(o.priceThreshold), 0) / sells.length)
    : null;
  const avgBuy = buys.length > 0
    ? Math.floor(buys.reduce((s, o) => s + Number(o.priceThreshold), 0) / buys.length)
    : null;

  const pcAvgSell = document.getElementById('pcAvgSell');
  const pcAvgBuy = document.getElementById('pcAvgBuy');

  if (pcLowestSell) pcLowestSell.innerHTML = formatPrice(lowestSell ?? '—');
  if (pcHighestBuy) pcHighestBuy.innerHTML = formatPrice(highestBuy ?? '—');
  if (pcAvgSell) pcAvgSell.innerHTML = formatPrice(avgSell ?? '—');
  if (pcAvgBuy) pcAvgBuy.innerHTML = formatPrice(avgBuy ?? '—');

  if (region) {
    if (pcAvg24h) pcAvg24h.innerHTML = '—';
    if (pcAvg7d) pcAvg7d.innerHTML = '—';
    if (pcVol) pcVol.innerHTML = '—';
  }
};

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
    if (period === '24h') return `${date.getHours()}:00`;
    return `${date.getMonth()+1}/${date.getDate()}`;
  });
  const prices = sorted.map(d => Math.round(d.avgPrice));
  const volumes = sorted.map(d => d.volume);

  new Chart(document.getElementById('priceCanvas'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '平均価格',
        data: prices,
        borderColor: '#00c896',
        backgroundColor: 'rgba(0,200,150,0.1)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#00c896',
      }]
    },
    options: {
  responsive: true,
  plugins: { legend: { labels: { color: '#aaa' } } },
  scales: {
    x: {
      ticks: {
        color: '#aaa',
        maxRotation: 45,
        autoSkip: false  // ← 全ラベル表示
      },
      grid: { color: 'rgba(255,255,255,0.15)' }
    },
    y: {
      ticks: { color: '#aaa' },
      grid: { color: 'rgba(255,255,255,0.15)' }
    }
  }
}
  });

  new Chart(document.getElementById('volumeCanvas'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '取引量',
        data: volumes,
        backgroundColor: 'rgba(91,156,246,0.5)',
        borderColor: '#5b9cf6',
        borderWidth: 1,
      }]
    },
    options: {
  responsive: true,
  plugins: { legend: { labels: { color: '#aaa' } } },
  scales: {
    x: {
      ticks: {
        color: '#aaa',
        maxRotation: 45,
        autoSkip: false  // ← 全ラベル表示
      },
      grid: { color: 'rgba(255,255,255,0.15)' }
    },
    y: {
      ticks: { color: '#aaa' },
      grid: { color: 'rgba(255,255,255,0.15)' }
    }
  }
}
  });
}

window.changePeriod = async function(period) {
  const item = window._currentItem;
  if (!item) return;

  const bucketMap = { '24h': '1+hour', '7d': '1+day', '30d': '1+day' };
  const limitMap = { '24h': 24, '7d': 7, '30d': 30 };

  const res = await fetch(
    `${API_BASE}/market/${item.itemOrCargo}/${item.id}/price-history?bucket=${bucketMap[period]}&limit=${limitMap[period]}`,
    { headers: HEADERS }
  );
  const priceData = res.ok ? await res.json() : null;
  renderPriceChart(priceData, period);
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
          <div class="sd-fill sell-fill" style="width: ${supplyPct}%">
            <span>${supplyPct}%</span>
          </div>
          <div class="sd-fill buy-fill" style="width: ${demandPct}%">
            <span>${demandPct}%</span>
          </div>
        </div>
        <div class="sd-bar-labels">
          <span>供給 ${supplyPct}%</span>
          <span>需要 ${demandPct}%</span>
        </div>
      </div>
    </div>
  `;
};

function renderOrders(orders, orderType, page = 1, sort = 'asc', regionFilter = '', claimFilter = '') {
  currentOrderPage = page;
  currentOrderSort = sort;
  const effectiveOrderType = currentOrderType;

  let filtered = orders;
  if (effectiveOrderType === 'sell') filtered = orders.filter(o => o.orderType === 'sell');
  if (effectiveOrderType === 'buy') filtered = orders.filter(o => o.orderType === 'buy');
  if (regionFilter) filtered = filtered.filter(o => o.regionName === regionFilter);
  if (claimFilter) filtered = filtered.filter(o => o.claimName?.toLowerCase().includes(claimFilter.toLowerCase()));

  if (sort === 'asc') {
    filtered.sort((a, b) => Number(a.priceThreshold) - Number(b.priceThreshold));
  } else {
    filtered.sort((a, b) => Number(b.priceThreshold) - Number(a.priceThreshold));
  }

  const totalPages = Math.ceil(filtered.length / ORDERS_PER_PAGE);
  const start = (page - 1) * ORDERS_PER_PAGE;
  const pageOrders = filtered.slice(start, start + ORDERS_PER_PAGE);

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
    </div>
  ` : '';

  const html = filtered.length === 0
    ? '<p class="no-orders">注文が見つかりませんでした</p>'
    : `
      ${pagination}
      <div class="orders-table-wrap">
        <table class="orders-table">
          <thead>
            <tr>
              <th>種別</th>
              <th style="white-space:nowrap;">
                価格
                <span style="display:inline-flex; flex-direction:column; gap:2px; margin-left:4px; vertical-align:middle;">
                  <button class="sort-btn ${sort === 'asc' ? 'active' : ''}" onclick="changeOrderSort('asc')">↑</button>
                  <button class="sort-btn ${sort === 'desc' ? 'active' : ''}" onclick="changeOrderSort('desc')">↓</button>
                </span>
              </th>
              <th>数量</th>
              <th>領地名</th>
              <th>リージョン</th>
              <th>座標</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${pageOrders.map(o => `
              <tr class="order-row ${o.orderType}">
                <td><span class="order-badge ${o.orderType}">${o.orderType === 'sell' ? '売り' : '買い'}</span></td>
                <td class="price-cell">${formatPrice(o.priceThreshold)}</td>
                <td>${formatNum(o.quantity)}</td>
                <td class="claim-name">${o.claimName || '—'}</td>
                <td>${o.regionName ? `${o.regionName} (R${o.regionId})` : '—'}</td>
                <td class="coords">${formatCoords(o)}</td>
                ${o.orderType === 'sell' ? `<td><button onclick="addToCalcList(${JSON.stringify(o).replace(/"/g, '&quot;')}, '${window._currentItem?.name || ''}')" style="background:rgba(0,200,150,0.1);border:1px solid rgba(0,200,150,0.3);color:#00c896;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:12px;">追加</button></td>` : '<td></td>'}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${pagination}
    `;

  document.getElementById('ordersList').innerHTML = `
    <div class="orders-list-header">
      <h3 class="section-title">📋 注文一覧 <span class="order-count">${filtered.length}件</span></h3>
      <div class="order-type-tabs">
        <button class="tab-btn ${effectiveOrderType === '' ? 'active' : ''}" onclick="changeOrderType('')">売り＆買い (${filtered.length})</button>
        <button class="tab-btn ${effectiveOrderType === 'sell' ? 'active' : ''}" onclick="changeOrderType('sell')">売り (${sellCount})</button>
        <button class="tab-btn ${effectiveOrderType === 'buy' ? 'active' : ''}" onclick="changeOrderType('buy')">買い (${buyCount})</button>
        <select class="region-order-filter" onchange="changeOrderRegion(this.value)">
          <option value="">全リージョン</option>
          ${regionOptions}
        </select>
      </div>
      <div class="orders-search-bar">
        <input type="text" id="claimSearchInput" class="claim-search" placeholder="領地名検索..." oninput="changeOrderClaim(this.value)" value="${claimFilter}">
      </div>
    </div>
    ${html}
  `;
}

  

let currentLogPage = 1;
const LOG_PER_PAGE = 20;
const LOG_MAX_PAGES = 5;

function renderTradeLog(priceData) {
  const newTrades = priceData?.recentTrades || [];
  if (newTrades.length === 0) {
    document.getElementById('tradeLog').innerHTML = '';
    return;
  }

  // 既存のログと新しいログをマージ（IDで重複排除）
  const existingIds = new Set(accumulatedTrades.map(t => t.id));
  const uniqueNewTrades = newTrades.filter(t => !existingIds.has(t.id));
  
  // 新しいものを先頭に追加
  accumulatedTrades = [...uniqueNewTrades, ...accumulatedTrades];
  
  // 50件超えたら古いものを削除
  if (accumulatedTrades.length > MAX_TRADES) {
    accumulatedTrades = accumulatedTrades.slice(0, MAX_TRADES);
  }

  window._tradeLogs = accumulatedTrades;
  currentLogPage = 1;
  renderLogTable(accumulatedTrades, currentLogPage);
}

function renderLogTable(trades, page) {
  const maxItems = LOG_PER_PAGE * LOG_MAX_PAGES;
  const limited = trades.slice(0, maxItems);
  const totalPages = Math.ceil(limited.length / LOG_PER_PAGE);
  const start = (page - 1) * LOG_PER_PAGE;
  const pageItems = limited.slice(start, start + LOG_PER_PAGE);

  const pagination = totalPages > 1 ? `
    <div class="pagination">
      <button class="page-btn" onclick="changeLogPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← 前へ</button>
      <span class="page-info">${page} / ${totalPages}</span>
      <button class="page-btn" onclick="changeLogPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>次へ →</button>
    </div>
  ` : '';

  document.getElementById('tradeLog').innerHTML = `
    <h3 class="section-title">📜 取引ログ <span class="order-count">${limited.length}件</span></h3>
    <button class="refresh-btn" onclick="refreshTradeLog()">🔄 ログ更新</button>
    <div class="log-filter">
      <select id="logRegionFilter" onchange="filterTradeLog()">
  <option value="">全リージョン</option>
  ${[...new Set(trades.map(t => t.regionName).filter(Boolean))].sort().map(r => {
    const rid = trades.find(t => t.regionName === r)?.regionId || '';
    const selected = (document.getElementById('logRegionFilter')?.value === r) ? 'selected' : '';
    return `<option value="${r}" ${selected}>${r} (R${rid})</option>`;
  }).join('')}
</select>
    </div>
    ${pagination}
    <div class="log-table-wrap">
      <table class="log-table">
        <thead>
          <tr>
            <th>日時</th>
            <th>買い手</th>
            <th>売り手</th>
            <th>リージョン</th>
            <th>単価</th>
            <th>数量</th>
            <th>合計</th>
          </tr>
        </thead>
        <tbody>
          ${renderLogRows(pageItems)}
        </tbody>
      </table>
    </div>
    ${pagination}
  `;
}

function renderLogRows(trades) {
  return trades.map(t => {
    const date = new Date(t.timestamp);
    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    return `
      <tr>
        <td>${dateStr}</td>
        <td>${t.buyerUsername || '—'}</td>
        <td>${t.sellerUsername || '—'}</td>
        <td>${t.regionName || '—'} (R${t.regionId || ''})</td>
        <td class="price-cell">${formatPrice(t.unitPrice)}</td>
        <td>${formatNum(t.quantity)}</td>
        <td class="price-cell">${formatPrice(t.price)}</td>
      </tr>
    `;
  }).join('');
}

window.changeLogPage = function(page) {
  currentLogPage = page;
  const region = document.getElementById('logRegionFilter')?.value || '';
  const trades = window._tradeLogs || [];
  const filtered = region ? trades.filter(t => t.regionName === region) : trades;
  renderLogTable(filtered, page);
};

window.refreshTradeLog = async function() {
  const item = window._currentItem;
  if (!item) return;
  const res = await fetch(
    `${API_BASE}/market/${item.itemOrCargo}/${item.id}/price-history?bucket=1+day&limit=7`,
    { headers: HEADERS }
  );
  const priceData = res.ok ? await res.json() : null;
  if (priceData) renderTradeLog(priceData);
};

window.clearAllFilters = function() {
  // Tier
  document.querySelectorAll('#tierDropdown input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('tierLabel').textContent = 'すべて';
  
  // レア度
  document.querySelectorAll('#rarityDropdown input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('rarityLabel').textContent = 'すべて';
  
  // カテゴリー
  document.querySelectorAll('#categoryDropdown input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('categoryLabel').textContent = 'すべて';
  
  // 注文種別 (削除済み)

  // 検索結果クリア
  searchInput.value = '';
  searchResults.classList.add('hidden');
  resultSection.classList.add('hidden');
  emptyState.classList.remove('hidden');
  currentItems = [];
  // カテゴリドロップダウンを全表示に戻す
  document.querySelectorAll('#categoryDropdown .ms-item').forEach(label => {
    label.style.display = '';
  });
  // 以下3行を追加
  document.querySelectorAll('#categoryDropdown .ms-section').forEach(section => {
    section.style.display = '';
  });
  document.querySelectorAll('#categoryDropdown .ms-parent').forEach(parent => {
    parent.classList.remove('open');
  });
  document.querySelectorAll('#categoryDropdown .ms-section-body').forEach(body => {
    body.classList.remove('open');
  });
  // 注文種別フィルターをリセット
  currentOrderType = '';
};

window.filterTradeLog = function() {
  const region = document.getElementById('logRegionFilter')?.value || '';
  const trades = window._tradeLogs || [];
  const filtered = region ? trades.filter(t => t.regionName === region) : trades;
  currentLogPage = 1;
  
  // テーブルボディだけ更新（セレクトは再生成しない）
  const maxItems = LOG_PER_PAGE * LOG_MAX_PAGES;
  const limited = filtered.slice(0, maxItems);
  const totalPages = Math.ceil(limited.length / LOG_PER_PAGE);
  const pageItems = limited.slice(0, LOG_PER_PAGE);
  
  const tbody = document.querySelector('#tradeLog tbody');
  if (tbody) tbody.innerHTML = renderLogRows(pageItems);
};



function renderMap(orders, orderType) {
  let filtered = orders;
  if (orderType === 'sell') filtered = orders.filter(o => o.orderType === 'sell');
  if (orderType === 'buy') filtered = orders.filter(o => o.orderType === 'buy');

  const withCoords = filtered.filter(o => o.claimLocationX != null && o.claimLocationZ != null);

  const mapContainer = document.getElementById('mapContainer');

  if (withCoords.length === 0) {
    mapContainer.innerHTML = '<div class="map-loading">座標データがありません</div>';
    return;
  }

  // SVGベースの簡易マップ（座標をキャンバスにマッピング）
  const xs = withCoords.map(o => Number(o.claimLocationX));
  const zs = withCoords.map(o => Number(o.claimLocationZ));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const padX = (maxX - minX) * 0.15 || 500;
  const padZ = (maxZ - minZ) * 0.15 || 500;

  const W = 520, H = 380;

  function mapX(x) {
    return 30 + ((x - minX + padX) / (maxX - minX + padX * 2)) * (W - 60);
  }
  function mapZ(z) {
    return 30 + ((z - minZ + padZ) / (maxZ - minZ + padZ * 2)) * (H - 60);
  }

  // グループ化（同じclaimをまとめる）
  const claimMap = {};
  withCoords.forEach((o, i) => {
    const key = o.claimName || `${o.locationX},${o.locationZ}`;
    if (!claimMap[key]) claimMap[key] = { orders: [], x: Number(o.claimLocationX), z: Number(o.claimLocationZ) };
    claimMap[key].orders.push({ ...o, globalIdx: i });
  });

  const markers = Object.values(claimMap);

  let svgMarkers = '';
  markers.forEach((m, i) => {
    const cx = mapX(m.x);
    const cy = mapZ(m.z);
    const hasSell = m.orders.some(o => o.orderType === 'sell');
    const hasBuy = m.orders.some(o => o.orderType === 'buy');
    const color = hasSell && hasBuy ? '#f0a500' : hasSell ? '#00c896' : '#5b9cf6';
    const lowestPrice = Math.min(...m.orders.map(o => Number(o.priceThreshold)));

    svgMarkers += `
      <g class="map-marker" onclick="showMarkerInfo(${i})" style="cursor:pointer">
        <circle cx="${cx}" cy="${cy}" r="12" fill="${color}" opacity="0.85" stroke="#fff" stroke-width="1.5"/>
        <circle cx="${cx}" cy="${cy}" r="12" fill="transparent" stroke="${color}" stroke-width="3" opacity="0.4" class="pulse-ring"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff">${m.orders.length}</text>
      </g>
    `;
  });

  // BitCraft Mapへのリンク（代表座標）
  const centerX = Math.round((minX + maxX) / 2);
  const centerZ = Math.round((minZ + maxZ) / 2);
  const mapLink = `https://map.bitjita.com/?x=${centerX}&y=${centerZ}&zoom=4`;

  mapContainer.innerHTML = `
    <div class="map-inner">
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="claims-svg">
        <rect width="${W}" height="${H}" rx="8" fill="#0d1520" opacity="0.8"/>
        <!-- グリッド -->
        ${Array.from({length: 6}, (_, i) => `
          <line x1="${30 + i * (W-60)/5}" y1="30" x2="${30 + i * (W-60)/5}" y2="${H-30}" stroke="#1e3048" stroke-width="0.5"/>
          <line x1="30" y1="${30 + i * (H-60)/5}" x2="${W-30}" y2="${30 + i * (H-60)/5}" stroke="#1e3048" stroke-width="0.5"/>
        `).join('')}
        ${svgMarkers}
      </svg>
      <div id="markerInfo" class="marker-info hidden"></div>
    </div>
    <div class="map-actions">
      <a href="${mapLink}" target="_blank" class="map-link-btn">🗺 BitCraft Mapで開く</a>
      <span class="map-hint">マーカーをクリックで詳細</span>
    </div>
  `;

  // マーカーinfoデータを保存
  window._mapMarkers = markers;

  document.getElementById('mapLegend').innerHTML = `
    <div class="legend-items">
      <span class="leg sell">● 売り注文</span>
      <span class="leg buy">● 買い注文</span>
      <span class="leg both">● 売り＆買い</span>
    </div>
  `;
}

// ============================================
// マーカー情報表示
// ============================================
window.showMarkerInfo = function(idx) {
  const marker = window._mapMarkers?.[idx];
  if (!marker) return;

  const info = document.getElementById('markerInfo');
  const mapLink = `https://map.bitjita.com/?x=${Math.round(marker.x)}&y=${Math.round(marker.z)}&zoom=6`;

  info.innerHTML = `
    <div class="mi-header">
      <strong>${marker.orders[0]?.claimName || '不明な領地'}</strong>
      <span class="mi-region">${marker.orders[0]?.regionName || ''}</span>
    </div>
    <div class="mi-coords">📍 X: ${Math.round(marker.x)}, Z: ${Math.round(marker.z)}</div>
    <div class="mi-orders">
      ${marker.orders.map(o => `
        <div class="mi-order ${o.orderType}">
          <span class="order-badge ${o.orderType}">${o.orderType === 'sell' ? '売り' : '買い'}</span>
          <span>${formatPrice(o.priceThreshold)}</span>
          <span>×${formatNum(o.quantity)}</span>
        </div>
      `).join('')}
    </div>
    <a href="${mapLink}" target="_blank" class="mi-maplink">🗺 マップで見る</a>
    <button onclick="document.getElementById('markerInfo').classList.add('hidden')" class="mi-close">✕</button>
  `;
  info.classList.remove('hidden');
};

window.highlightMarker = function(idx) {};

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
  const n = Math.round(order.claimLocationZ / 3);
  const e = Math.round(order.claimLocationX / 3);
  return `N:${n}, E:${e}`;
}

function showLoading() {
  loading.classList.remove('hidden');
  resultSection.classList.add('hidden');
  emptyState.classList.add('hidden');
}

function hideLoading() {
  loading.classList.add('hidden');
}

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
              <th>アイテム</th>
              <th>領地名</th>
              <th>リージョン</th>
              <th>単価</th>
              <th>個数</th>
              <th>小計</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${list.map((i, idx) => `
                <tr class="order-row">
                  <td style="color:#e0e0e0;font-size:12px;">${i.itemName}</td>
                  <td class="claim-name">
                    ${i.claimLocationX != null
                      ? `<a href="https://map.bitjita.com/?center=${Math.round(i.claimLocationZ/3)},${Math.round(i.claimLocationX/3)}&zoom=1.5" target="_blank" style="color:#00c896;text-decoration:none;">${i.claimName || '—'}</a>`
                      : (i.claimName || '—')}
                    ${i.claimLocationX != null ? `<div style="font-size:10px;color:#666;">N:${Math.round(i.claimLocationZ/3)}, E:${Math.round(i.claimLocationX/3)}</div>` : ''}
                  </td>
                  <td style="font-size:12px;">${i.regionName ? `${i.regionName} (R${i.regionId})` : '—'}</td>
                  <td class="price-cell">${formatPrice(i.priceThreshold)}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap;">
                      <button onclick="updateCalcListQty(${idx}, window._calcList[${idx}].buyQty - 10)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#aaa;width:32px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">-10</button>
                      <button onclick="updateCalcListQty(${idx}, window._calcList[${idx}].buyQty - 1)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:14px;">－</button>
                      <input type="number" min="1" max="${i.quantity}" value="${i.buyQty}"
                        style="width:50px;background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;border-radius:4px;padding:2px 4px;font-size:12px;text-align:center;"
                        onchange="updateCalcListQty(${idx}, this.value)">
                      <button onclick="updateCalcListQty(${idx}, window._calcList[${idx}].buyQty + 1)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#e0e0e0;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:14px;">＋</button>
                      <button onclick="updateCalcListQty(${idx}, window._calcList[${idx}].buyQty + 10)" style="background:#1a2535;border:1px solid rgba(255,255,255,0.15);color:#aaa;width:32px;height:24px;border-radius:4px;cursor:pointer;font-size:10px;">+10</button>
                      <span style="font-size:10px;color:#666;">/${formatNum(i.quantity)}</span>
                    </div>
                  </td>
                  <td class="price-cell calc-subtotal">${formatPrice(Number(i.priceThreshold) * i.buyQty)}</td>
                  <td><button onclick="removeCalcListItem(${idx})" style="background:none;border:none;color:#ff4d6d;cursor:pointer;font-size:16px;">✕</button></td>
                </tr>
              `).join('')}
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
      </div>
    `;
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
    // 個数入力欄だけ更新
    const inputs = document.querySelectorAll('#calcListModal input[type=number]');
    if (inputs[idx]) inputs[idx].value = item.buyQty;
    // 小計と合計だけ更新
    const subtotalCells = document.querySelectorAll('#calcListModal .calc-subtotal');
    if (subtotalCells[idx]) subtotalCells[idx].innerHTML = formatPrice(Number(item.priceThreshold) * item.buyQty);
    const total = window._calcList.reduce((sum, i) => sum + Number(i.priceThreshold) * i.buyQty, 0);
    const totalEl = document.getElementById('calcListTotal');
    if (totalEl) totalEl.innerHTML = formatPrice(total);
  };

  window.removeCalcListItem = function(idx) {
    window._calcList.splice(idx, 1);
    updateCalcListCount();
    modal.innerHTML = renderContent();
  };
};


window.addEventListener('popstate', e => {
  if (resultSection && !resultSection.classList.contains('hidden')) {
    resultSection.classList.add('hidden');
    searchResults.classList.remove('hidden');
    setTimeout(() => window.scrollTo(0, savedScrollPosition), 0);
  }
});
