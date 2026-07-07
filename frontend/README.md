# 前端展示页面

竞品动态监控的展示页面。技术栈：React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui，
最终打包成**单个自包含的 HTML 文件**，输出到仓库根目录的 `docs/index.html`（GitHub Pages 的发布目录，也可直接双击打开）。

## 数据来源

页面数据在**构建时内嵌**：`scripts/embed-data.mjs` 读取仓库 `data/snapshots/` 下最新的
App 快照与交易对快照，生成 `src/data/snapshots.ts`。因此每次采集到新数据后，需重新构建页面才会更新。

## 本地开发

```bash
cd frontend
pnpm install        # 或 npm install
pnpm run embed      # 生成内嵌数据（读取 ../data/snapshots）
pnpm dev            # 本地开发预览
```

## 生成最终页面（更新 public/index.html）

```bash
cd frontend
pnpm install
npm run artifact                 # = embed + 打包 + 自动更新 ../docs/index.html
```

> ⚠️ 注意：构建工具（Parcel/Vite）**无法在路径包含冒号 `:` 的目录下工作**。
> 若你的本地文件夹名是 `Competitor:Code`，请在一个不含冒号的路径（例如从 GitHub 全新克隆得到的
> `Competitor-Code`）中执行上述构建命令。

## 目录说明

- `src/App.tsx` — 页面主体（顶部栏、概览指标、App 版本卡片、交易对卡片）
- `src/types.ts` — 与采集脚本输出对应的数据类型
- `src/data/snapshots.ts` — 自动生成的内嵌数据（勿手改）
- `scripts/embed-data.mjs` — 从快照目录生成内嵌数据
- `src/components/ui/` — shadcn/ui 组件
