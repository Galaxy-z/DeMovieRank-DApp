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
        setRating(Number(value));
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
    <div className={`space-y-3 ${className ?? ''}`.trim()}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">链上平均评分</h3>
        <p className="text-sm text-slate-200">{averageLabel}</p>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 shadow-inner">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label htmlFor="movie-user-rating" className="text-sm font-medium text-slate-200">
              我的评分（1-10）
            </label>
            <input
              id="movie-user-rating"
              type="number"
              min={1}
              max={10}
              value={userRating}
              onChange={event => setUserRating(Number(event.target.value))}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            />
          </div>
          <button
            type="submit"
            disabled={!isConnected || !hasFanSBT || submitState === 'loading'}
            className="inline-flex w-full items-center justify-center rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-700/60"
          >
            {submitState === 'loading' ? '提交中...' : '提交评分'}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          {!isConnected
            ? '请先连接钱包即可提交评分。'
            : isFanLoading
              ? '正在检查粉丝身份，请稍候。'
              : hasFanSBT
                ? submitMessage || '评分需等待区块确认后更新平均值。'
                : submitMessage || '需要持有电影粉丝 SBT 才能进行评分。'}
        </p>
      </div>
    </div>
  );
}

export default MovieDetailRating;
