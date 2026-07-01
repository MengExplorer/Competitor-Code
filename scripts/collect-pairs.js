import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './load-env.js';

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EXCHANGES_CONFIG_PATH = join(ROOT, 'config', 'exchanges.json');
const SNAPSHOTS_DIR = join(ROOT, 'data', 'snapshots');
const SNAPSHOT_PREFIX = 'pairs-';

function todayFilename() {
  return SNAPSHOT_PREFIX + new Date().toISOString().slice(0, 10) + '.json';
}

function loadExchangesConfig() {
  return JSON.parse(readFileSync(EXCHANGES_CONFIG_PATH, 'utf8'));
}

function listPairsSnapshotFiles() {
  if (!existsSync(SNAPSHOTS_DIR)) {
    return [];
  }

  return readdirSync(SNAPSHOTS_DIR)
    .filter((name) => name.startsWith(SNAPSHOT_PREFIX) && name.endsWith('.json'))
    .sort();
}

function loadSnapshot(filename) {
  const content = readFileSync(join(SNAPSHOTS_DIR, filename), 'utf8');
  return JSON.parse(content);
}

function findPreviousSnapshot(currentFilename) {
  const files = listPairsSnapshotFiles();

  if (files.includes(currentFilename)) {
    return {
      filename: currentFilename,
      snapshot: loadSnapshot(currentFilename),
    };
  }

  if (files.length === 0) {
    return { filename: null, snapshot: null };
  }

  const filename = files[files.length - 1];
  return {
    filename,
    snapshot: loadSnapshot(filename),
  };
}

function normalizePair(base, quote) {
  return `${base}/${quote}`;
}

function sortPairs(pairs) {
  return [...pairs].sort((a, b) => a.localeCompare(b));
}

function computeNewPairs(currentPairs, previousPairs) {
  const previousSet = new Set(previousPairs ?? []);
  return sortPairs(currentPairs.filter((pair) => !previousSet.has(pair)));
}

async function fetchJson(url, exchangeName) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    const detail = error.cause?.code ?? error.message;
    throw new Error(`${exchangeName} API 请求失败 (${detail}): ${url}`);
  }

  if (!response.ok) {
    throw new Error(`${exchangeName} API HTTP ${response.status}: ${url}`);
  }

  return response.json();
}

async function fetchBinancePairs() {
  const data = await fetchJson(
    'https://api.binance.com/api/v3/exchangeInfo',
    'Binance'
  );

  if (!Array.isArray(data.symbols)) {
    throw new Error('Binance API 响应缺少 symbols 数组');
  }

  const pairs = data.symbols
    .filter(
      (item) =>
        item.status === 'TRADING' &&
        item.isSpotTradingAllowed !== false &&
        item.baseAsset &&
        item.quoteAsset
    )
    .map((item) => normalizePair(item.baseAsset, item.quoteAsset));

  return sortPairs(pairs);
}

async function fetchOkxPairs() {
  const data = await fetchJson(
    'https://www.okx.com/api/v5/public/instruments?instType=SPOT',
    'OKX'
  );

  if (data.code !== '0') {
    throw new Error(`OKX API 错误: code=${data.code}, msg=${data.msg ?? 'unknown'}`);
  }

  if (!Array.isArray(data.data)) {
    throw new Error('OKX API 响应缺少 data 数组');
  }

  const pairs = data.data
    .filter((item) => item.state === 'live' && item.baseCcy && item.quoteCcy)
    .map((item) => normalizePair(item.baseCcy, item.quoteCcy));

  return sortPairs(pairs);
}

async function fetchBybitPairs() {
  const data = await fetchJson(
    'https://api.bybit.com/v5/market/instruments-info?category=spot',
    'Bybit'
  );

  if (data.retCode !== 0) {
    throw new Error(
      `Bybit API 错误: retCode=${data.retCode}, retMsg=${data.retMsg ?? 'unknown'}`
    );
  }

  const list = data.result?.list;
  if (!Array.isArray(list)) {
    throw new Error('Bybit API 响应缺少 result.list 数组');
  }

  const pairs = list
    .filter(
      (item) =>
        item.status === 'Trading' && item.baseCoin && item.quoteCoin
    )
    .map((item) => normalizePair(item.baseCoin, item.quoteCoin));

  return sortPairs(pairs);
}

