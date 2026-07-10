// 把最新的采集快照“内嵌”进前端源码：读取快照目录，生成 src/data/snapshots.ts。
// 用法：
//   node scripts/embed-data.mjs                     # 默认读取 ../data/snapshots
//   node scripts/embed-data.mjs /abs/path/snapshots # 指定快照目录
// 数据内嵌后，需重新运行打包脚本页面才会更新。
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, '..');
const SNAPSHOTS_DIR = resolve(
  process.argv[2] || process.env.SNAPSHOTS_DIR || join(FRONTEND_ROOT, '..', 'data', 'snapshots')
);
const OUTPUT_PATH = join(FRONTEND_ROOT, 'src', 'data', 'snapshots.ts');
const PAIRS_PREFIX = 'pairs-';

function listJson(filter) {
  if (!existsSync(SNAPSHOTS_DIR)) return [];
  return readdirSync(SNAPSHOTS_DIR)
    .filter((name) => name.endsWith('.json') && filter(name))
    .sort();
}

function loadLatest(files) {
  if (files.length === 0) return null;
  const filename = files[files.length - 1];
  return { filename, data: JSON.parse(readFileSync(join(SNAPSHOTS_DIR, filename), 'utf8')) };
}

const appFiles = listJson((name) => !name.startsWith(PAIRS_PREFIX));
const pairsFiles = listJson((name) => name.startsWith(PAIRS_PREFIX));

const appSnapshot = loadLatest(appFiles);
const pairsSnapshot = loadLatest(pairsFiles);

// 版本历史存放在 data/app-history.json（快照目录的上一级）
const HISTORY_PATH = join(SNAPSHOTS_DIR, '..', 'app-history.json');
const appHistory = existsSync(HISTORY_PATH)
  ? JSON.parse(readFileSync(HISTORY_PATH, 'utf8'))
  : {};

const banner = `// 该文件由 scripts/embed-data.mjs 自动生成，请勿手动编辑。
// 快照来源目录: ${SNAPSHOTS_DIR}
// App 快照: ${appSnapshot?.filename ?? '无'}  |  交易对快照: ${pairsSnapshot?.filename ?? '无'}
import type { AppSnapshot, PairsSnapshot, AppHistory } from '@/types';
`;

const body = `
export const appSnapshot: AppSnapshot | null = ${JSON.stringify(appSnapshot?.data ?? null, null, 2)};

export const pairsSnapshot: PairsSnapshot | null = ${JSON.stringify(pairsSnapshot?.data ?? null, null, 2)};

export const appHistory: AppHistory = ${JSON.stringify(appHistory, null, 2)};
`;

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, banner + body, 'utf8');

console.log(`✅ 已生成 ${OUTPUT_PATH}`);
console.log(`   App 快照: ${appSnapshot?.filename ?? '无'}`);
console.log(`   交易对快照: ${pairsSnapshot?.filename ?? '无'}`);
