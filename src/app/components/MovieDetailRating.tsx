'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';

import { config } from '../providers';
import { MOVIE_RATING_ABI, MOVIE_RATING_ADDRESS } from '../contracts/movieRating';
import { MOVIE_FAN_S_B_T_CONTRACT } from '../contracts/movieFanSBT';

interface Props {
  movieId: string;
  className?: string;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';
type SubmitState = 'idle' | 'loading' | 'success' | 'error';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function MovieDetailRating({ movieId, className }: Props) {
  const { address, isConnected } = useAccount();
  const fanCheckAddress = address ?? ZERO_ADDRESS;
  const {
    data: isFanRaw,
    isFetching: isFanLoading,
  } = useReadContract({
    ...MOVIE_FAN_S_B_T_CONTRACT,
    functionName: 'isMovieFan',
    args: [fanCheckAddress],
    query: {
      enabled: isConnected && !!address,
    },
  });
  const hasFanSBT = isFanRaw === true;

  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [rating, setRating] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [userRating, setUserRating] = useState<number>(10);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = movieId?.trim();
    if (!trimmed) {
      setFetchState('error');
      setRating(null);
      return;
    }

    let cancelled = false;
    setFetchState('loading');
    setRating(null);

    const fetchRating = async () => {
      try {
        const value = (await readContract(config, {
          address: MOVIE_RATING_ADDRESS,
          abi: MOVIE_RATING_ABI,
          functionName: 'getAverageRating',
          args: [trimmed],
        })) as bigint;
        if (cancelled) return;
        setRating(Number(value) / 100);
        setFetchState('success');
      } catch (err) {
        console.error('[movie detail] rating fetch failed', err);
        if (cancelled) return;
        setRating(null);
        setFetchState('error');
      }
    };

    fetchRating();

    return () => {
      cancelled = true;
    };
  }, [movieId, refreshTick]);

  const averageLabel = useMemo(() => {
    if (fetchState === 'loading') return '链上评分获取中...';
    if (fetchState === 'error') return '暂时无法获取链上评分';
    if (!rating) return '暂无链上评分';
    return `${rating} / 10`;
  }, [fetchState, rating]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isConnected) {
      setSubmitState('error');
      setSubmitMessage('请先连接钱包再进行评分。');
      return;
    }

    if (!hasFanSBT) {
      setSubmitState('error');
      setSubmitMessage('评分前请先领取电影粉丝 SBT。');
      return;
    }

    if (userRating < 1 || userRating > 10) {
      setSubmitState('error');
      setSubmitMessage('评分范围需在 1 到 10 之间。');
      return;
    }

    const trimmed = movieId?.trim();
    if (!trimmed) {
      setSubmitState('error');
      setSubmitMessage('无效的电影 ID。');
      return;
    }

    try {
      setSubmitState('loading');
      setSubmitMessage(null);

      const hash = await writeContract(config, {
        address: MOVIE_RATING_ADDRESS,
        abi: MOVIE_RATING_ABI,
        functionName: 'rateMovie',
        args: [trimmed, userRating],
      });

      await waitForTransactionReceipt(config, { hash });

      setSubmitState('success');
      setSubmitMessage('评分成功，感谢您的反馈！');
      setRefreshTick(tick => tick + 1);
    } catch (err: any) {
      console.error('[movie detail] rate tx failed', err);
      const message = err?.shortMessage || err?.message || '评分失败，请稍后重试。';
      setSubmitState('error');
      setSubmitMessage(message);
    }
  };

  return (
    <div className={`space-y-6 ${className ?? ''}`.trim()}>
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-sky-400">★</span> 链上评分
          </h3>
          <div className="text-2xl font-bold text-sky-400 font-mono tracking-wider">
            {fetchState === 'loading' ? (
              <span className="animate-pulse text-slate-500">...</span>
            ) : rating ? (
              `${rating.toFixed(1)}`
            ) : (
              <span className="text-slate-500 text-lg">暂无</span>
            )}
            <span className="text-sm text-slate-500 ml-1">/ 10</span>
          </div>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <label htmlFor="movie-user-rating" className="flex justify-between text-sm font-medium text-slate-300">
              <span>我的评分</span>
              <span className="text-white font-bold">{userRating} 分</span>
            </label>
            <input
              id="movie-user-rating"
              type="range"
              min={1}
              max={10}
              step={1}
              value={userRating}
              onChange={event => setUserRating(Number(event.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400 transition-all"
            />
            <div className="flex justify-between text-xs text-slate-500 px-1">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={!isConnected || !hasFanSBT || submitState === 'loading'}
            className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:shadow-sky-500/40 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {submitState === 'loading' ? '提交中...' : '提交评分'}
          </button>
        </form>
        
        <div className="mt-4 text-center border-t border-white/5 pt-4">
          <p className={`text-xs ${submitState === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
            {!isConnected
              ? '请先连接钱包即可提交评分。'
              : isFanLoading
                ? '正在检查粉丝身份...'
                : hasFanSBT
                  ? submitMessage || '评分需等待区块确认后更新平均值。'
                  : submitMessage || '需要持有电影粉丝 SBT 才能进行评分。'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default MovieDetailRating;
