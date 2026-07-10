// 从历史 App 快照提炼「版本变更时间线」，每个 App 最多保留最近 10 次版本变更。
// - 作为模块：collect.js 每次采集后调用 rebuildAppHistory() 更新 data/app-history.json
// - 作为脚本：node scripts/build-app-history.js 可从现有快照重建该文件（用于初始化/修复）
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_ENTRIES = 10;

// 按时间顺序扫描所有 App 快照，去掉连续重复的版本，得到每个 App 的版本时间线。
export function rebuildAppHistory(snapshotsDir, outPath) {
  const files = existsSync(snapshotsDir)
    ? readdirSync(snapshotsDir)
        .filter((name) => name.endsWith('.json') && !name.startsWith('pairs-'))
        .sort()
    : [];

  const byKey = {};
  for (const file of files) {
    let snapshot;
    try {
      snapshot = JSON.parse(readFileSync(join(snapshotsDir, file), 'utf8'));
    } catch {
      continue;
    }

    for (const app of snapshot.apps ?? []) {
      if (app.error || !app.version) {
        continue;
      }
      const list = (byKey[app.key] ??= []);
      const last = list[list.length - 1];
      // 只在版本发生变化时记一条（同一版本跨多次快照不重复记录）
      if (!last || last.version !== app.version) {
        list.push({
          key: app.key,
          name: app.name,
          version: app.version,
          releaseDate: app.releaseDate ?? null,
          releaseNotes: app.releaseNotes ?? null,
          recordedAt: snapshot.collectedAt ?? null,
        });
      }
    }
  }

  // 最新在前，最多 10 条
  const result = {};
  for (const [key, list] of Object.entries(byKey)) {
    result[key] = list.slice(-MAX_ENTRIES).reverse();
  }

  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

// 作为脚本直接运行时，从仓库默认路径重建
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const ROOT = resolve(dirname(__filename), '..');
  rebuildAppHistory(
    join(ROOT, 'data', 'snapshots'),
    join(ROOT, 'data', 'app-history.json')
  );
  console.log('✅ 已生成 data/app-history.json');
}
