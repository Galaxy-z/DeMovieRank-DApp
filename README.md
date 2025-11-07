# DeMovieRank DApp

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## TMDB 关键词搜索集成

首页已添加一个“关键词搜索”输入框，会调用内部 API 路由 `/api/search/keyword`，后端再代理至 TMDB：

1. 复制 `.env.example` 为 `.env`，填入：

```bash
TMDB_TOKEN="你的 v4 Read Access Token"
# 或使用 v3：
# TMDB_API_KEY="你的 v3 API Key"
```

1. 启动开发：

```bash
npm run dev
```

1. 访问首页输入关键字（≥1 个非空字符）即会出现下拉提示。选中后目前仅 `console.log`，你可在 `app/page.tsx` 的 `onSelect` 回调中继续接入合约交互或跳转。

### 设计说明

- 不直接在前端暴露 Token，使用 Next.js App Router API Route 服务端代理。
- 支持 v4 Bearer 或 v3 `api_key` 方式；同时存在时优先 Bearer。
- 结果做 30s 进程级内存缓存，减少高速输入造成的 TMDB 请求风暴。
- 简单键盘交互：↑ / ↓ 选择，Enter 确认，Esc 关闭。

### 后续可拓展点

- 将选择的关键词写入合约（结合 wagmi / ethers）。
- 增加最近搜索 / 热门关键词本地存储。
- 添加防抖时间与缓存策略的可配置化。
- 使用 React Query/SWR 统一数据层。

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