async function fetchBitgetPairs() {
  const data = await fetchJson(
    'https://api.bitget.com/api/v2/spot/public/symbols',
    'Bitget'
  );

  if (data.code !== '00000') {
    throw new Error(`Bitget API 错误: code=${data.code}, msg=${data.msg ?? 'unknown'}`);
  }

  if (!Array.isArray(data.data)) {
    throw new Error('Bitget API 响应缺少 data 数组');
  }

  const pairs = data.data
    .filter(
      (item) => item.status === 'online' && item.baseCoin && item.quoteCoin
    )
    .map((item) => normalizePair(item.baseCoin, item.quoteCoin));

  return sortPairs(pairs);
}

const FETCHERS = {
  binance: fetchBinancePairs,
  okx: fetchOkxPairs,
  bybit: fetchBybitPairs,
  bitget: fetchBitgetPairs,
};

function buildComparison(exchanges, previous) {
  const newPairs = {};
  for (const [key, exchange] of Object.entries(exchanges)) {
    const previousExchange = previous?.snapshot?.exchanges?.[key];

    // 本次该交易所采集失败，或上一份快照里这家也失败：数据不可靠，跳过对比
    if (exchange.error || previousExchange?.error) {
      newPairs[key] = [];
      continue;
    }

    const previousPairs = previousExchange?.pairs ?? null;
    newPairs[key] = computeNewPairs(exchange.pairs, previousPairs);
  }

  return {
    previousSnapshot: previous?.filename ?? null,
    newPairs,
  };
}

function printSummary(snapshot, snapshotPath) {
  console.log('');
  console.log('=== 交易所新上线交易对采集 ===');
  console.log(`采集时间: ${snapshot.collectedAt}`);
  console.log(`快照文件: ${snapshotPath}`);
  console.log(
    snapshot.comparison.previousSnapshot
      ? `对比快照: ${snapshot.comparison.previousSnapshot}`
      : '对比快照: 无（首次采集）'
  );
  console.log('');

  for (const config of loadExchangesConfig()) {
    const exchange = snapshot.exchanges[config.key];
    const newPairs = snapshot.comparison.newPairs[config.key] ?? [];

    console.log(`${config.name}`);

    if (exchange.error) {
      console.log(`  采集失败: ${exchange.error}`);
      console.log('');
      continue;
    }

    console.log(`  当前交易对数量: ${exchange.count}`);

    if (newPairs.length === 0) {
      console.log('  新增交易对: 无');
    } else {
      console.log(`  新增交易对 (${newPairs.length}):`);
      for (const pair of newPairs) {
        console.log(`    + ${pair}`);
      }
    }
    console.log('');
  }

  const totalNew = Object.values(snapshot.comparison.newPairs).reduce(
    (sum, pairs) => sum + pairs.length,
    0
  );
  const failedCount = Object.values(snapshot.exchanges).filter((ex) => ex.error).length;
  console.log(`共发现 ${totalNew} 个新增交易对。`);
  if (failedCount > 0) {
    console.log(`其中 ${failedCount} 家交易所采集失败（详见上方）。`);
  }
}

async function main() {
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  const exchangesConfig = loadExchangesConfig();
  const currentFilename = todayFilename();
  const previous = findPreviousSnapshot(currentFilename);

  const exchanges = {};
  const errors = [];
  for (const config of exchangesConfig) {
    const fetchPairs = FETCHERS[config.key];
    if (!fetchPairs) {
      errors.push(`${config.name}: 未找到采集函数`);
      exchanges[config.key] = { pairs: [], count: 0, error: '未找到采集函数' };
      continue;
    }

    try {
      const pairs = await fetchPairs();
      exchanges[config.key] = { pairs, count: pairs.length, error: null };
    } catch (error) {
      // 单家交易所失败不应中断其余采集：标记 error，继续下一家
      errors.push(`${config.name}: ${error.message}`);
      exchanges[config.key] = { pairs: [], count: 0, error: error.message };
    }
  }

  const comparison = buildComparison(exchanges, previous);

  const snapshot = {
    collectedAt: new Date().toISOString(),
    pairFormat: 'BASE/QUOTE',
    exchanges,
    comparison,
  };

  const snapshotPath = join(SNAPSHOTS_DIR, currentFilename);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

  printSummary(snapshot, snapshotPath);

  // 部分交易所采集失败：快照已保存，但用非零退出码提示调用方
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('采集失败:', error.message);
  process.exit(1);
});
