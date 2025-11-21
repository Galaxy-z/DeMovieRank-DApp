// app/page.tsx
'use client';

import React, { useState } from 'react';
import { SearchModal } from './components/SearchModal';

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-6 py-6 md:h-screen-dvh overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-sky-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-violet-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 mx-auto w-full max-w-4xl space-y-10 text-center">
        <div className="space-y-6 animate-fade-in-up">
          <div className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-300 backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-sky-400 mr-2 animate-pulse"></span>
            Web3 Movie Rating Protocol
          </div>
          
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl drop-shadow-lg">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-500 to-purple-600">
              DeMovieRank
            </span>
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-slate-300 leading-relaxed">
            去中心化的电影评分与流动性协议。
            <br />
            <span className="text-slate-400">
              铸造您的粉丝 SBT，参与公平评分，提供流动性赚取收益。
            </span>
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in-up delay-100">
          <button
            onClick={() => setSearchOpen(true)}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-sky-500 px-8 py-3 font-bold text-white transition-all duration-300 hover:bg-sky-400 hover:scale-105 hover:shadow-[0_0_20px_rgba(14,165,233,0.5)]"
          >
            <span className="mr-2">🔍</span> 探索电影
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
          </button>
          
          <a
            href="https://github.com/Galaxy-z/DeMovieRank"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 px-8 py-3 font-medium text-slate-300 backdrop-blur-sm transition-all hover:bg-slate-800 hover:text-white hover:border-slate-600"
          >
            GitHub 源码
          </a>
        </div>

        {/* Stats or Features Grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3 text-left animate-fade-in-up delay-200">
          <div className="glass-panel rounded-2xl p-6 hover:bg-slate-800/40 transition-colors">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              💎
            </div>
            <h3 className="text-lg font-semibold text-white">SBT 身份认证</h3>
            <p className="mt-2 text-sm text-slate-400">
              基于 Soulbound Token 的粉丝身份，确保评分真实有效，防止刷分。
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-6 hover:bg-slate-800/40 transition-colors">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
              ⚖️
            </div>
            <h3 className="text-lg font-semibold text-white">MovieSwap 协议</h3>
            <p className="mt-2 text-sm text-slate-400">
              引入 AMM 机制的评分博弈，通过流动性池发现电影的真实价值。
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-6 hover:bg-slate-800/40 transition-colors">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              🏆
            </div>
            <h3 className="text-lg font-semibold text-white">声望激励系统</h3>
            <p className="mt-2 text-sm text-slate-400">
              参与评分和治理积累声望，解锁“影评大师”等专属链上荣誉。
            </p>
          </div>
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
