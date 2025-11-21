"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { readContract } from "wagmi/actions";
import { config } from "../providers";
import { MOVIE_RATING_ABI, MOVIE_RATING_ADDRESS } from "../contracts/movieRating";

interface MovieResult {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

const IMAGE_BASE = "https://image.tmdb.org/t/p/w185";

// 模态内的搜索 + 结果展示（参考 Uniswap 风格：中央盒 + 背景模糊）
export const SearchModal: React.FC<SearchModalProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1); // 当前已加载的页
  const [totalPages, setTotalPages] = useState(0); // 总页数
  const [totalResults, setTotalResults] = useState(0); // 总结果数
  const [hasMore, setHasMore] = useState(true); // 是否还有更多可加载
  const [results, setResults] = useState<MovieResult[]>([]);
  const [executedQuery, setExecutedQuery] = useState("");
  const [loading, setLoading] = useState(false); // 初次或重新搜索加载
  const [loadingMore, setLoadingMore] = useState(false); // 追加加载状态
  const [error, setError] = useState<string | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [contractRatings, setContractRatings] = useState<Record<string, number | null>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 打开时禁止 body 滚动
  useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [open]);

  // ESC 关闭 & 点击遮罩关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (e.target instanceof Node && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  // 输入防抖：300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchMovies = useCallback(
    async (searchTerm: string, targetPage: number, append = false) => {
      const trimmed = searchTerm.trim();
      if (!trimmed) {
        setError(null);
        setResults([]);
        setTotalPages(0);
        setTotalResults(0);
        setExecutedQuery("");
        setPage(1);
        setHasMore(false);
        return;
      }

      controllerRef.current?.abort();
      const ac = new AbortController();
      controllerRef.current = ac;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const resp = await fetch(`/api/search/movie?q=${encodeURIComponent(trimmed)}&page=${targetPage}`, {
          signal: ac.signal,
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const newItems: MovieResult[] = Array.isArray(data.results) ? data.results : [];
        setResults(prev => {
          if (!append) return newItems;
          // 过滤掉重复 id，解决 React key 重复警告
          const existingIds = new Set(prev.map(m => m.id));
            const deduped = newItems.filter(m => !existingIds.has(m.id));
          return [...prev, ...deduped];
        });
        const currentPage = data.page ?? targetPage;
        const tp = data.total_pages ?? 0;
        const tr = data.total_results ?? 0;
        setPage(currentPage);
        setTotalPages(tp);
        setTotalResults(tr);
        setHasMore(currentPage < tp);
        setExecutedQuery(trimmed);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "未知错误");
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    []
  );

  // 根据防抖后的关键词自动搜索
  useEffect(() => {
    if (!open) return; // 未打开不搜索，节省资源
    fetchMovies(debouncedQuery, 1);
  }, [debouncedQuery, fetchMovies, open]);

  // 分页
  // 触底加载下一页
  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const next = page + 1;
    if (next > totalPages) {
      setHasMore(false);
      return;
    }
    fetchMovies(executedQuery || debouncedQuery || query, next, true);
  }, [loading, loadingMore, hasMore, page, totalPages, fetchMovies, executedQuery, debouncedQuery, query]);

  // IntersectionObserver 观察底部 sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting) {
        loadMore();
      }
    }, { root: el.parentElement, threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, loadMore, results]);

  // 读取链上评分（与原组件逻辑一致）
  useEffect(() => {
    let cancelled = false;
    if (!results.length) {
      setContractRatings({});
      setRatingsLoading(false);
      return () => {
        cancelled = true;
      };
    }
    const fetchRatings = async () => {
      setRatingsLoading(true);
      setContractRatings({});
      try {
        const entries = await Promise.all(
          results.map(async (movie) => {
            const movieId = String(movie.id);
            try {
              const value = (await readContract(config, {
                address: MOVIE_RATING_ADDRESS,
                abi: MOVIE_RATING_ABI,
                functionName: "getAverageRating",
                args: [movieId],
              })) as bigint;
              return [movieId, Number(value) / 100] as const;
            } catch {
              return [movieId, null] as const;
            }
          })
        );
        if (!cancelled) setContractRatings(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setRatingsLoading(false);
      }
    };
    fetchRatings();
    return () => {
      cancelled = true;
    };
  }, [results]);

  if (!open) return null;

  return (
    <div aria-modal="true" role="dialog" className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
      {/* 背景遮罩 + 模糊 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" />
      <div
        ref={containerRef}
        className="glass-panel relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl"
      >
        {/* 头部：输入框 + 关闭按钮 */}
        <div className="flex items-center gap-3 pb-6">
          <div className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 shadow-inner transition-all focus-within:border-sky-500/50 focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-sky-500/20">
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.35-4.65a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="搜索电影，例如：Inception"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError(null);
              }}
              className="flex-1 border-0 bg-transparent text-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-0"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 状态提示 */}
        <div className="min-h-[120px] max-h-[60vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
          {loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p>正在搜索...</p>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 text-center">
              {error}
            </div>
          )}
          {!loading && !error && executedQuery && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <span className="text-4xl mb-2">🤔</span>
              <p>未找到相关电影</p>
            </div>
          )}
          
          {results.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {results.map((movie) => {
                const imageUrl = movie.poster_path ? `${IMAGE_BASE}${movie.poster_path}` : null;
                const rating = contractRatings[String(movie.id)];
                
                return (
                  <li key={movie.id}>
                    <Link
                      href={`/movie/${movie.id}`}
                      onClick={() => onClose()}
                      className="group flex h-44 gap-4 rounded-xl border border-slate-700/30 bg-slate-800/40 p-3 transition-all hover:bg-slate-700/60 hover:border-slate-600 hover:shadow-lg hover:-translate-y-0.5"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={movie.title}
                          className="h-full w-28 flex-shrink-0 rounded-lg object-cover object-center shadow-md group-hover:shadow-xl transition-shadow"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-28 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-500">
                          无海报
                        </div>
                      )}
                      
                      <div className="flex flex-1 flex-col justify-between py-1 overflow-hidden">
                        <div>
                          <h3 className="line-clamp-1 text-base font-bold text-white group-hover:text-sky-400 transition-colors">
                            {movie.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                            <span>{movie.release_date?.split('-')[0] || "未知年份"}</span>
                            {movie.vote_average && movie.vote_average > 0 && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                <span className="text-yellow-500/80">★ {movie.vote_average.toFixed(1)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <p className="line-clamp-2 text-xs text-slate-400 leading-relaxed my-2">
                          {movie.overview || "暂无简介"}
                        </p>

                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                          <span className="text-xs text-slate-500">链上评分</span>
                          {(() => {
                            if (ratingsLoading && rating === undefined) 
                              return <span className="text-xs text-slate-500 animate-pulse">...</span>;
                            if (rating === null) 
                              return <span className="text-xs text-slate-600">暂无</span>;
                            if (!rating) 
                              return <span className="text-xs text-slate-600">暂无</span>;
                            
                            const scoreColor = rating >= 8 ? 'text-emerald-400' : rating >= 6 ? 'text-sky-400' : 'text-amber-400';
                            return (
                              <span className={`text-sm font-bold font-mono ${scoreColor}`}>
                                {rating.toFixed(1)}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          
          {/* 底部 sentinel */}
          {results.length > 0 && (
            <div ref={sentinelRef} className="h-12 w-full flex items-center justify-center">
              {hasMore ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {loadingMore && <div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin"></div>}
                  <span>{loadingMore ? "加载更多..." : "滚动加载更多"}</span>
                </div>
              ) : (
                <div className="text-xs text-slate-600">已显示全部结果</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
