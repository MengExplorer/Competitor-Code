# 竞品动态监控

# 交易所竞品动态监控 (Competitor Monitor)

一个轻量的本地工具,用于监控主流加密货币交易所的产品动态,辅助竞品分析。

## 背景 / 动机

作为产品经理,需要持续跟踪竞品(币安、OKX、Bybit、Bitget)的迭代节奏。

本项目自动采集并对比这些交易所的更新情况,把分散的信息聚合到一个页面,

减少手动巡检的成本。

## 功能

- **App 版本监控**:通过苹果 iTunes Lookup 接口,采集四家交易所 iOS App 的

  版本号、更新日期、更新说明,并标记发生版本变化的 App。

- **新上线交易对监控**: 通过各交易所公开 API 采集现货交易对列表,

  与上一份快照对比,识别新增交易对。

- 数据以带日期的 JSON 快照形式存储(随仓库一起提交),便于历史对比与展示。

## 监控范围

币安 (Binance) · OKX · Bybit · Bitget

## 技术栈

- Node.js(数据采集)

- 原生 HTML / JS(前端展示)

- 数据存储:本地 JSON 快照

## 使用方法

1. 安装依赖`npm install`

2. 复制 `.env.example` 为 `.env` 并填入所需配置

3. 运行采集脚本

   - App 版本: `npm run collect`
   - 交易对: `npm run collect:pairs`

4. 采集结果保存在 `data/snapshots/` 目录下

## 项目结构

- `scripts/` — 数据采集脚本

- `config/` — 监控目标配置

- `data/snapshots/` — 历史数据快照

- `docs/` — 前端展示页面(打包后的单文件 `index.html`,同时作为 GitHub Pages 发布目录)

- `frontend/` — 前端源码(React + TypeScript + Tailwind + shadcn/ui)

## 环境要求

- Node.js 18 或更高版本（使用内置 `fetch`，无第三方依赖）

## 快速开始

```bash
# 1. 可选：复制环境变量模板（当前无需 API Key）
cp .env.example .env

# 2. 运行采集
npm run collect
npm run collect:pairs
```

## 配置


| 变量                  | 说明             | 默认值  |
| ------------------- | -------------- | ---- |
| `APP_STORE_COUNTRY` | App Store 区域代码 | `hk` |


> 说明：中国区 App Store（`cn`）未上架这些交易所 App，因此默认使用香港区（`hk`）。

## 输出

### App 版本 (`npm run collect`)

- 每次采集会在 `data/snapshots/YYYY-MM-DD.json` 保存快照
- 终端会显示各 App 当前版本、发布日期、更新说明
- 若存在上一份快照,会自动对比并标记 `versionChanged: true` 的 App
- 容错:单个 App 采集失败时,该 App 会标记 `error` 且其余 App 正常保存,进程以非零退出码结束

### 交易对 (`npm run collect:pairs`)

- 每次采集会在 `data/snapshots/pairs-YYYY-MM-DD.json` 保存快照
- 交易对统一格式为 `BASE/QUOTE`(如 `BTC/USDT`)
- 终端会显示各交易所当前交易对数量及新增交易对
- 若存在上一份快照,会自动对比 `comparison.newPairs`
- 容错:单家交易所采集失败时,该交易所会标记 `error`、其余正常保存,该家本次跳过对比,进程以非零退出码结束

## 验证步骤

### App 版本

1. 运行 `npm run collect`,终端应输出 4 个 App 的版本信息
2. 检查 `data/snapshots/` 下是否生成当天日期的 JSON 文件
3. 再次运行 `npm run collect`,版本未变时应显示「无变化」
4. (可选)手动修改上一份快照中某个 App 的 `version` 字段后再运行,应显示「版本更新」

### 交易对

1. 运行 `npm run collect:pairs`,终端应输出 4 家交易所的交易对数量
2. 检查 `data/snapshots/` 下是否生成 `pairs-YYYY-MM-DD.json`
3. 再次运行,首次之后若无新上线交易对应显示「新增交易对: 无」
4. (可选)手动修改上一份快照,删除某个交易对后再运行,该交易对应出现在新增列表

## 前端展示页面

采集到的数据通过一个网页集中展示,分「App 版本」和「新上线交易对」两个标签页。

- **直接查看**:双击打开 `docs/index.html` 即可(数据已内嵌在页面中,无需联网)。
- **在线展示**:仓库 Settings → Pages 选择 `main` 分支的 `/docs` 目录发布,即可获得公开网址。
- **源码与重新构建**:前端源码在 `frontend/` 目录,采集到新数据后如需更新页面,
  参见 [`frontend/README.md`](frontend/README.md)。技术栈为 React + TypeScript + Tailwind + shadcn/ui,
  最终打包为单个自包含 HTML。

## 自动化采集（GitHub Actions）

仓库配置了云端定时任务（`.github/workflows/collect.yml`），无需本地开机：

- **每天** 09:00（北京时间）采集交易对；
- **每周一** 09:00 额外采集 App 版本；
- 采集后自动重新生成展示页面并提交回仓库，GitHub Pages 随之更新。

也可在仓库 **Actions** 页面点 **Run workflow** 手动触发一次（会同时采集 App 与交易对）。

> 说明：GitHub 定时任务用 UTC，09:00 北京时间 = 01:00 UTC；高峰期定时触发可能延迟几分钟到半小时属正常现象。

## App Store ID 确认方式

详见 `config/apps.json` 中每个 App 的 `idConfirmation` 字段。


| App         | trackId    | bundleId                   |
| ----------- | ---------- | -------------------------- |
| Binance（币安） | 1436799971 | com.czzhao.binance         |
| OKX         | 1327268470 | com.okex.OKExAppstoreFull  |
| Bybit       | 1488296980 | com.bybit.app              |
| Bitget      | 1442778704 | com.bitget.exchange.global |


手动验证示例：

```bash
curl "https://itunes.apple.com/lookup?id=1436799971&country=hk"
```

## 交易所 API 确认方式

详见 `config/exchanges.json` 中每个交易所的 `idConfirmation` 字段。

| 交易所 | 端点 | 交易对字段 | 状态过滤 |
| ------ | ---- | ---------- | -------- |
| Binance | `GET data-api.binance.vision/api/v3/exchangeInfo` | `baseAsset` + `quoteAsset` | `status=TRADING`, `isSpotTradingAllowed` |
| OKX | `GET /api/v5/public/instruments?instType=SPOT` | `baseCcy` + `quoteCcy` | `state=live` |
| Bybit | `GET api.bytick.com/v5/market/instruments-info?category=spot` | `baseCoin` + `quoteCoin` | `status=Trading` |
| Bitget | `GET /api/v2/spot/public/symbols` | `baseCoin` + `quoteCoin` | `status=online` |

> 关于地区封锁：`api.binance.com` 会封锁美国 IP(HTTP 451)、`api.bybit.com` 会拦截数据中心 IP(HTTP 403),
> 而 GitHub Actions 的服务器在美国。因此改用不受地区封锁的镜像域名 `data-api.binance.vision`(币安只读行情)
> 与备用域名 `api.bytick.com`(Bybit),并为请求带上 User-Agent。

手动验证示例:

```bash
curl -s "https://api.binance.com/api/v3/exchangeInfo?symbol=BTCUSDT" | head -c 300
curl -s "https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=BTC-USDT"
curl -s "https://api.bybit.com/v5/market/instruments-info?category=spot&symbol=BTCUSDT"
curl -s "https://api.bitget.com/api/v2/spot/public/symbols?symbol=BTCUSDT"
```

