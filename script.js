// ============================================
// BitCraft Market Search - script.js
// ============================================

const API_BASE = 'https://bitcraft-proxy.29kiyo.workers.dev/api';

// ページ読み込み時にバックグラウンドでキャッシュを作っておく
window.addEventListener('DOMContentLoaded', () => {
  fetchAllMarketItems(); // 結果は使わないが裏で取得しておく
});

const HEADERS = { 'x-app-identifier': 'bitcraft-market-search-github-pages' };

// BitCraft Map用のベースURL（座標→マップリンク）
const MAP_BASE = 'https://map.bitcraft.gg';

// DOM要素
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const suggestions = document.getElementById('suggestions');
const tierFilter = document.getElementById('tierFilter');
const categoryFilter = document.getElementById('categoryFilter');
const orderTypeFilter = document.getElementById('orderTypeFilter');
const resultSection = document.getElementById('resultSection');
const emptyState = document.getElementById('emptyState');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');

// 状態
let currentItems = [];
let currentOrders = [];
let debounceTimer = null;

// 全件キャッシュ
let cachedMarketItems = null;

async function fetchAllMarketItems() {
  if (cachedMarketItems) return cachedMarketItems;
  const pageSize = 500;
  let offset = 0;
  let allItems = [];
  while (true) {
    const res = await fetch(
      `${API_BASE}/market?hasOrders=true&limit=${pageSize}&offset=${offset}`,
      { headers: HEADERS }
    );
    if (!res.ok) break;
    const json = await res.json();
    const items = json?.data?.items || [];
    allItems = allItems.concat(items);
    if (items.length < pageSize) break;
    offset += pageSize;
  }
  cachedMarketItems = allItems;
  return allItems;
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
tierFilter.addEventListener('change', applyFilters);
categoryFilter.addEventListener('change', applyFilters);
orderTypeFilter.addEventListener('change', applyFilters);

// ============================================
// 検索オートサジェスト
// ============================================
async function onSearchInput() {
  const q = searchInput.value.trim();
  if (q.length < 2) { hideSuggestions(); return; }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchSuggestions(q), 300);
}

async function fetchSuggestions(q) {
  try {
    const enQuery = translateQuery(q).toLowerCase();
    const allItems = await fetchAllMarketItems();
    const filtered = allItems
      .filter(item => item.name.toLowerCase().includes(enQuery))
      .slice(0, 8);
    if (filtered.length === 0) { hideSuggestions(); return; }
    showSuggestions(filtered);
  } catch { hideSuggestions(); }
}

function showSuggestions(items) {
  suggestions.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    const jaName = getJaName(item.name);
    div.innerHTML = `
      <span class="s-name">${item.name}</span>
      ${jaName ? `<span class="s-ja">${jaName}</span>` : ''}
      ${item.tier ? `<span class="s-tier">T${item.tier}</span>` : ''}
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
  if (!q) return;
  hideSuggestions();
  showLoading();
  clearError();

  try {
    const enQuery = translateQuery(q).toLowerCase();
    const tier = tierFilter.value;

    const allItems = await fetchAllMarketItems();

    let filtered = allItems.filter(item =>
      item.name.toLowerCase().includes(enQuery)
    );

    if (tier) {
      filtered = filtered.filter(item => String(item.tier) === String(tier));
    }

    currentItems = filtered.slice(0, 50);

    if (currentItems.length === 0) {
      showError('アイテムが見つかりませんでした。別のキーワードで試してください。');
      return;
    }

    await loadItemDetail(currentItems[0]);

  } catch (err) {
    showError(`エラーが発生しました: ${err.message}`);
    console.error(err);
  } finally {
    hideLoading();
  }
}
// ============================================
// アイテム詳細取得
// ============================================
async function loadItemDetail(item) {
  showLoading();
  try {
    const orderType = orderTypeFilter.value;
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
    };

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
  if (currentOrders.length > 0 || currentItems.length > 0) {
    doSearch();
  }
}

// ============================================
// 描画
// ============================================
function renderResult(item, priceData, orders, orderType) {
  // アイテムヘッダー
  renderItemHeader(item);
  // 価格サマリー
  renderPriceSummary(item, priceData);
  // 需要・供給
  renderSupplyDemand(orders);
  // 注文一覧 + マップ
  renderOrders(orders, orderType);
  renderMap(orders, orderType);

  resultSection.classList.remove('hidden');
  emptyState.classList.add('hidden');
}

function renderItemHeader(item) {
  const jaName = getJaName(item.name);
  document.getElementById('itemHeader').innerHTML = `
    <div class="item-title">
      <h2>${item.name}${jaName ? ` <span class="item-ja">/ ${jaName}</span>` : ''}</h2>
      <div class="item-badges">
        ${item.tier ? `<span class="badge tier">Tier ${item.tier}</span>` : ''}
        ${item.category ? `<span class="badge cat">${item.category}</span>` : ''}
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
  const volume24h = item.volume24h ?? 0;
  const change24h = stats.priceChange24h;

  const changeHtml = change24h != null
    ? `<span class="${change24h >= 0 ? 'pos' : 'neg'}">${change24h >= 0 ? '▲' : '▼'} ${Math.abs(change24h).toFixed(1)}%</span>`
    : '';

  document.getElementById('priceSummary').innerHTML = `
    <h3 class="section-title">💰 価格情報</h3>
    <div class="price-cards">
      <div class="price-card sell">
        <div class="pc-label">最低売値</div>
        <div class="pc-value">${formatPrice(lowestSell)}</div>
        <div class="pc-sub">Lowest Sell</div>
      </div>
      <div class="price-card buy">
        <div class="pc-label">最高買値</div>
        <div class="pc-value">${formatPrice(highestBuy)}</div>
        <div class="pc-sub">Highest Buy</div>
      </div>
      <div class="price-card avg">
        <div class="pc-label">24h平均</div>
        <div class="pc-value">${formatPrice(avg24h)} ${changeHtml}</div>
        <div class="pc-sub">24h Average</div>
      </div>
      <div class="price-card avg7">
        <div class="pc-label">7日平均</div>
        <div class="pc-value">${formatPrice(avg7d)}</div>
        <div class="pc-sub">7-day Average</div>
      </div>
      <div class="price-card vol">
        <div class="pc-label">24h取引量</div>
        <div class="pc-value">${formatNum(volume24h)}</div>
        <div class="pc-sub">24h Volume</div>
      </div>
    </div>
  `;
}

