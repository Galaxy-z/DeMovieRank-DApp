// app/page.tsx
'use client';

import React from 'react';

// 说明：外层 layout 已提供 <main className="flex-1 flex flex-col min-h-screen">。
// 这里不再重复使用 <main> + min-h-screen，避免双层 main 造成高度 > 视窗。
// 使用自定义的 h-screen-dvh（由 ViewportHeightSetter 提供的 --vh）或回退 flex 布局高度。
export default function Home() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 py-6 md:h-screen-dvh">
      <div className="mx-auto w-full max-w-4xl space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            DeMovieRank DApp
          </h1>
        </div>
        <p className="text-sm text-gray-600">使用顶部导航栏的“搜索电影”即可打开模态框进行搜索。</p>
      </div>
    </div>
  );
}
