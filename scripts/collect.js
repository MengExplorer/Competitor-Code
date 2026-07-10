import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './load-env.js';
import { rebuildAppHistory } from './build-app-history.js';

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APPS_CONFIG_PATH = join(ROOT, 'config', 'apps.json');
const SNAPSHOTS_DIR = join(ROOT, 'data', 'snapshots');
const STORE_COUNTRY = process.env.APP_STORE_COUNTRY || 'hk';

function todayFilename() {
  return new Date().toISOString().slice(0, 10) + '.json';
}

function loadAppsConfig() {
  return JSON.parse(readFileSync(APPS_CONFIG_PATH, 'utf8'));
}

function listSnapshotFiles() {
  if (!existsSync(SNAPSHOTS_DIR)) {
    return [];
  }

  return readdirSync(SNAPSHOTS_DIR)
    .filter((name) => name.endsWith('.json') && !name.startsWith('pairs-'))
    .sort();
}

function loadSnapshot(filename) {
  const content = readFileSync(join(SNAPSHOTS_DIR, filename), 'utf8');
  return JSON.parse(content);
}

function findPreviousSnapshot(currentFilename) {
  const files = listSnapshotFiles();

  // 同一天多次采集：与当天已有快照对比
  if (files.includes(currentFilename)) {
    return loadSnapshot(currentFilename);
  }

  if (files.length === 0) {
    return null;
  }

  return loadSnapshot(files[files.length - 1]);
}

async function fetchAppFromItunes(trackId) {
  const url = `https://itunes.apple.com/lookup?id=${trackId}&country=${STORE_COUNTRY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`iTunes API HTTP ${response.status} for trackId ${trackId}`);
  }

  const data = await response.json();
  if (!data.resultCount || !data.results?.length) {
    throw new Error(`iTunes API 未找到 trackId ${trackId}（country=${STORE_COUNTRY}）`);
  }

  return data.results[0];
}

function buildAppRecord(config, itunesResult, previousApp) {
  const previousVersion = previousApp?.version ?? null;
  const version = itunesResult.version ?? null;
  const versionChanged =
    previousVersion !== null && version !== null && previousVersion !== version;

  return {
    key: config.key,
    name: config.name,
    trackId: config.trackId,
    bundleId: itunesResult.bundleId ?? config.bundleId,
    trackName: itunesResult.trackName ?? null,
    sellerName: itunesResult.sellerName ?? null,
    version,
    releaseDate: itunesResult.currentVersionReleaseDate ?? itunesResult.releaseDate ?? null,
    releaseNotes: itunesResult.releaseNotes ?? null,
    trackViewUrl: itunesResult.trackViewUrl ?? null,
    versionChanged,
    previousVersion,
    error: null,
  };
}

// 单个 App 采集失败时，仍保留一条记录（标记 error），不中断其余 App 的采集
function buildFailedAppRecord(config, previousApp, errorMessage) {
  return {
    key: config.key,
    name: config.name,
    trackId: config.trackId,
    bundleId: config.bundleId,
    trackName: null,
    sellerName: null,
    version: null,
    releaseDate: null,
    releaseNotes: null,
    trackViewUrl: null,
    versionChanged: false,
    previousVersion: previousApp?.version ?? null,
    error: errorMessage,
  };
}

function printSummary(snapshot, snapshotPath, previousSnapshot) {
  console.log('');
  console.log('=== 竞品 App Store 版本采集 ===');
  console.log(`采集时间: ${snapshot.collectedAt}`);
  console.log(`App Store 区域: ${snapshot.storeCountry}`);
  console.log(`快照文件: ${snapshotPath}`);
  console.log(
    previousSnapshot
      ? `对比快照: ${previousSnapshot.collectedAt}`
      : '对比快照: 无（首次采集）'
  );
  console.log('');

  for (const app of snapshot.apps) {
    if (app.error) {
      console.log(`【采集失败】 ${app.name}`);
      console.log(`  原因: ${app.error}`);
      console.log('');
      continue;
    }

    const status = app.versionChanged ? '【版本更新】' : '【无变化】';
    console.log(`${status} ${app.name}`);
    console.log(`  版本: ${app.version ?? '未知'}`);
    if (app.versionChanged) {
      console.log(`  上一版本: ${app.previousVersion}`);
    }
    console.log(`  发布日期: ${app.releaseDate ?? '未知'}`);
    if (app.releaseNotes) {
      const preview = app.releaseNotes.replace(/\s+/g, ' ').slice(0, 120);
      console.log(`  更新说明: ${preview}${app.releaseNotes.length > 120 ? '...' : ''}`);
    }
    console.log('');
  }

  const changedCount = snapshot.apps.filter((app) => app.versionChanged).length;
  const failedCount = snapshot.apps.filter((app) => app.error).length;
  console.log(`共 ${snapshot.apps.length} 个 App，${changedCount} 个版本有变化。`);
  if (failedCount > 0) {
    console.log(`其中 ${failedCount} 个采集失败（详见上方）。`);
  }
}

async function main() {
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  const appsConfig = loadAppsConfig();
  const currentFilename = todayFilename();
  const previousSnapshot = findPreviousSnapshot(currentFilename);

  const previousByKey = new Map(
    (previousSnapshot?.apps ?? []).map((app) => [app.key, app])
  );

  const apps = [];
  const errors = [];
  for (const config of appsConfig) {
    try {
      const itunesResult = await fetchAppFromItunes(config.trackId);
      apps.push(buildAppRecord(config, itunesResult, previousByKey.get(config.key)));
    } catch (error) {
      errors.push(`${config.name}: ${error.message}`);
      apps.push(buildFailedAppRecord(config, previousByKey.get(config.key), error.message));
    }
  }

  const snapshot = {
    collectedAt: new Date().toISOString(),
    storeCountry: STORE_COUNTRY,
    apps,
  };

  const snapshotPath = join(SNAPSHOTS_DIR, currentFilename);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

  // 更新版本历史（每个 App 最多保留最近 10 次版本变更）
  rebuildAppHistory(SNAPSHOTS_DIR, join(ROOT, 'data', 'app-history.json'));

  printSummary(snapshot, snapshotPath, previousSnapshot);

  // 部分 App 采集失败：快照已保存，但用非零退出码提示调用方
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('采集失败:', error.message);
  process.exit(1);
});
