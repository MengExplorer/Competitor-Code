// 采集快照的数据结构（与 scripts/collect.js、scripts/collect-pairs.js 的输出对应）

export interface AppRecord {
  key: string;
  name: string;
  trackId: number;
  bundleId: string;
  trackName: string | null;
  sellerName: string | null;
  version: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  trackViewUrl: string | null;
  versionChanged: boolean;
  previousVersion: string | null;
  error: string | null;
}

export interface AppSnapshot {
  collectedAt: string;
  storeCountry: string;
  apps: AppRecord[];
}

export interface ExchangeData {
  pairs: string[];
  count: number;
  error: string | null;
}

export interface PairsComparison {
  previousSnapshot: string | null;
  newPairs: Record<string, string[]>;
}

export interface PairsSnapshot {
  collectedAt: string;
  pairFormat: string;
  exchanges: Record<string, ExchangeData>;
  comparison: PairsComparison;
}
