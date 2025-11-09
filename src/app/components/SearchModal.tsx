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
              return [movieId, Number(value)] as const;
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/80 to-white/60 p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl dark:from-gray-800/90 dark:to-gray-800/70"
      >
        {/* 头部：输入框 + 关闭按钮 */}
        <div className="flex items-center gap-3 pb-4">
          <div className="flex w-full items-center gap-3 rounded-full border border-gray-200 bg-white/90 px-5 py-3 shadow-sm transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-200/70 dark:border-gray-600 dark:bg-gray-700/80 dark:focus-within:border-blue-400">
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-gray-400 dark:text-gray-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
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
              className="flex-1 border-0 bg-transparent text-base text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* 状态提示 */}
        <div className="min-h-[120px] max-h-[60vh] overflow-y-auto pr-1 space-y-4">
          {loading && results.length === 0 && (
            <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">正在加载...</div>
          )}
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400 dark:bg-red-900/40 dark:text-red-200">{error}</div>
          )}
          {!loading && !error && executedQuery && results.length === 0 && (
            <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">未找到相关电影。</div>
          )}
          {results.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {results.map((movie) => {
                const imageUrl = movie.poster_path ? `${IMAGE_BASE}${movie.poster_path}` : null;
                return (
                  <li key={movie.id}>
                    <Link
                      href={`/movie/${movie.id}`}
                      onClick={() => onClose()}
                      className="group flex h-40 gap-3 rounded border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={movie.title}
                          className="h-full w-24 flex-shrink-0 rounded object-cover object-center"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-24 flex-shrink-0 items-center justify-center rounded bg-gray-200 text-xs text-gray-500 dark:bg-gray-600 dark:text-gray-200">无海报</div>
                      )}
                      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-gray-100">{movie.title}</h3>
                        <div className="text-xs text-gray-500 dark:text-gray-300">
                          {movie.release_date ? `上映：${movie.release_date}` : "上映时间未知"}
                          {typeof movie.vote_average === "number" && movie.vote_average > 0 ? ` · TMDB评分：${movie.vote_average.toFixed(1)}` : ""}
                        </div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400">
                          本站评分：
                          {(() => {
                            const key = String(movie.id);
                            const rating = contractRatings[key];
                            if (ratingsLoading && rating === undefined) return "加载中...";
                            if (rating === null) return "获取失败";
                            if (!rating) return "暂无评分";
                            return `${rating} / 10`;
                          })()}
                        </div>
                        <p className="line-clamp-4 text-xs text-gray-600 dark:text-gray-300">{movie.overview || "暂无简介"}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {/* 底部 sentinel */}
          {results.length > 0 && (
            <div ref={sentinelRef} className="h-10 w-full">
              {hasMore ? (
                <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                  {loadingMore ? "加载更多..." : "滚动加载更多"}
                </div>
              ) : (
                <div className="flex items-center justify-center text-xs text-gray-400 dark:text-gray-600">已全部加载</div>
              )}
            </div>
          )}
        </div>
        {/* 移除分页条，采用无限滚动 */}
      </div>
    </div>
  );
};

export default SearchModal;
