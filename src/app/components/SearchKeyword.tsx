'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface MovieResult {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
}

interface Props {
  className?: string;
}

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';

export const SearchKeyword: React.FC<Props> = ({ className }) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [results, setResults] = useState<MovieResult[]>([]);
  const [executedQuery, setExecutedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchMovies = useCallback(
    async (searchTerm: string, targetPage: number) => {
      const trimmed = searchTerm.trim();
      if (!trimmed) {
        setError('请输入搜索内容');
        setResults([]);
        setTotalPages(0);
        setTotalResults(0);
        setExecutedQuery('');
        setPage(1);
        return;
      }

      controllerRef.current?.abort();
      const ac = new AbortController();
      controllerRef.current = ac;
      setLoading(true);
      setError(null);

      try {
        const resp = await fetch(
          `/api/search/movie?q=${encodeURIComponent(trimmed)}&page=${targetPage}`,
          { signal: ac.signal }
        );
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        setResults(Array.isArray(data.results) ? data.results : []);
        setPage(data.page ?? targetPage);
        setTotalPages(data.total_pages ?? 0);
        setTotalResults(data.total_results ?? 0);
        setExecutedQuery(trimmed);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setError(e?.message || '未知错误');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchMovies(query, 1);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    fetchMovies(executedQuery || query, nextPage);
  };

  return (
    <div className={`kw-search-wrapper w-full max-w-3xl ${className || ''}`.trim()}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-4"
      >
        <label className="sr-only" htmlFor="movie-search-input">
          搜索 TMDB 电影
        </label>
        <div className="flex w-full items-center gap-3 rounded-full border border-gray-200 bg-white/90 px-5 py-3 shadow-[0_15px_45px_rgba(15,23,42,0.08)] transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-200/70">
          <svg
            aria-hidden="true"
            focusable="false"
            className="h-5 w-5 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35m1.35-4.65a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            id="movie-search-input"
            type="text"
            placeholder="输入电影名称，例如：Inception"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            className="flex-1 border-0 bg-transparent text-base text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-blue-600 px-8 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? '搜索中...' : '搜索'}
        </button>
        {error && <div className="text-xs text-red-600">{error}</div>}
        {!error && executedQuery && (
          <div className="text-xs text-gray-500">
            当前查询：<span className="font-medium text-gray-700">{executedQuery}</span>
            {totalResults ? `，共 ${totalResults} 条结果` : ''}
          </div>
        )}
      </form>

      <div className="mt-10 space-y-3">
        {loading && (
          <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            正在加载电影数据...
          </div>
        )}

        {!loading && executedQuery && results.length === 0 && !error && (
          <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            未找到相关电影。
          </div>
        )}

        {!loading && results.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {results.map(movie => {
              const imageUrl = movie.poster_path ? `${IMAGE_BASE}${movie.poster_path}` : null;
              return (
                <li
                  key={movie.id}
                  className="flex gap-3 rounded border border-gray-200 bg-white p-3 shadow-sm"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={movie.title}
                      className="h-24 w-16 flex-shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center rounded bg-gray-200 text-xs text-gray-500">
                      无海报
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <h3 className="text-sm font-semibold text-gray-900">{movie.title}</h3>
                    <div className="text-xs text-gray-500">
                      {movie.release_date ? `上映：${movie.release_date}` : '上映时间未知'}
                      {typeof movie.vote_average === 'number' && movie.vote_average > 0
                        ? ` · 评分：${movie.vote_average.toFixed(1)}`
                        : ''}
                    </div>
                    <p className="max-h-24 overflow-hidden text-xs text-gray-600">
                      {movie.overview || '暂无简介'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white p-3 text-sm shadow-sm">
            <div>
              第 {page} / {totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="rounded border border-gray-300 px-3 py-1 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-gray-300 px-3 py-1 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchKeyword;
