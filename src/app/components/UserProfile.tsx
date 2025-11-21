'use client';

import { useMemo } from 'react';

interface FanProfile {
  fanAddress: string;
  reputation: bigint;
  jointAt: bigint;
  totalRatings: bigint;
}

interface Props {
  profile?: FanProfile;
  isLoading: boolean;
}

export function UserProfile({ profile, isLoading }: Props) {
  const data = useMemo(() => {
    if (!profile) return null;
    return {
      fanAddress: profile.fanAddress,
      reputation: Number(profile.reputation),
      jointAt: Number(profile.jointAt),
      totalRatings: Number(profile.totalRatings),
    };
  }, [profile]);

  const title = useMemo(() => {
    if (!data) return '';
    const rep = data.reputation;
    if (rep >= 200) return '影评大师';
    if (rep >= 50) return '资深影迷';
    return '影迷萌新';
  }, [data]);

  const titleColor = useMemo(() => {
    if (!data) return 'text-slate-400';
    const rep = data.reputation;
    if (rep >= 200) return 'text-amber-400';
    if (rep >= 50) return 'text-purple-400';
    return 'text-sky-400';
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-400">
        <div className="h-2 w-2 animate-pulse rounded-full bg-slate-500" />
        加载资料...
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="group relative flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10 backdrop-blur-sm cursor-default">
      <div className="flex flex-col items-end leading-none">
        <span className={`text-xs font-bold ${titleColor}`}>{title}</span>
        <span className="text-[10px] text-slate-400">声望: {data.reputation}</span>
      </div>
      <div className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-purple-500/20">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
          {data.totalRatings}
        </div>
      </div>
      
      {/* Tooltip */}
      <div className="absolute right-0 top-full mt-2 hidden w-56 flex-col gap-2 glass-panel rounded-xl p-4 shadow-2xl group-hover:flex z-50 animate-fade-in">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">加入时间</span>
          <span className="text-xs text-white font-mono">{new Date(data.jointAt * 1000).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">累计评分</span>
          <span className="text-xs text-white font-mono">{data.totalRatings} 次</span>
        </div>
        <div className="h-px bg-white/10 my-1" />
        <div className="text-xs text-slate-500 text-center">
            {data.reputation < 200 ? (
              <>距离下一等级还需 <span className="text-sky-400 font-bold">{data.reputation < 50 ? 50 - data.reputation : 200 - data.reputation}</span> 声望</>
            ) : (
              <span className="text-amber-400 font-bold">已达最高等级</span>
            )}
        </div>
      </div>
    </div>
  );
}
