import { appSnapshot, pairsSnapshot, appHistory } from '@/data/snapshots';
import type { AppRecord, AppHistoryEntry, PairsSnapshot } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowUpRight, ExternalLink, ArrowRight, History } from 'lucide-react';

// 根据交易所与交易对拼出对应现货行情(K线)页面链接
function buildPairUrl(exchangeKey: string, pair: string): string | null {
  const [base, quote] = pair.split('/');
  if (!base || !quote) return null;
  switch (exchangeKey) {
    case 'binance':
      return `https://www.binance.com/en/trade/${base}_${quote}`;
    case 'okx':
      return `https://www.okx.com/trade-spot/${base.toLowerCase()}-${quote.toLowerCase()}`;
    case 'bybit':
      return `https://www.bybit.com/en/trade/spot/${base}/${quote}`;
    case 'bitget':
      return `https://www.bitget.com/spot/${base}${quote}`;
    default:
      return null;
  }
}

const EXCHANGE_NAMES: Record<string, string> = {
  binance: 'Binance（币安）',
  okx: 'OKX',
  bybit: 'Bybit',
  bitget: 'Bitget',
};

function formatDate(iso: string | null): string {
  if (!iso) return '未知';
  return iso.slice(0, 10);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function VersionHistoryDialog({
  name,
  history,
}: {
  name: string;
  history: AppHistoryEntry[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900">
          <History className="h-3 w-3" />
          历史版本 ({history.length})
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{name} · 版本历史</DialogTitle>
        </DialogHeader>
        <ol className="relative space-y-5 border-l border-zinc-200 pl-5">
          {history.map((entry, i) => (
            <li key={entry.version} className="relative">
              <span
                className={`absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  i === 0 ? 'bg-amber-500' : 'bg-zinc-300'
                }`}
              />
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-semibold text-zinc-900 tabular-nums">
                  {entry.version}
                </span>
                {i === 0 && <span className="text-[10px] text-amber-600">最新</span>}
                <span className="ml-auto text-xs tabular-nums text-zinc-400">
                  {formatDate(entry.releaseDate)}
                </span>
              </div>
              {entry.releaseNotes && (
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-zinc-600">
                  {entry.releaseNotes}
                </p>
              )}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function AppCard({
  app,
  history,
}: {
  app: AppRecord;
  history: AppHistoryEntry[];
}) {
  if (app.error) {
    return (
      <Card className="border-red-200 bg-red-50/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-zinc-900">{app.name}</h3>
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">采集失败</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-red-700">{app.error}</CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={
        app.versionChanged
          ? 'border-amber-300 shadow-sm ring-1 ring-amber-100'
          : 'border-zinc-200'
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold leading-tight text-zinc-900">
              {app.name}
            </h3>
            {app.sellerName && (
              <p className="mt-0.5 text-xs text-zinc-400">{app.sellerName}</p>
            )}
          </div>
          {app.versionChanged ? (
            <Badge className="shrink-0 bg-amber-100 text-amber-800 hover:bg-amber-100">
              版本更新
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="shrink-0 bg-zinc-100 text-zinc-500 hover:bg-zinc-100"
            >
              无变化
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        <div className="flex items-baseline gap-2">
          {app.versionChanged && app.previousVersion && (
            <>
              <span className="font-mono text-sm text-zinc-400 line-through tabular-nums">
                {app.previousVersion}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-amber-500" />
            </>
          )}
          <span className="font-mono text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
            {app.version ?? '未知'}
          </span>
        </div>

        <div className="text-xs text-zinc-500">
          发布日期 · <span className="tabular-nums">{formatDate(app.releaseDate)}</span>
        </div>

        {app.releaseNotes && (
          <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              更新说明
            </div>
            <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-600">
              {app.releaseNotes}
            </p>
          </div>
        )}
      </CardContent>

      {(app.trackViewUrl || history.length > 0) && (
        <CardFooter className="flex items-center gap-4 pt-0">
          {app.trackViewUrl && (
            <a
              href={app.trackViewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900"
            >
              App Store 页面
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {history.length > 0 && (
            <VersionHistoryDialog name={app.name} history={history} />
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function PairsSection({ snapshot }: { snapshot: PairsSnapshot | null }) {
  if (!snapshot) {
    return (
      <Card className="border-dashed border-zinc-300 bg-transparent">
        <CardContent className="flex flex-col items-start gap-1 py-10 text-sm text-zinc-500">
          <p className="font-medium text-zinc-700">尚无交易对数据</p>
          <p className="text-zinc-500">
            运行{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
              npm run collect:pairs
            </code>{' '}
            采集交易对后，重新生成页面即可在此看到各交易所的现货交易对数量与新上线交易对。
          </p>
        </CardContent>
      </Card>
    );
  }

  const keys = Object.keys(snapshot.exchanges);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {keys.map((key) => {
        const ex = snapshot.exchanges[key];
        const newPairs = snapshot.comparison.newPairs[key] ?? [];
        const name = EXCHANGE_NAMES[key] ?? key;

        return (
          <Card key={key} className="border-zinc-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-zinc-900">{name}</h3>
                {ex.error ? (
                  <Badge
                    variant="secondary"
                    className="bg-zinc-100 text-zinc-500 hover:bg-zinc-100"
                  >
                    暂不可用
                  </Badge>
                ) : newPairs.length > 0 ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    +{newPairs.length} 新增
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-zinc-100 text-zinc-500 hover:bg-zinc-100"
                  >
                    无新增
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ex.error ? (
                <div className="space-y-1">
                  <p className="text-sm text-zinc-500">
                    该交易所限制服务器所在地区访问，暂无法采集。
                  </p>
                  <p className="font-mono text-[11px] text-zinc-400">{ex.error}</p>
                </div>
              ) : (
                <>
                  <div className="text-sm text-zinc-500">
                    当前交易对{' '}
                    <span className="font-mono text-base font-semibold text-zinc-900 tabular-nums">
                      {ex.count}
                    </span>
                  </div>
                  {newPairs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {newPairs.map((pair) => {
                        const url = buildPairUrl(key, pair);
                        const cls =
                          'rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-800';
                        return url ? (
                          <a
                            key={pair}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            title={`在 ${name} 查看 ${pair} 行情`}
                            className={`${cls} transition-colors hover:border-emerald-400 hover:bg-emerald-100`}
                          >
                            {pair}
                          </a>
                        ) : (
                          <span key={pair} className={cls}>
                            {pair}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'amber' | 'red';
}) {
  const color =
    accent === 'amber'
      ? 'text-amber-600'
      : accent === 'red'
        ? 'text-red-600'
        : 'text-zinc-900';
  return (
    <div className="bg-white px-5 py-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}

function App() {
  const apps = appSnapshot?.apps ?? [];
  const changedCount = apps.filter((a) => a.versionChanged).length;
  const failedCount = apps.filter((a) => a.error).length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* 顶部栏 */}
      <header className="border-b border-zinc-800 bg-zinc-950 text-zinc-100">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              Competitor Monitor
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">
              竞品动态监控
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              币安 · OKX · Bybit · Bitget — App 版本与现货交易对追踪
            </p>
          </div>
          {(appSnapshot || pairsSnapshot) && (
            <div className="text-xs text-zinc-400 sm:text-right">
              {appSnapshot && (
                <div>
                  App 版本采集 ·{' '}
                  <span className="tabular-nums text-zinc-200">
                    {formatDateTime(appSnapshot.collectedAt)}
                  </span>
                  <span className="text-zinc-500">（每周一）</span>
                </div>
              )}
              {pairsSnapshot && (
                <div className="mt-0.5">
                  交易对采集 ·{' '}
                  <span className="tabular-nums text-zinc-200">
                    {formatDateTime(pairsSnapshot.collectedAt)}
                  </span>
                  <span className="text-zinc-500">（每天）</span>
                </div>
              )}
              {appSnapshot && (
                <div className="mt-0.5">
                  App Store 区域 ·{' '}
                  <span className="uppercase text-zinc-200">{appSnapshot.storeCountry}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* 概览指标 */}
        <div className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200">
          <Metric label="监控 App" value={apps.length} />
          <Metric label="版本有更新" value={changedCount} accent="amber" />
          <Metric
            label="采集失败"
            value={failedCount}
            accent={failedCount > 0 ? 'red' : undefined}
          />
        </div>

        <Tabs defaultValue="apps">
          <TabsList className="mb-5">
            <TabsTrigger value="apps">App 版本</TabsTrigger>
            <TabsTrigger value="pairs">新上线交易对</TabsTrigger>
          </TabsList>

          <TabsContent value="apps">
            {apps.length === 0 ? (
              <p className="text-sm text-zinc-500">
                尚无数据，运行 <code className="font-mono">npm run collect</code>{' '}
                后重新生成页面。
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {apps.map((app) => (
                  <AppCard
                    key={app.key}
                    app={app}
                    history={appHistory[app.key] ?? []}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pairs">
            <PairsSection snapshot={pairsSnapshot} />
          </TabsContent>
        </Tabs>

        <Separator className="my-10" />
        <footer className="flex items-center gap-1.5 pb-8 text-xs text-zinc-400">
          <span>数据源自各交易所公开 API 与 Apple iTunes Lookup</span>
          <ArrowUpRight className="h-3 w-3" />
        </footer>
      </main>
    </div>
  );
}

export default App;