function renderSupplyDemand(orders) {
  const sellOrders = orders.filter(o => o.orderType === 'sell');
  const buyOrders = orders.filter(o => o.orderType === 'buy');
  const totalSupply = sellOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  const totalDemand = buyOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  const total = totalSupply + totalDemand;
  const supplyPct = total > 0 ? Math.round((totalSupply / total) * 100) : 50;
  const demandPct = 100 - supplyPct;

  document.getElementById('supplyDemand').innerHTML = `
    <h3 class="section-title">📊 需要と供給</h3>
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
}

function renderOrders(orders, orderType) {
  let filtered = orders;
  if (orderType === 'sell') filtered = orders.filter(o => o.orderType === 'sell');
  if (orderType === 'buy') filtered = orders.filter(o => o.orderType === 'buy');
  filtered.sort((a, b) => Number(a.priceThreshold) - Number(b.priceThreshold));

  const html = filtered.length === 0
    ? '<p class="no-orders">注文が見つかりませんでした</p>'
    : `<table class="orders-table">
        <thead><tr>
          <th>種別</th>
          <th>価格</th>
          <th>数量</th>
          <th>領地名</th>
          <th>リージョン</th>
          <th>座標</th>
        </tr></thead>
        <tbody>
          ${filtered.map((o, i) => `
            <tr class="order-row ${o.orderType}" data-idx="${i}" onclick="highlightMarker(${i})">
              <td><span class="order-badge ${o.orderType}">${o.orderType === 'sell' ? '売り' : '買い'}</span></td>
              <td class="price-cell">${formatPrice(o.priceThreshold)}</td>
              <td>${formatNum(o.quantity)}</td>
              <td class="claim-name">${o.claimName || '—'}</td>
              <td>${o.regionName || '—'}</td>
              <td class="coords">${formatCoords(o)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  document.getElementById('ordersList').innerHTML = `
    <h3 class="section-title">📋 注文一覧 <span class="order-count">${filtered.length}件</span></h3>
    ${html}
  `;
}

function renderMap(orders, orderType) {
  let filtered = orders;
  if (orderType === 'sell') filtered = orders.filter(o => o.orderType === 'sell');
  if (orderType === 'buy') filtered = orders.filter(o => o.orderType === 'buy');

  const withCoords = filtered.filter(o => o.locationX != null && o.locationZ != null);

  const mapContainer = document.getElementById('mapContainer');

  if (withCoords.length === 0) {
    mapContainer.innerHTML = '<div class="map-loading">座標データがありません</div>';
    return;
  }

  // SVGベースの簡易マップ（座標をキャンバスにマッピング）
  const xs = withCoords.map(o => Number(o.locationX));
  const zs = withCoords.map(o => Number(o.locationZ));
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
    if (!claimMap[key]) claimMap[key] = { orders: [], x: Number(o.locationX), z: Number(o.locationZ) };
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
  const mapLink = `https://map.bitcraft.gg/?x=${centerX}&z=${centerZ}&zoom=4`;

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
  const mapLink = `https://map.bitcraft.gg/?x=${Math.round(marker.x)}&z=${Math.round(marker.z)}&zoom=6`;

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
  return n.toLocaleString('ja-JP') + ' <span class="coin">🪙</span>';
}

function formatNum(val) {
  if (val == null) return '0';
  return Number(val).toLocaleString('ja-JP');
}

function formatCoords(order) {
  if (order.locationX == null) return '—';
  return `X:${Math.round(order.locationX)}, Z:${Math.round(order.locationZ)}`;
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
